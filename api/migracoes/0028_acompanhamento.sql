-- Migração 0028 (L22a-2): acompanhamento por e-mail e tela "Quem pode ver meus dados" (A-080, A-081, docs/PROPOSTA-L22A-1C-E-L22A-2.md).
-- O pedido nasce sempre do lado do aluno (ou do representante legal, se menor). Ninguém procura aluno.
-- Desenho (ajuste aceito em 13/11): o acompanhante NÃO vira `usuario` no espaço do aluno. Ele lê por funções que conferem
-- o vínculo, a validade e as 4 caixas, um aluno por vez. Assim nenhuma rota atual o deixa ver nada além do liberado.
-- Nada se apaga: encerrar muda a situação e guarda quem, quando e por quê.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0028.md.

-- 1) Acompanhamento: uma linha por pedido, dentro do espaço do aluno (RLS por instituição)
CREATE TABLE acompanhamento (
  instituicao_id        uuid        NOT NULL REFERENCES instituicao (id),
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  aluno_id              uuid        NOT NULL,
  pessoa_id             uuid        REFERENCES pessoa (id),           -- preenchido quando a pessoa aceita
  email_convidado       text        NOT NULL CHECK (length(btrim(email_convidado)) BETWEEN 3 AND 254),
  papel                 text        NOT NULL CHECK (papel IN ('professor', 'pedagogico', 'responsavel')),
  situacao              text        NOT NULL DEFAULT 'aguardando_aceite'
                        CHECK (situacao IN ('aguardando_aceite', 'aguardando_representante', 'ativo', 'encerrado')),
  ver_tarefas           boolean     NOT NULL DEFAULT false,           -- tarefas e plano
  ver_dificuldade       boolean     NOT NULL DEFAULT false,           -- nível de dificuldade
  ver_notas             boolean     NOT NULL DEFAULT false,           -- notas
  ver_mensagens         boolean     NOT NULL DEFAULT false,           -- mensagens (pedidos de ajuda)
  criado_por_usuario_id uuid        NOT NULL,
  aprovado_em           timestamptz,                                  -- aprovação do representante legal (aluno menor)
  inicio_em             timestamptz,
  fim_em                date,                                         -- nulo para o representante indicado
  itens_alterados_em    timestamptz NOT NULL DEFAULT now(),
  aviso_visto_em        timestamptz,                                  -- o acompanhante viu o aviso de quem controla o acesso
  encerrado_em          timestamptz,
  encerrado_por         text        CHECK (encerrado_por IN ('aluno', 'representante')),
  justificativa         text        CHECK (length(justificativa) <= 300),
  criado_em             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, aluno_id) REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, criado_por_usuario_id) REFERENCES usuario (instituicao_id, id),
  CHECK (situacao <> 'encerrado' OR (encerrado_em IS NOT NULL AND length(btrim(coalesce(justificativa, ''))) >= 3))
);
CREATE INDEX acompanhamento_aluno ON acompanhamento (instituicao_id, aluno_id);
CREATE INDEX acompanhamento_pessoa ON acompanhamento (pessoa_id) WHERE pessoa_id IS NOT NULL;
-- Não repete o mesmo pedido aberto para o mesmo e-mail e papel
CREATE UNIQUE INDEX acompanhamento_aberto ON acompanhamento (instituicao_id, aluno_id, lower(btrim(email_convidado)), papel)
  WHERE situacao <> 'encerrado';

-- Limite de 5 acompanhamentos abertos por aluno
CREATE FUNCTION acompanhamento_limite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM acompanhamento a
       WHERE a.instituicao_id = NEW.instituicao_id AND a.aluno_id = NEW.aluno_id AND a.situacao <> 'encerrado') >= 5 THEN
    RAISE EXCEPTION 'limite de 5 acompanhantes' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER acompanhamento_limite_antes BEFORE INSERT ON acompanhamento
  FOR EACH ROW EXECUTE FUNCTION acompanhamento_limite();

ALTER TABLE acompanhamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE acompanhamento FORCE ROW LEVEL SECURITY;
CREATE POLICY acompanhamento_da_instituicao ON acompanhamento
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
-- As funções do dono leem os acompanhamentos de uma pessoa em vários espaços (só elas; o app não tem esta política)
CREATE POLICY acompanhamento_dono ON acompanhamento TO siesal_owner USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON acompanhamento TO siesal_app;

