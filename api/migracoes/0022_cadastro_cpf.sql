-- Migração 0022 (20c-2): data de nascimento, CPF cifrado, menor de 18 anos com autorização do responsável.
-- Só dados fictícios na Parte 1. O CPF nunca é guardado em texto claro: vai cifrado (AES-256-GCM, feito pela API) e com um
-- índice HMAC; a máscara usa só os 2 últimos dígitos. Menor de 18 fica "aguardando_responsavel" e não entra até o responsável
-- confirmar o link (uso único, 7 dias). Pedido vencido: os dados do pedido e do aluno são apagados e a conta fica inativa.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0022.md.

-- A situação nova da conta (a restrição de 0001 não tinha nome conhecido: acha e troca)
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'usuario'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%situacao%'
  LOOP
    EXECUTE format('ALTER TABLE usuario DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE usuario ADD CONSTRAINT usuario_situacao_check
  CHECK (situacao IN ('ativo', 'inativo', 'aguardando_responsavel'));

-- Dados do aluno. A aplicação só lê (a própria linha, pela RLS da instituição); quem grava são as funções abaixo.
CREATE TABLE aluno_dados (
  instituicao_id uuid        NOT NULL,
  usuario_id     uuid        NOT NULL,
  nascimento     date        NOT NULL CHECK (nascimento >= DATE '1900-01-01'),
  cpf_cifrado    text,
  cpf_hmac       text,
  cpf_final      text        CHECK (cpf_final ~ '^[0-9]{2}$'),
  matricula      text        CHECK (length(matricula) <= 40),
  escolas        text        CHECK (length(escolas) <= 200),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, usuario_id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id),
  CHECK ((cpf_cifrado IS NULL) = (cpf_hmac IS NULL) AND (cpf_cifrado IS NULL) = (cpf_final IS NULL))
);
ALTER TABLE aluno_dados ENABLE ROW LEVEL SECURITY;
ALTER TABLE aluno_dados FORCE ROW LEVEL SECURITY;
CREATE POLICY aluno_dados_da_instituicao ON aluno_dados FOR SELECT TO siesal_app
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
CREATE POLICY aluno_dados_dono ON aluno_dados TO siesal_owner USING (true) WITH CHECK (true);
GRANT SELECT ON aluno_dados TO siesal_app;

-- Pedido de autorização do responsável (menor de 18 anos). O link vale uma vez e só o hash dele é guardado.
-- Nenhum papel da aplicação lê esta tabela: só as funções abaixo (SECURITY DEFINER).
CREATE TABLE pedido_responsavel (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id   uuid        NOT NULL,
  usuario_id       uuid        NOT NULL,
  token_hash       text        NOT NULL UNIQUE,
  resp_nome        text        NOT NULL CHECK (length(btrim(resp_nome)) BETWEEN 2 AND 80),
  resp_email       text        NOT NULL CHECK (length(btrim(resp_email)) > 0),
  resp_nascimento  date        NOT NULL,
  resp_cpf_cifrado text        NOT NULL,
  resp_cpf_hmac    text        NOT NULL,
  resp_cpf_final   text        NOT NULL CHECK (resp_cpf_final ~ '^[0-9]{2}$'),
  criado_em        timestamptz NOT NULL DEFAULT now(),
  expira_em        timestamptz NOT NULL DEFAULT now() + interval '7 days',
  confirmado_em    timestamptz,
  termo_versao     text,
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id),
  CHECK ((confirmado_em IS NULL) = (termo_versao IS NULL))
);
CREATE INDEX pedido_responsavel_expira ON pedido_responsavel (expira_em) WHERE confirmado_em IS NULL;
ALTER TABLE pedido_responsavel ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_responsavel FORCE ROW LEVEL SECURITY;
CREATE POLICY pedido_responsavel_dono ON pedido_responsavel TO siesal_owner USING (true) WITH CHECK (true);

