-- Migração 0032 (L22c): aceite do Termo 6 pela instituição e revogação de convite (A-111, A-112, docs/PROPOSTA-L22C.md).
-- Sem tabela nova. Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0032.md.

-- 1) Termo 6 (instituição): versão do texto e momento do aceite, guardados na instituição criada por convite
ALTER TABLE instituicao ADD COLUMN termo_versao text, ADD COLUMN termo_aceito_em timestamptz;

-- 2) Revogar convite: quem e quando. Revogar também vence o convite na hora (expira_em = agora), por isso todas as funções que
-- consomem convite (que já exigem expira_em > now()) passam a recusá-lo sem precisar ser reescritas.
ALTER TABLE convite_individual ADD COLUMN revogado_em timestamptz, ADD COLUMN revogado_por text;
GRANT UPDATE (expira_em, revogado_em, revogado_por) ON convite_individual TO siesal_ops;

-- 3) Criar instituição por convite agora guarda o aceite do Termo 6 (a função antiga, sem termo, sai)
DROP FUNCTION instituicao_criar_por_convite(text, text, text, text, text);
CREATE FUNCTION instituicao_criar_por_convite(
  p_codigo_hash text, p_nome_instituicao text, p_nome_admin text, p_email text, p_senha_hash text, p_termo_versao text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_convite uuid; v_inst uuid := gen_random_uuid(); v_usuario uuid := gen_random_uuid();
BEGIN
  IF coalesce(btrim(p_termo_versao), '') = '' THEN
    RAISE EXCEPTION 'termo nao aceito';
  END IF;
  SELECT id INTO v_convite FROM convite_individual
   WHERE codigo_hash = p_codigo_hash AND tipo = 'instituicao' AND usado_em IS NULL AND revogado_em IS NULL AND expira_em > now() FOR UPDATE;
  IF v_convite IS NULL THEN
    RAISE EXCEPTION 'convite invalido ou vencido';
  END IF;
  PERFORM set_config('app.instituicao_id', v_inst::text, true);
  INSERT INTO instituicao (id, nome, tipo, situacao, termo_versao, termo_aceito_em)
  VALUES (v_inst, btrim(p_nome_instituicao), 'escola', 'em_implantacao', btrim(p_termo_versao), now());
  INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES (v_usuario, v_inst, 'admin', btrim(p_nome_admin), btrim(p_email));
  INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES (v_inst, v_usuario, p_senha_hash);
  UPDATE convite_individual SET usado_em = now(), instituicao_id = v_inst WHERE id = v_convite;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN v_inst;
END $$;
REVOKE ALL ON FUNCTION instituicao_criar_por_convite(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION instituicao_criar_por_convite(text, text, text, text, text, text) TO siesal_app;