-- 2) Link do convite (uso único, 7 dias, só o hash). Tabela só do dono; o app só usa as funções abaixo.
CREATE TABLE convite_acompanhamento (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id    uuid        NOT NULL REFERENCES instituicao (id),
  acompanhamento_id uuid        NOT NULL,
  email             text        NOT NULL,
  token_hash        text        NOT NULL UNIQUE,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  expira_em         timestamptz NOT NULL DEFAULT now() + interval '7 days',
  usado_em          timestamptz,
  FOREIGN KEY (instituicao_id, acompanhamento_id) REFERENCES acompanhamento (instituicao_id, id)
);
ALTER TABLE convite_acompanhamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE convite_acompanhamento FORCE ROW LEVEL SECURITY;
CREATE POLICY convite_acompanhamento_dono ON convite_acompanhamento TO siesal_owner USING (true) WITH CHECK (true);

-- Grava o link do convite; os links anteriores do mesmo pedido deixam de valer
CREATE FUNCTION acompanhamento_convite_gravar(p_inst uuid, p_acomp uuid, p_email text, p_token_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE convite_acompanhamento SET expira_em = now()
   WHERE instituicao_id = p_inst AND acompanhamento_id = p_acomp AND usado_em IS NULL AND expira_em > now();
  INSERT INTO convite_acompanhamento (instituicao_id, acompanhamento_id, email, token_hash)
  VALUES (p_inst, p_acomp, lower(btrim(p_email)), p_token_hash);
END $$;
REVOKE ALL ON FUNCTION acompanhamento_convite_gravar(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_convite_gravar(uuid, uuid, text, text) TO siesal_app;

-- 3) A pessoa aceita pelo link. Resultados: 'ok', 'invalido' (link ruim, vencido, usado ou e-mail diferente) e 'papel'.
--    Aluno menor sem aprovação do representante: fica 'aguardando_representante' (nada é liberado).
CREATE FUNCTION acompanhamento_aceitar(p_pessoa uuid, p_token_hash text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_c record; v_p record; v_a record;
BEGIN
  SELECT * INTO v_c FROM convite_acompanhamento
   WHERE token_hash = p_token_hash AND usado_em IS NULL AND expira_em > now() FOR UPDATE;
  IF v_c.id IS NULL THEN RETURN 'invalido'; END IF;
  SELECT id, email, papel_desejado INTO v_p FROM pessoa
   WHERE id = p_pessoa AND email_confirmado_em IS NOT NULL AND desativada_em IS NULL;
  IF v_p.id IS NULL OR lower(btrim(v_p.email)) <> v_c.email THEN RETURN 'invalido'; END IF;
  PERFORM set_config('app.instituicao_id', v_c.instituicao_id::text, true);
  SELECT * INTO v_a FROM acompanhamento
   WHERE instituicao_id = v_c.instituicao_id AND id = v_c.acompanhamento_id
     AND situacao = 'aguardando_aceite' AND pessoa_id IS NULL FOR UPDATE;
  IF v_a.id IS NULL THEN PERFORM set_config('app.instituicao_id', '', true); RETURN 'invalido'; END IF;
  IF v_p.papel_desejado IS DISTINCT FROM v_a.papel THEN
    PERFORM set_config('app.instituicao_id', '', true); RETURN 'papel';
  END IF;
  UPDATE acompanhamento SET
      pessoa_id = p_pessoa,
      situacao = CASE WHEN v_a.aprovado_em IS NULL THEN 'aguardando_representante' ELSE 'ativo' END,
      inicio_em = CASE WHEN v_a.aprovado_em IS NULL THEN NULL ELSE now() END,
      fim_em = CASE WHEN v_a.aprovado_em IS NULL OR v_a.papel = 'responsavel' THEN NULL
                    ELSE (current_date + interval '12 months')::date END
    WHERE instituicao_id = v_c.instituicao_id AND id = v_c.acompanhamento_id;
  UPDATE convite_acompanhamento SET usado_em = now() WHERE id = v_c.id;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION acompanhamento_aceitar(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_aceitar(uuid, text) TO siesal_app;

-- 4) Lado do acompanhante: quem ele acompanha. Só mostra pedidos aceitos e não encerrados. Não devolve dado do aluno além do nome.
CREATE FUNCTION acompanhando_listar(p_pessoa uuid)
RETURNS TABLE (acompanhamento_id uuid, aluno_nome text, papel text, situacao text, fim_em date, vencido boolean,
               ver_tarefas boolean, ver_dificuldade boolean, ver_notas boolean, ver_mensagens boolean, aviso_pendente boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT a.* FROM acompanhamento a
            WHERE a.pessoa_id = p_pessoa AND a.situacao IN ('aguardando_representante', 'ativo') LOOP
    PERFORM set_config('app.instituicao_id', r.instituicao_id::text, true);
    RETURN QUERY
      SELECT r.id, u.nome, r.papel, r.situacao, r.fim_em,
             (r.fim_em IS NOT NULL AND r.fim_em < current_date),
             r.ver_tarefas, r.ver_dificuldade, r.ver_notas, r.ver_mensagens,
             (r.aviso_visto_em IS NULL OR r.aviso_visto_em < r.itens_alterados_em)
        FROM usuario u WHERE u.instituicao_id = r.instituicao_id AND u.id = r.aluno_id;
  END LOOP;
  PERFORM set_config('app.instituicao_id', '', true);
END $$;
REVOKE ALL ON FUNCTION acompanhando_listar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhando_listar(uuid) TO siesal_app;

-- O acompanhante confirma que leu o aviso de quem controla o acesso (Q5)
CREATE FUNCTION acompanhando_aviso_visto(p_pessoa uuid, p_acomp uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inst uuid;
BEGIN
  SELECT instituicao_id INTO v_inst FROM acompanhamento WHERE id = p_acomp AND pessoa_id = p_pessoa;
  IF v_inst IS NULL THEN RETURN false; END IF;
  PERFORM set_config('app.instituicao_id', v_inst::text, true);
  UPDATE acompanhamento SET aviso_visto_em = now() WHERE instituicao_id = v_inst AND id = p_acomp;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION acompanhando_aviso_visto(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhando_aviso_visto(uuid, uuid) TO siesal_app;

-- 5) Leitura de UM item de UM aluno. Sem linha = negado (pedido que não é da pessoa, não aceito, encerrado, vencido
--    ou item não marcado). Nunca devolve lista de alunos, média, ordem por dificuldade nem comparação.
CREATE FUNCTION acompanhando_ler(p_pessoa uuid, p_acomp uuid, p_item text)
RETURNS TABLE (instituicao_id uuid, dados jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a record; v jsonb;
BEGIN
  SELECT * INTO a FROM acompanhamento
   WHERE id = p_acomp AND pessoa_id = p_pessoa AND situacao = 'ativo' AND (fim_em IS NULL OR fim_em >= current_date);
  IF a.id IS NULL THEN RETURN; END IF;
  IF NOT (CASE p_item WHEN 'tarefas' THEN a.ver_tarefas WHEN 'dificuldade' THEN a.ver_dificuldade
                      WHEN 'notas' THEN a.ver_notas WHEN 'mensagens' THEN a.ver_mensagens ELSE false END) THEN RETURN; END IF;
  PERFORM set_config('app.instituicao_id', a.instituicao_id::text, true);
  IF p_item = 'tarefas' THEN
    SELECT coalesce(jsonb_agg(x ORDER BY x.prazo NULLS LAST), '[]') INTO v FROM (
      SELECT t.titulo, t.tipo, t.disciplina, t.prazo, t.situacao FROM tarefa t
       WHERE t.instituicao_id = a.instituicao_id AND t.usuario_id = a.aluno_id AND t.desativado_em IS NULL
       ORDER BY t.prazo NULLS LAST, t.criado_em LIMIT 100) x;
  ELSIF p_item = 'dificuldade' THEN
    SELECT coalesce(jsonb_agg(x), '[]') INTO v FROM (
      SELECT 'tarefa' AS origem, t.titulo AS nome, t.dificuldade FROM tarefa t
       WHERE t.instituicao_id = a.instituicao_id AND t.usuario_id = a.aluno_id AND t.desativado_em IS NULL AND t.dificuldade IS NOT NULL
      UNION ALL
      SELECT 'disciplina', d.nome, d.dificuldade FROM disciplina_aluno d
       WHERE d.instituicao_id = a.instituicao_id AND d.usuario_id = a.aluno_id AND d.desativado_em IS NULL AND d.dificuldade IS NOT NULL) x;
  ELSIF p_item = 'notas' THEN
    SELECT coalesce(jsonb_agg(x ORDER BY x.dia DESC), '[]') INTO v FROM (
      SELECT n.disciplina, n.descricao, n.valor, n.dia FROM nota_pessoal n
       WHERE n.instituicao_id = a.instituicao_id AND n.usuario_id = a.aluno_id AND n.desativado_em IS NULL
       ORDER BY n.dia DESC LIMIT 100) x;
  ELSE
    SELECT coalesce(jsonb_agg(x ORDER BY x.criado_em DESC), '[]') INTO v FROM (
      SELECT p.destino, p.motivo, p.texto, p.estado, p.resposta, p.criado_em FROM pedido_ajuda p
       WHERE p.instituicao_id = a.instituicao_id AND p.aluno_id = a.aluno_id
       ORDER BY p.criado_em DESC LIMIT 100) x;
  END IF;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN QUERY SELECT a.instituicao_id, v;
END $$;
REVOKE ALL ON FUNCTION acompanhando_ler(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhando_ler(uuid, uuid, text) TO siesal_app;
