-- Migração 0021 (20c-3): convite de instituição (A-058).
-- O Master gera um código de uso único; quem o recebe cria a instituição (em implantação) e a própria conta de Admin,
-- com a senha que escolhe. O segundo fator (TOTP) continua obrigatório no primeiro login do Admin.
-- Nada se apaga. Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0021.md.

ALTER TABLE convite_individual ADD COLUMN tipo text NOT NULL DEFAULT 'individual' CHECK (tipo IN ('individual', 'instituicao'));

-- O dono (que roda as funções) agora também pode criar instituição do tipo escola, mas só "em implantação"
CREATE POLICY instituicao_criar_escola ON instituicao FOR INSERT TO siesal_owner
  WITH CHECK (tipo = 'escola' AND situacao = 'em_implantacao');

-- O convite de aluno só vale para espaço individual (e o de instituição, só para instituição)
CREATE OR REPLACE FUNCTION espaco_individual_criar(p_codigo_hash text, p_nome text, p_email text, p_senha_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_convite uuid; v_inst uuid := gen_random_uuid(); v_usuario uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_convite FROM convite_individual
   WHERE codigo_hash = p_codigo_hash AND tipo = 'individual' AND usado_em IS NULL AND expira_em > now() FOR UPDATE;
  IF v_convite IS NULL THEN
    RAISE EXCEPTION 'convite invalido ou vencido';
  END IF;
  PERFORM set_config('app.instituicao_id', v_inst::text, true);
  INSERT INTO instituicao (id, nome, tipo, situacao) VALUES (v_inst, 'Espaço individual', 'individual', 'ativa');
  INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES (v_usuario, v_inst, 'aluno', btrim(p_nome), btrim(p_email));
  INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES (v_inst, v_usuario, p_senha_hash);
  UPDATE convite_individual SET usado_em = now(), instituicao_id = v_inst WHERE id = v_convite;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN v_inst;
END $$;

CREATE FUNCTION instituicao_criar_por_convite(
  p_codigo_hash text, p_nome_instituicao text, p_nome_admin text, p_email text, p_senha_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_convite uuid; v_inst uuid := gen_random_uuid(); v_usuario uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_convite FROM convite_individual
   WHERE codigo_hash = p_codigo_hash AND tipo = 'instituicao' AND usado_em IS NULL AND expira_em > now() FOR UPDATE;
  IF v_convite IS NULL THEN
    RAISE EXCEPTION 'convite invalido ou vencido';
  END IF;
  PERFORM set_config('app.instituicao_id', v_inst::text, true);
  INSERT INTO instituicao (id, nome, tipo, situacao) VALUES (v_inst, btrim(p_nome_instituicao), 'escola', 'em_implantacao');
  INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES (v_usuario, v_inst, 'admin', btrim(p_nome_admin), btrim(p_email));
  INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES (v_inst, v_usuario, p_senha_hash);
  UPDATE convite_individual SET usado_em = now(), instituicao_id = v_inst WHERE id = v_convite;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN v_inst;
END $$;
REVOKE ALL ON FUNCTION instituicao_criar_por_convite(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION instituicao_criar_por_convite(text, text, text, text, text) TO siesal_app;