-- Cria o espaço individual, o aluno, a senha, os dados e (se menor) o pedido do responsável, numa transação só.
-- Convite inválido, vencido ou usado e e-mail já em uso dão o mesmo erro (a API responde igual para todos).
CREATE FUNCTION cadastro_aluno_criar(
  p_codigo_hash text, p_nome text, p_email text, p_senha_hash text, p_nascimento date,
  p_aluno jsonb, p_pedido jsonb, p_token_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_convite uuid; v_inst uuid := gen_random_uuid(); v_usuario uuid := gen_random_uuid();
  v_situacao text := CASE WHEN p_pedido IS NULL THEN 'ativo' ELSE 'aguardando_responsavel' END;
BEGIN
  SELECT id INTO v_convite FROM convite_individual
   WHERE codigo_hash = p_codigo_hash AND tipo = 'individual' AND usado_em IS NULL AND expira_em > now() FOR UPDATE;
  IF v_convite IS NULL THEN
    RAISE EXCEPTION 'convite invalido ou vencido';
  END IF;
  -- Conta aguardando ainda não entra no índice de e-mails: confere aqui para não falhar só na confirmação
  IF EXISTS (SELECT 1 FROM espaco_individual WHERE email_busca = lower(btrim(p_email))) THEN
    RAISE EXCEPTION 'e-mail em uso';
  END IF;
  PERFORM set_config('app.instituicao_id', v_inst::text, true);
  INSERT INTO instituicao (id, nome, tipo, situacao) VALUES (v_inst, 'Espaço individual', 'individual', 'ativa');
  INSERT INTO usuario (id, instituicao_id, perfil, nome, email, situacao)
    VALUES (v_usuario, v_inst, 'aluno', btrim(p_nome), btrim(p_email), v_situacao);
  INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES (v_inst, v_usuario, p_senha_hash);
  INSERT INTO aluno_dados (instituicao_id, usuario_id, nascimento, cpf_cifrado, cpf_hmac, cpf_final, matricula, escolas)
    VALUES (v_inst, v_usuario, p_nascimento, p_aluno->>'cpf_cifrado', p_aluno->>'cpf_hmac', p_aluno->>'cpf_final',
            nullif(btrim(p_aluno->>'matricula'), ''), nullif(btrim(p_aluno->>'escolas'), ''));
  IF p_pedido IS NOT NULL THEN
    INSERT INTO pedido_responsavel (instituicao_id, usuario_id, token_hash, resp_nome, resp_email, resp_nascimento,
                                    resp_cpf_cifrado, resp_cpf_hmac, resp_cpf_final)
      VALUES (v_inst, v_usuario, p_token_hash, btrim(p_pedido->>'nome'), btrim(p_pedido->>'email'),
              (p_pedido->>'nascimento')::date, p_pedido->>'cpf_cifrado', p_pedido->>'cpf_hmac', p_pedido->>'cpf_final');
  END IF;
  UPDATE convite_individual SET usado_em = now(), instituicao_id = v_inst WHERE id = v_convite;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN v_inst;
END $$;
REVOKE ALL ON FUNCTION cadastro_aluno_criar(text, text, text, text, date, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cadastro_aluno_criar(text, text, text, text, date, jsonb, jsonb, text) TO siesal_app;

-- Apaga o que venceu sem confirmação: pedido e dados do aluno saem; a conta fica inativa (nada de usuário se apaga).
CREATE FUNCTION pedido_responsavel_limpar() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id, instituicao_id, usuario_id FROM pedido_responsavel
            WHERE confirmado_em IS NULL AND expira_em <= now() FOR UPDATE
  LOOP
    PERFORM set_config('app.instituicao_id', r.instituicao_id::text, true);
    DELETE FROM pedido_responsavel WHERE id = r.id;
    DELETE FROM aluno_dados WHERE instituicao_id = r.instituicao_id AND usuario_id = r.usuario_id;
    UPDATE usuario SET situacao = 'inativo', desativado_em = now()
     WHERE instituicao_id = r.instituicao_id AND id = r.usuario_id AND situacao = 'aguardando_responsavel';
    n := n + 1;
  END LOOP;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION pedido_responsavel_limpar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_responsavel_limpar() TO siesal_app;

-- Mostra ao responsável só o necessário para decidir: nome do aluno, o próprio nome e até quando vale. Nunca CPF.
CREATE FUNCTION pedido_responsavel_consultar(p_token_hash text)
RETURNS TABLE (aluno_nome text, resp_nome text, expira_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inst uuid;
BEGIN
  SELECT p.instituicao_id INTO v_inst FROM pedido_responsavel p
   WHERE p.token_hash = p_token_hash AND p.confirmado_em IS NULL AND p.expira_em > now();
  IF v_inst IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.instituicao_id', v_inst::text, true);
  RETURN QUERY
    SELECT u.nome, p.resp_nome, p.expira_em
      FROM pedido_responsavel p
      JOIN usuario u ON u.instituicao_id = p.instituicao_id AND u.id = p.usuario_id
     WHERE p.token_hash = p_token_hash;
  PERFORM set_config('app.instituicao_id', '', true);
END $$;
REVOKE ALL ON FUNCTION pedido_responsavel_consultar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_responsavel_consultar(text) TO siesal_app;

-- Confirma: guarda a versão do termo e a hora, e libera a conta do aluno. Uso único; vencido ou já usado não confirma.
CREATE FUNCTION pedido_responsavel_confirmar(p_token_hash text, p_termo text)
RETURNS TABLE (instituicao_id uuid, usuario_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; v_inst uuid; v_usuario uuid;
BEGIN
  SELECT p.id, p.instituicao_id, p.usuario_id INTO v_id, v_inst, v_usuario FROM pedido_responsavel p
   WHERE p.token_hash = p_token_hash AND p.confirmado_em IS NULL AND p.expira_em > now() FOR UPDATE;
  IF v_id IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.instituicao_id', v_inst::text, true);
  UPDATE pedido_responsavel SET confirmado_em = now(), termo_versao = p_termo WHERE id = v_id;
  UPDATE usuario SET situacao = 'ativo' WHERE usuario.instituicao_id = v_inst AND id = v_usuario;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN QUERY SELECT v_inst, v_usuario;
END $$;
REVOKE ALL ON FUNCTION pedido_responsavel_confirmar(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_responsavel_confirmar(text, text) TO siesal_app;
