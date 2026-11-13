-- Migração 0029 (L22a-2b): acompanhamento por CÓDIGO DA INSTITUIÇÃO (A-086, docs/PROPOSTA-L22A-2B.md).
-- O aluno (ou o representante legal, se menor) digita o código; o pedido cai na fila do Pedagógico da instituição, que aceita ou
-- recusa. Quem aceita vira o acompanhante, pelo próprio usuário da instituição (não vira usuário no espaço do aluno: A-084).
-- A instituição encerra e renova (em lote) os vínculos dela; o aluno prorroga por 30 dias (rota do aluno, sem função nova).
-- Nada se apaga. Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0029.md.

-- 1) Origem do pedido e quem acompanha pela instituição
ALTER TABLE acompanhamento
  ADD COLUMN origem               text NOT NULL DEFAULT 'email' CHECK (origem IN ('email', 'codigo')),
  ADD COLUMN instituicao_acomp_id uuid REFERENCES instituicao (id),
  ADD COLUMN instituicao_acomp_nome text,
  ADD COLUMN usuario_acomp_id     uuid;            -- Pedagógico da instituição que aceitou
ALTER TABLE acompanhamento ALTER COLUMN email_convidado DROP NOT NULL;
ALTER TABLE acompanhamento DROP CONSTRAINT acompanhamento_email_convidado_check;
ALTER TABLE acompanhamento ADD CONSTRAINT acompanhamento_origem_coerente CHECK (
  (origem = 'email' AND email_convidado IS NOT NULL AND length(btrim(email_convidado)) BETWEEN 3 AND 254
     AND instituicao_acomp_id IS NULL AND usuario_acomp_id IS NULL)
  OR (origem = 'codigo' AND email_convidado IS NULL AND instituicao_acomp_id IS NOT NULL AND papel = 'pedagogico'));
ALTER TABLE acompanhamento DROP CONSTRAINT acompanhamento_encerrado_por_check;
ALTER TABLE acompanhamento ADD CONSTRAINT acompanhamento_encerrado_por_check
  CHECK (encerrado_por IN ('aluno', 'representante', 'instituicao'));
-- Um pedido aberto por aluno e instituição
CREATE UNIQUE INDEX acompanhamento_codigo_aberto ON acompanhamento (instituicao_id, aluno_id, instituicao_acomp_id)
  WHERE origem = 'codigo' AND situacao <> 'encerrado';
CREATE INDEX acompanhamento_da_instituicao ON acompanhamento (instituicao_acomp_id) WHERE instituicao_acomp_id IS NOT NULL;

-- 2) Código da instituição (o Admin liga e gera; só o hash fica guardado)
CREATE TABLE codigo_acompanhamento (
  instituicao_id uuid        PRIMARY KEY REFERENCES instituicao (id),
  codigo_hash    text        UNIQUE,
  ativo          boolean     NOT NULL DEFAULT false,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE codigo_acompanhamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE codigo_acompanhamento FORCE ROW LEVEL SECURITY;
CREATE POLICY codigo_acompanhamento_da_instituicao ON codigo_acompanhamento
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
-- As funções do dono procuram o código de qualquer instituição (o app não tem esta política)
CREATE POLICY codigo_acompanhamento_dono ON codigo_acompanhamento TO siesal_owner USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON codigo_acompanhamento TO siesal_app;

-- 3) Validade do vínculo da instituição (Q7): até o fim do período letivo atual do calendário escolar da instituição
--    (no máximo 12 meses); sem calendário, 12 meses. Troca o contexto de instituição e devolve o anterior.
CREATE FUNCTION acompanhamento_validade_instituicao(p_inst uuid) RETURNS date
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old text := coalesce(current_setting('app.instituicao_id', true), ''); v_fim date;
BEGIN
  PERFORM set_config('app.instituicao_id', p_inst::text, true);
  SELECT max(dia_fim) INTO v_fim FROM calendario_escolar
   WHERE instituicao_id = p_inst AND tipo = 'periodo_letivo' AND desativado_em IS NULL
     AND dia_fim >= current_date AND dia_inicio <= (current_date + interval '12 months')::date;
  PERFORM set_config('app.instituicao_id', v_old, true);
  RETURN least(coalesce(v_fim, (current_date + interval '12 months')::date), (current_date + interval '12 months')::date);
END $$;
REVOKE ALL ON FUNCTION acompanhamento_validade_instituicao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_validade_instituicao(uuid) TO siesal_app;

