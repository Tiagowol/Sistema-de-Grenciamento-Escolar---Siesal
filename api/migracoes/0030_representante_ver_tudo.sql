-- Migração 0030 (L22a-3): representante legal vê tudo (aluno menor), só leitura; Agenda e Disciplinas entram na caixa "Tarefas e plano"
-- (A-091, A-092, docs/PROPOSTA-L22A-3.md). Só funções e um UPDATE de data; nenhuma tabela nem coluna nova.
-- Uma função interna lê o item de um aluno (única fonte da leitura); três portas a usam: o acompanhante por e-mail (0028),
-- o Pedagógico por código (0029) e o representante legal (nova). Nenhuma devolve lista de alunos, média, ordem ou comparação.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0030.md.

-- 1) Leitura interna de UM item de UM aluno. Sem permissão para o app: só as funções abaixo a chamam.
CREATE FUNCTION aluno_ler_item(p_inst uuid, p_aluno uuid, p_item text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v jsonb; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  PERFORM set_config('app.instituicao_id', p_inst::text, true);
  IF p_item = 'tarefas' THEN
    SELECT coalesce(jsonb_agg(x ORDER BY x.prazo NULLS LAST), '[]') INTO v FROM (
      SELECT t.titulo, t.tipo, t.disciplina, t.prazo, t.situacao FROM tarefa t
       WHERE t.instituicao_id = p_inst AND t.usuario_id = p_aluno AND t.desativado_em IS NULL
       ORDER BY t.prazo NULLS LAST, t.criado_em LIMIT 100) x;
  ELSIF p_item = 'agenda' THEN
    -- da última semana em diante, no máximo 100 compromissos
    SELECT coalesce(jsonb_agg(x ORDER BY x.dia, x.hora_inicio NULLS LAST), '[]') INTO v FROM (
      SELECT e.titulo, e.tipo, e.dia, to_char(e.hora_inicio, 'HH24:MI') AS hora_inicio, e.minutos FROM evento e
       WHERE e.instituicao_id = p_inst AND e.usuario_id = p_aluno AND e.desativado_em IS NULL
         AND e.dia >= current_date - 7
       ORDER BY e.dia, e.hora_inicio NULLS LAST LIMIT 100) x;
  ELSIF p_item = 'disciplinas' THEN
    SELECT coalesce(jsonb_agg(x ORDER BY x.nome), '[]') INTO v FROM (
      SELECT d.nome, d.origem FROM disciplina_aluno d
       WHERE d.instituicao_id = p_inst AND d.usuario_id = p_aluno AND d.desativado_em IS NULL
       ORDER BY d.nome LIMIT 100) x;
  ELSIF p_item = 'dificuldade' THEN
    SELECT coalesce(jsonb_agg(x), '[]') INTO v FROM (
      SELECT 'tarefa' AS origem, t.titulo AS nome, t.dificuldade FROM tarefa t
       WHERE t.instituicao_id = p_inst AND t.usuario_id = p_aluno AND t.desativado_em IS NULL AND t.dificuldade IS NOT NULL
      UNION ALL
      SELECT 'disciplina', d.nome, d.dificuldade FROM disciplina_aluno d
       WHERE d.instituicao_id = p_inst AND d.usuario_id = p_aluno AND d.desativado_em IS NULL AND d.dificuldade IS NOT NULL) x;
  ELSIF p_item = 'notas' THEN
    SELECT coalesce(jsonb_agg(x ORDER BY x.dia DESC), '[]') INTO v FROM (
      SELECT n.disciplina, n.descricao, n.valor, n.dia FROM nota_pessoal n
       WHERE n.instituicao_id = p_inst AND n.usuario_id = p_aluno AND n.desativado_em IS NULL
       ORDER BY n.dia DESC LIMIT 100) x;
  ELSIF p_item = 'mensagens' THEN
    SELECT coalesce(jsonb_agg(x ORDER BY x.criado_em DESC), '[]') INTO v FROM (
      SELECT p.destino, p.motivo, p.texto, p.estado, p.resposta, p.criado_em FROM pedido_ajuda p
       WHERE p.instituicao_id = p_inst AND p.aluno_id = p_aluno
       ORDER BY p.criado_em DESC LIMIT 100) x;
  END IF;
  PERFORM set_config('app.instituicao_id', v_old, true);
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION aluno_ler_item(uuid, uuid, text) FROM PUBLIC;

-- 2) Acompanhante por e-mail (substitui a da 0028): Agenda e Disciplinas seguem a caixa "Tarefas e plano"
CREATE OR REPLACE FUNCTION acompanhando_ler(p_pessoa uuid, p_acomp uuid, p_item text)
RETURNS TABLE (instituicao_id uuid, dados jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM acompanhamento
   WHERE id = p_acomp AND pessoa_id = p_pessoa AND situacao = 'ativo' AND (fim_em IS NULL OR fim_em >= current_date);
  IF a.id IS NULL THEN RETURN; END IF;
  IF NOT (CASE p_item WHEN 'tarefas' THEN a.ver_tarefas WHEN 'agenda' THEN a.ver_tarefas WHEN 'disciplinas' THEN a.ver_tarefas
                      WHEN 'dificuldade' THEN a.ver_dificuldade WHEN 'notas' THEN a.ver_notas
                      WHEN 'mensagens' THEN a.ver_mensagens ELSE false END) THEN RETURN; END IF;
  RETURN QUERY SELECT a.instituicao_id, aluno_ler_item(a.instituicao_id, a.aluno_id, p_item);
END $$;

-- 3) Pedagógico por código da instituição (substitui a da 0029)
CREATE OR REPLACE FUNCTION acompanhamento_instituicao_ler(p_inst uuid, p_usuario uuid, p_acomp uuid, p_item text)
RETURNS TABLE (instituicao_id uuid, dados jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM acompanhamento
   WHERE id = p_acomp AND instituicao_acomp_id = p_inst AND usuario_acomp_id = p_usuario AND origem = 'codigo'
     AND situacao = 'ativo' AND (fim_em IS NULL OR fim_em >= current_date);
  IF a.id IS NULL THEN RETURN; END IF;
  IF NOT (CASE p_item WHEN 'tarefas' THEN a.ver_tarefas WHEN 'agenda' THEN a.ver_tarefas WHEN 'disciplinas' THEN a.ver_tarefas
                      WHEN 'dificuldade' THEN a.ver_dificuldade WHEN 'notas' THEN a.ver_notas
                      WHEN 'mensagens' THEN a.ver_mensagens ELSE false END) THEN RETURN; END IF;
  RETURN QUERY SELECT a.instituicao_id, aluno_ler_item(a.instituicao_id, a.aluno_id, p_item);
END $$;

-- 4) Representante legal no espaço do aluno MENOR: lê tudo, um item por vez. Sem linha = negado (sem vínculo legal ativo).
--    Aluno que já fez 18 anos: devolve a situação 'maior' e nenhum dado (o acesso passa a valer só pelas caixas do aluno).
CREATE FUNCTION representado_ler(p_inst uuid, p_usuario uuid, p_item text)
RETURNS TABLE (situacao text, dados jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_aluno uuid; v_menor boolean; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  PERFORM set_config('app.instituicao_id', p_inst::text, true);
  SELECT v.aluno_id INTO v_aluno FROM vinculo v
    JOIN usuario u ON u.instituicao_id = v.instituicao_id AND u.id = v.usuario_id
    JOIN instituicao i ON i.id = v.instituicao_id
   WHERE v.instituicao_id = p_inst AND v.usuario_id = p_usuario AND v.tipo = 'responsavel_aluno'
     AND v.tipo_responsavel = 'legal' AND v.desativado_em IS NULL
     AND u.perfil = 'responsavel' AND u.situacao = 'ativo' AND u.desativado_em IS NULL AND i.tipo = 'individual'
   LIMIT 1;
  IF v_aluno IS NULL THEN PERFORM set_config('app.instituicao_id', v_old, true); RETURN; END IF;
  SELECT coalesce((SELECT d.nascimento > (current_date - interval '18 years')::date
                     FROM aluno_dados d WHERE d.instituicao_id = p_inst AND d.usuario_id = v_aluno), true) INTO v_menor;
  PERFORM set_config('app.instituicao_id', v_old, true);
  IF NOT v_menor THEN RETURN QUERY SELECT 'maior'::text, NULL::jsonb; RETURN; END IF;
  RETURN QUERY SELECT 'ok'::text, aluno_ler_item(p_inst, v_aluno, p_item);
END $$;
REVOKE ALL ON FUNCTION representado_ler(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION representado_ler(uuid, uuid, text) TO siesal_app;

-- 5) Ficha do aluno para a tela do representante: nome, se é menor e quando faz 18 anos (para o aviso de 30 dias)
CREATE FUNCTION representado_ficha(p_inst uuid, p_usuario uuid)
RETURNS TABLE (aluno_nome text, menor boolean, maior_em date, dias_para_18 integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  PERFORM set_config('app.instituicao_id', p_inst::text, true);
  RETURN QUERY
    SELECT al.nome,
           coalesce(d.nascimento > (current_date - interval '18 years')::date, true),
           (d.nascimento + interval '18 years')::date,
           ((d.nascimento + interval '18 years')::date - current_date)::int
      FROM vinculo v
      JOIN usuario u ON u.instituicao_id = v.instituicao_id AND u.id = v.usuario_id
      JOIN instituicao i ON i.id = v.instituicao_id
      JOIN usuario al ON al.instituicao_id = v.instituicao_id AND al.id = v.aluno_id
      LEFT JOIN aluno_dados d ON d.instituicao_id = v.instituicao_id AND d.usuario_id = v.aluno_id
     WHERE v.instituicao_id = p_inst AND v.usuario_id = p_usuario AND v.tipo = 'responsavel_aluno'
       AND v.tipo_responsavel = 'legal' AND v.desativado_em IS NULL
       AND u.perfil = 'responsavel' AND u.situacao = 'ativo' AND u.desativado_em IS NULL AND i.tipo = 'individual'
     LIMIT 1;
  PERFORM set_config('app.instituicao_id', v_old, true);
END $$;
REVOKE ALL ON FUNCTION representado_ficha(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION representado_ficha(uuid, uuid) TO siesal_app;

-- 6) Quem já tem a caixa "Tarefas e plano" marcada passa a ver também Agenda e Disciplinas: o aviso aparece de novo para o
--    acompanhante e a tela do aluno mostra o novo rótulo. A política do dono cobre este UPDATE.
UPDATE acompanhamento SET itens_alterados_em = now() WHERE ver_tarefas AND situacao <> 'encerrado';

-- 7) Só quem se cadastrou como representante legal vê a seção "Aluno menor de idade" e cria aluno menor (A-090)
CREATE FUNCTION pessoa_papel(p_pessoa uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT papel_desejado FROM pessoa WHERE id = p_pessoa AND desativada_em IS NULL
$$;
REVOKE ALL ON FUNCTION pessoa_papel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pessoa_papel(uuid) TO siesal_app;
