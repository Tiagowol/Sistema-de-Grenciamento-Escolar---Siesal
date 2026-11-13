-- Migração 0031 (L22b): árvore do Master, só leitura (A-074, A-097, A-098, docs/PROPOSTA-L22B.md).
-- Só funções de leitura; nenhuma tabela, coluna ou permissão de tabela nova. O papel siesal_ops continua sem ler
-- tabela escolar: ele só executa estas 3 funções. Cada uma devolve APENAS: id, nome, e-mail, área (perfil), situação e
-- "menor/maior". Nunca CPF, nascimento, nota, tarefa, agenda, mensagem, dificuldade nem senha. Nenhuma escreve.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0031.md (DROP FUNCTION das 3 funções).

-- 1) Pessoas de UMA escola, por área. "menor" só existe para aluno (nascimento declarado; sem data, vale menor).
CREATE FUNCTION arvore_instituicao(p_inst uuid)
RETURNS TABLE (usuario_id uuid, perfil text, nome text, email text, ativo boolean, menor boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM instituicao i WHERE i.id = p_inst AND i.tipo = 'escola') THEN RETURN; END IF;
  PERFORM set_config('app.instituicao_id', p_inst::text, true);
  RETURN QUERY
    SELECT u.id, u.perfil, u.nome, u.email,
           (u.situacao = 'ativo' AND u.desativado_em IS NULL),
           CASE WHEN u.perfil = 'aluno'
                THEN coalesce((SELECT d.nascimento > (current_date - interval '18 years')::date
                                 FROM aluno_dados d WHERE d.instituicao_id = u.instituicao_id AND d.usuario_id = u.id), true)
           END
      FROM usuario u
     WHERE u.instituicao_id = p_inst
     ORDER BY u.perfil, u.nome, u.id
     LIMIT 2000;
  PERFORM set_config('app.instituicao_id', v_old, true);
END $$;
REVOKE ALL ON FUNCTION arvore_instituicao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION arvore_instituicao(uuid) TO siesal_ops;

-- 2) Espaços individuais: o aluno e, se houver, o Responsável legal. Um espaço por instituicao_id do tipo 'individual'.
CREATE FUNCTION arvore_espacos_individuais()
RETURNS TABLE (espaco_id uuid, usuario_id uuid, perfil text, nome text, email text, ativo boolean, menor boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inst uuid; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  FOR v_inst IN SELECT i.id FROM instituicao i WHERE i.tipo = 'individual' ORDER BY i.criado_em, i.id LIMIT 2000 LOOP
    PERFORM set_config('app.instituicao_id', v_inst::text, true);
    RETURN QUERY
      SELECT v_inst, u.id, u.perfil, u.nome, u.email,
             (u.situacao = 'ativo' AND u.desativado_em IS NULL),
             CASE WHEN u.perfil = 'aluno'
                  THEN coalesce((SELECT d.nascimento > (current_date - interval '18 years')::date
                                   FROM aluno_dados d WHERE d.instituicao_id = u.instituicao_id AND d.usuario_id = u.id), true)
             END
        FROM usuario u
       WHERE u.instituicao_id = v_inst AND u.perfil IN ('aluno', 'responsavel')
       ORDER BY u.perfil, u.nome, u.id;
  END LOOP;
  PERFORM set_config('app.instituicao_id', v_old, true);
END $$;
REVOKE ALL ON FUNCTION arvore_espacos_individuais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION arvore_espacos_individuais() TO siesal_ops;

-- 3) Usuários sem vínculo: conta (pessoa) ativa sem nenhum usuário ativo em escola nem em espaço individual.
CREATE FUNCTION arvore_sem_vinculo()
RETURNS TABLE (pessoa_id uuid, nome text, email text, papel_desejado text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inst uuid; v_com uuid[] := '{}'; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  FOR v_inst IN SELECT i.id FROM instituicao i LOOP
    PERFORM set_config('app.instituicao_id', v_inst::text, true);
    v_com := v_com || coalesce((SELECT array_agg(DISTINCT u.pessoa_id) FROM usuario u
                                 WHERE u.instituicao_id = v_inst AND u.pessoa_id IS NOT NULL
                                   AND u.situacao = 'ativo' AND u.desativado_em IS NULL), '{}');
  END LOOP;
  PERFORM set_config('app.instituicao_id', v_old, true);
  RETURN QUERY
    SELECT p.id, p.nome, p.email, p.papel_desejado FROM pessoa p
     WHERE p.desativada_em IS NULL AND NOT (p.id = ANY (v_com))
     ORDER BY p.nome, p.id
     LIMIT 2000;
END $$;
REVOKE ALL ON FUNCTION arvore_sem_vinculo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION arvore_sem_vinculo() TO siesal_ops;