-- 4) O aluno (no espaço dele) pede acompanhamento por código. Resultados: 'ok', 'invalido' (código errado, desligado, de
--    instituição suspensa ou do espaço individual: mesma resposta), 'duplicado' e 'limite'.
CREATE FUNCTION acompanhamento_codigo_pedir(
  p_inst uuid, p_aluno uuid, p_por uuid, p_hash text,
  p_tarefas boolean, p_dificuldade boolean, p_notas boolean, p_mensagens boolean, p_aprovado boolean
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_dest uuid; v_old text := coalesce(current_setting('app.instituicao_id', true), ''); v_nome text; v_sit text; v_tipo text;
BEGIN
  SELECT instituicao_id INTO v_dest FROM codigo_acompanhamento WHERE codigo_hash = p_hash AND ativo;
  IF v_dest IS NULL THEN RETURN 'invalido'; END IF;
  PERFORM set_config('app.instituicao_id', v_dest::text, true);
  SELECT nome, situacao, tipo INTO v_nome, v_sit, v_tipo FROM instituicao WHERE id = v_dest;
  PERFORM set_config('app.instituicao_id', v_old, true);
  IF v_nome IS NULL OR v_sit <> 'ativa' OR v_tipo = 'individual' THEN RETURN 'invalido'; END IF;
  IF EXISTS (SELECT 1 FROM acompanhamento WHERE instituicao_id = p_inst AND aluno_id = p_aluno
              AND instituicao_acomp_id = v_dest AND origem = 'codigo' AND situacao <> 'encerrado') THEN RETURN 'duplicado'; END IF;
  IF (SELECT count(*) FROM acompanhamento WHERE instituicao_id = p_inst AND aluno_id = p_aluno AND situacao <> 'encerrado') >= 5
    THEN RETURN 'limite'; END IF;
  INSERT INTO acompanhamento (instituicao_id, aluno_id, origem, papel, instituicao_acomp_id, instituicao_acomp_nome,
                              ver_tarefas, ver_dificuldade, ver_notas, ver_mensagens, criado_por_usuario_id, aprovado_em)
  VALUES (p_inst, p_aluno, 'codigo', 'pedagogico', v_dest, v_nome,
          p_tarefas, p_dificuldade, p_notas, p_mensagens, p_por, CASE WHEN p_aprovado THEN now() END);
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION acompanhamento_codigo_pedir(uuid, uuid, uuid, text, boolean, boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_codigo_pedir(uuid, uuid, uuid, text, boolean, boolean, boolean, boolean, boolean) TO siesal_app;

-- 5) Fila do Pedagógico: só o nome do aluno e as caixas pedidas
CREATE FUNCTION acompanhamento_fila(p_inst uuid)
RETURNS TABLE (acompanhamento_id uuid, aluno_nome text, ver_tarefas boolean, ver_dificuldade boolean, ver_notas boolean,
               ver_mensagens boolean, aprovado boolean, criado_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  FOR r IN SELECT a.* FROM acompanhamento a
            WHERE a.instituicao_acomp_id = p_inst AND a.origem = 'codigo' AND a.situacao = 'aguardando_aceite'
              AND a.usuario_acomp_id IS NULL ORDER BY a.criado_em LOOP
    PERFORM set_config('app.instituicao_id', r.instituicao_id::text, true);
    RETURN QUERY SELECT r.id, u.nome, r.ver_tarefas, r.ver_dificuldade, r.ver_notas, r.ver_mensagens,
                        (r.aprovado_em IS NOT NULL), r.criado_em
                   FROM usuario u WHERE u.instituicao_id = r.instituicao_id AND u.id = r.aluno_id;
  END LOOP;
  PERFORM set_config('app.instituicao_id', v_old, true);
END $$;
REVOKE ALL ON FUNCTION acompanhamento_fila(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_fila(uuid) TO siesal_app;

-- 6) Quem aceita vira o acompanhante (Q6). Menor sem aprovação do representante: fica aguardando, nada é liberado.
CREATE FUNCTION acompanhamento_instituicao_aceitar(p_inst uuid, p_usuario uuid, p_acomp uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_a record; v_fim date;
BEGIN
  SELECT * INTO v_a FROM acompanhamento
   WHERE id = p_acomp AND instituicao_acomp_id = p_inst AND origem = 'codigo' AND situacao = 'aguardando_aceite'
     AND usuario_acomp_id IS NULL FOR UPDATE;
  IF v_a.id IS NULL THEN RETURN 'invalido'; END IF;
  v_fim := CASE WHEN v_a.aprovado_em IS NULL THEN NULL ELSE acompanhamento_validade_instituicao(p_inst) END;
  UPDATE acompanhamento SET usuario_acomp_id = p_usuario,
         situacao = CASE WHEN v_a.aprovado_em IS NULL THEN 'aguardando_representante' ELSE 'ativo' END,
         inicio_em = CASE WHEN v_a.aprovado_em IS NULL THEN NULL ELSE now() END, fim_em = v_fim
   WHERE instituicao_id = v_a.instituicao_id AND id = p_acomp;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION acompanhamento_instituicao_aceitar(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_instituicao_aceitar(uuid, uuid, uuid) TO siesal_app;

-- 7) A instituição recusa um pedido da fila ou encerra um vínculo dela, com justificativa registrada
CREATE FUNCTION acompanhamento_instituicao_encerrar(p_inst uuid, p_acomp uuid, p_justificativa text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_n integer;
BEGIN
  IF length(btrim(coalesce(p_justificativa, ''))) < 3 THEN RETURN false; END IF;
  UPDATE acompanhamento SET situacao = 'encerrado', encerrado_em = now(), encerrado_por = 'instituicao',
         justificativa = left(btrim(p_justificativa), 300)
   WHERE id = p_acomp AND instituicao_acomp_id = p_inst AND origem = 'codigo' AND situacao <> 'encerrado';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END $$;
REVOKE ALL ON FUNCTION acompanhamento_instituicao_encerrar(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_instituicao_encerrar(uuid, uuid, text) TO siesal_app;

-- 8) Vínculos aceitos da instituição (Admin e Pedagógico gerenciam; cada Pedagógico lê os próprios). Só nome e caixas.
CREATE FUNCTION acompanhamento_instituicao_vinculos(p_inst uuid)
RETURNS TABLE (acompanhamento_id uuid, aluno_nome text, usuario_id uuid, situacao text, fim_em date, dias_restantes integer,
               vencido boolean, ver_tarefas boolean, ver_dificuldade boolean, ver_notas boolean, ver_mensagens boolean,
               aviso_pendente boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  FOR r IN SELECT a.* FROM acompanhamento a
            WHERE a.instituicao_acomp_id = p_inst AND a.origem = 'codigo' AND a.usuario_acomp_id IS NOT NULL
              AND a.situacao IN ('aguardando_representante', 'ativo') ORDER BY a.criado_em LOOP
    PERFORM set_config('app.instituicao_id', r.instituicao_id::text, true);
    RETURN QUERY SELECT r.id, u.nome, r.usuario_acomp_id, r.situacao, r.fim_em, (r.fim_em - current_date)::integer,
                        (r.fim_em IS NOT NULL AND r.fim_em < current_date),
                        r.ver_tarefas, r.ver_dificuldade, r.ver_notas, r.ver_mensagens,
                        (r.aviso_visto_em IS NULL OR r.aviso_visto_em < r.itens_alterados_em)
                   FROM usuario u WHERE u.instituicao_id = r.instituicao_id AND u.id = r.aluno_id;
  END LOOP;
  PERFORM set_config('app.instituicao_id', v_old, true);
END $$;
REVOKE ALL ON FUNCTION acompanhamento_instituicao_vinculos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_instituicao_vinculos(uuid) TO siesal_app;

-- 9) O acompanhante confirma que leu o aviso de quem controla o acesso (Q5)
CREATE FUNCTION acompanhamento_instituicao_aviso_visto(p_inst uuid, p_usuario uuid, p_acomp uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_n integer;
BEGIN
  UPDATE acompanhamento SET aviso_visto_em = now()
   WHERE id = p_acomp AND instituicao_acomp_id = p_inst AND usuario_acomp_id = p_usuario;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END $$;
REVOKE ALL ON FUNCTION acompanhamento_instituicao_aviso_visto(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_instituicao_aviso_visto(uuid, uuid, uuid) TO siesal_app;

-- 10) Leitura de UM item de UM aluno pelo Pedagógico que aceitou. Sem linha = negado (outra instituição, outro Pedagógico,
--     não aceito, encerrado, vencido ou item não marcado).
CREATE FUNCTION acompanhamento_instituicao_ler(p_inst uuid, p_usuario uuid, p_acomp uuid, p_item text)
RETURNS TABLE (instituicao_id uuid, dados jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a record; v jsonb; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  SELECT * INTO a FROM acompanhamento
   WHERE id = p_acomp AND instituicao_acomp_id = p_inst AND usuario_acomp_id = p_usuario AND origem = 'codigo'
     AND situacao = 'ativo' AND (fim_em IS NULL OR fim_em >= current_date);
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
  PERFORM set_config('app.instituicao_id', v_old, true);
  RETURN QUERY SELECT a.instituicao_id, v;
END $$;
REVOKE ALL ON FUNCTION acompanhamento_instituicao_ler(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_instituicao_ler(uuid, uuid, uuid, text) TO siesal_app;

-- 11) Renovação em lote pela instituição (Q3): vai até o fim do período letivo atual; se já está nele, soma 12 meses
CREATE FUNCTION acompanhamento_instituicao_renovar(p_inst uuid, p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_fim date := acompanhamento_validade_instituicao(p_inst); v_n integer;
BEGIN
  UPDATE acompanhamento SET fim_em = CASE WHEN fim_em IS NULL OR fim_em < v_fim THEN v_fim
                                          ELSE (fim_em + interval '12 months')::date END
   WHERE id = ANY (p_ids) AND instituicao_acomp_id = p_inst AND origem = 'codigo' AND situacao = 'ativo'
     AND usuario_acomp_id IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION acompanhamento_instituicao_renovar(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acompanhamento_instituicao_renovar(uuid, uuid[]) TO siesal_app;
