-- Migração 0026 (L22a-1b): cadastro próprio, login e sessão da PESSOA, acima dos espaços (docs/PROPOSTA-L22A-1B.md).
-- O login antigo (por instituição) continua igual. Aqui nasce o login de quem ainda não tem espaço (professor ou
-- pedagogo que se cadastrou sozinho) e a lista de espaços onde a pessoa participa.
-- Nada se apaga. Todas as tabelas novas: RLS forçada e só o dono lê; a aplicação usa só as funções SECURITY DEFINER.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0026.md.

-- Dados do cadastro próprio, na própria pessoa
ALTER TABLE pessoa
  ADD COLUMN papel_desejado text CHECK (papel_desejado IN ('professor', 'pedagogico')),
  ADD COLUMN termo_versao text,
  ADD COLUMN termo_aceito_em timestamptz;

-- Senha da pessoa (mesmas regras do login atual: 5 falhas seguidas bloqueiam por 15 minutos)
CREATE TABLE credencial_pessoa (
  pessoa_id       uuid        PRIMARY KEY REFERENCES pessoa (id),
  senha_hash      text        NOT NULL,
  falhas_seguidas integer     NOT NULL DEFAULT 0 CHECK (falhas_seguidas >= 0),
  bloqueado_ate   timestamptz,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE credencial_pessoa ENABLE ROW LEVEL SECURITY;
ALTER TABLE credencial_pessoa FORCE ROW LEVEL SECURITY;
CREATE POLICY credencial_pessoa_dono ON credencial_pessoa TO siesal_owner USING (true) WITH CHECK (true);

-- Sessão da pessoa: só o hash do token fica no banco
CREATE TABLE sessao_pessoa (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id   uuid        NOT NULL REFERENCES pessoa (id),
  token_hash  text        NOT NULL UNIQUE,
  criada_em   timestamptz NOT NULL DEFAULT now(),
  expira_em   timestamptz NOT NULL,
  revogada_em timestamptz
);
ALTER TABLE sessao_pessoa ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessao_pessoa FORCE ROW LEVEL SECURITY;
CREATE POLICY sessao_pessoa_dono ON sessao_pessoa TO siesal_owner USING (true) WITH CHECK (true);

-- Link de confirmação do e-mail (uso único, 24 horas, só o hash)
CREATE TABLE pedido_email_pessoa (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id     uuid        NOT NULL REFERENCES pessoa (id),
  token_hash    text        NOT NULL UNIQUE,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  expira_em     timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  confirmado_em timestamptz
);
ALTER TABLE pedido_email_pessoa ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_email_pessoa FORCE ROW LEVEL SECURITY;
CREATE POLICY pedido_email_pessoa_dono ON pedido_email_pessoa TO siesal_owner USING (true) WITH CHECK (true);

-- Índice pessoa -> espaço (só identificadores). Existe para listar os espaços de uma pessoa SEM dar ao dono uma política
-- ampla de leitura em `usuario` (isso inflaria contagens de funções que dependem da RLS por instituição).
-- Mantido por gatilho em `usuario`; só o dono lê.
CREATE TABLE pessoa_espaco (
  pessoa_id      uuid NOT NULL REFERENCES pessoa (id),
  instituicao_id uuid NOT NULL,
  usuario_id     uuid NOT NULL,
  PRIMARY KEY (instituicao_id, usuario_id)
);
CREATE INDEX pessoa_espaco_pessoa ON pessoa_espaco (pessoa_id);
ALTER TABLE pessoa_espaco ENABLE ROW LEVEL SECURITY;
ALTER TABLE pessoa_espaco FORCE ROW LEVEL SECURITY;
CREATE POLICY pessoa_espaco_dono ON pessoa_espaco TO siesal_owner USING (true) WITH CHECK (true);

CREATE FUNCTION usuario_manter_pessoa_espaco() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.pessoa_id IS NOT NULL THEN
    INSERT INTO pessoa_espaco (pessoa_id, instituicao_id, usuario_id)
    VALUES (NEW.pessoa_id, NEW.instituicao_id, NEW.id)
    ON CONFLICT (instituicao_id, usuario_id) DO UPDATE SET pessoa_id = EXCLUDED.pessoa_id;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION usuario_manter_pessoa_espaco() FROM PUBLIC;
CREATE TRIGGER usuario_pessoa_espaco_depois AFTER INSERT OR UPDATE OF pessoa_id ON usuario
  FOR EACH ROW EXECUTE FUNCTION usuario_manter_pessoa_espaco();

-- Preenche o índice com os usuários que já existem (instituição por instituição, por causa da RLS forçada: F-054)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM instituicao LOOP
    PERFORM set_config('app.instituicao_id', r.id::text, true);
    INSERT INTO pessoa_espaco (pessoa_id, instituicao_id, usuario_id)
    SELECT pessoa_id, instituicao_id, id FROM usuario WHERE instituicao_id = r.id AND pessoa_id IS NOT NULL
    ON CONFLICT (instituicao_id, usuario_id) DO NOTHING;
  END LOOP;
  PERFORM set_config('app.instituicao_id', '', true);
END $$;

-- Cadastro próprio. Devolve 'ok' (cadastro novo ou pendente refeito) ou 'ja_existe' (e-mail já confirmado por outra
-- conta). A API responde igual nos dois casos: não revela quem tem conta.
CREATE FUNCTION pessoa_cadastrar(
  p_nome text, p_email text, p_senha_hash text, p_papel text, p_termo_versao text, p_token_hash text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_pessoa uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM pessoa WHERE lower(email) = lower(p_email) AND email_confirmado_em IS NOT NULL) THEN
    RETURN 'ja_existe';
  END IF;
  -- cadastro pendente do mesmo e-mail (com senha, sem confirmação): refaz
  SELECT p.id INTO v_pessoa FROM pessoa p JOIN credencial_pessoa c ON c.pessoa_id = p.id
   WHERE lower(p.email) = lower(p_email) AND p.email_confirmado_em IS NULL
     AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.pessoa_id = p.id)
   ORDER BY p.criada_em DESC LIMIT 1;
  IF v_pessoa IS NULL THEN
    INSERT INTO pessoa (nome, email, papel_desejado, termo_versao, termo_aceito_em)
    VALUES (p_nome, p_email, p_papel, p_termo_versao, now()) RETURNING id INTO v_pessoa;
    INSERT INTO credencial_pessoa (pessoa_id, senha_hash) VALUES (v_pessoa, p_senha_hash);
  ELSE
    UPDATE pessoa SET nome = p_nome, papel_desejado = p_papel, termo_versao = p_termo_versao, termo_aceito_em = now()
     WHERE id = v_pessoa;
    UPDATE credencial_pessoa SET senha_hash = p_senha_hash, falhas_seguidas = 0, bloqueado_ate = NULL,
           atualizado_em = now() WHERE pessoa_id = v_pessoa;
    UPDATE pedido_email_pessoa SET expira_em = now() WHERE pessoa_id = v_pessoa AND confirmado_em IS NULL;
  END IF;
  INSERT INTO pedido_email_pessoa (pessoa_id, token_hash) VALUES (v_pessoa, p_token_hash);
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION pessoa_cadastrar(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pessoa_cadastrar(text, text, text, text, text, text) TO siesal_app;

-- Confirma o e-mail pelo link. Falso se o link venceu, já foi usado ou o e-mail já foi confirmado por outra conta.
CREATE FUNCTION pessoa_confirmar_email(p_token_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_pedido uuid; v_pessoa uuid;
BEGIN
  SELECT id, pessoa_id INTO v_pedido, v_pessoa FROM pedido_email_pessoa
   WHERE token_hash = p_token_hash AND confirmado_em IS NULL AND expira_em > now() FOR UPDATE;
  IF v_pedido IS NULL THEN RETURN false; END IF;
  BEGIN
    UPDATE pessoa SET email_confirmado_em = now() WHERE id = v_pessoa AND desativada_em IS NULL;
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;
  UPDATE pedido_email_pessoa SET confirmado_em = now() WHERE id = v_pedido;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION pessoa_confirmar_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pessoa_confirmar_email(text) TO siesal_app;

-- Dados para conferir a senha. Só pessoa ativa, com e-mail confirmado e senha.
CREATE FUNCTION pessoa_credencial(p_email text)
RETURNS TABLE (pessoa_id uuid, nome text, senha_hash text, bloqueado_ate timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.id, p.nome, c.senha_hash, c.bloqueado_ate
    FROM pessoa p JOIN credencial_pessoa c ON c.pessoa_id = p.id
   WHERE lower(p.email) = lower(p_email) AND p.email_confirmado_em IS NOT NULL AND p.desativada_em IS NULL
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION pessoa_credencial(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pessoa_credencial(text) TO siesal_app;

-- Conta uma falha; na quinta seguida bloqueia por 15 minutos. Devolve se bloqueou agora.
CREATE FUNCTION pessoa_registrar_falha(p_pessoa uuid, p_max integer, p_minutos integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v integer;
BEGIN
  UPDATE credencial_pessoa SET falhas_seguidas = falhas_seguidas + 1, atualizado_em = now()
   WHERE pessoa_id = p_pessoa RETURNING falhas_seguidas INTO v;
  IF v IS NOT NULL AND v >= p_max THEN
    UPDATE credencial_pessoa SET falhas_seguidas = 0, bloqueado_ate = now() + make_interval(mins => p_minutos)
     WHERE pessoa_id = p_pessoa;
    RETURN true;
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION pessoa_registrar_falha(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pessoa_registrar_falha(uuid, integer, integer) TO siesal_app;

-- Abre a sessão da pessoa (zera as falhas) e devolve nada; o token (só o hash) vem da API.
CREATE FUNCTION pessoa_sessao_abrir(p_pessoa uuid, p_token_hash text, p_segundos integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE credencial_pessoa SET falhas_seguidas = 0, bloqueado_ate = NULL, atualizado_em = now() WHERE pessoa_id = p_pessoa;
  INSERT INTO sessao_pessoa (pessoa_id, token_hash, expira_em) VALUES (p_pessoa, p_token_hash, now() + make_interval(secs => p_segundos));
END $$;
REVOKE ALL ON FUNCTION pessoa_sessao_abrir(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pessoa_sessao_abrir(uuid, text, integer) TO siesal_app;

CREATE FUNCTION pessoa_sessao_obter(p_token_hash text) RETURNS TABLE (pessoa_id uuid, nome text, email text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.id, p.nome, p.email FROM sessao_pessoa s JOIN pessoa p ON p.id = s.pessoa_id
   WHERE s.token_hash = p_token_hash AND s.revogada_em IS NULL AND s.expira_em > now() AND p.desativada_em IS NULL
$$;
REVOKE ALL ON FUNCTION pessoa_sessao_obter(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pessoa_sessao_obter(text) TO siesal_app;

CREATE FUNCTION pessoa_sessao_encerrar(p_token_hash text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE sessao_pessoa SET revogada_em = now() WHERE token_hash = p_token_hash AND revogada_em IS NULL
$$;
REVOKE ALL ON FUNCTION pessoa_sessao_encerrar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pessoa_sessao_encerrar(text) TO siesal_app;

-- Espaços onde a pessoa participa e pode entrar: usuário ativo, instituição ativa, perfil professor ou pedagógico
-- (o Admin entra só pelo login antigo, com autenticador; o Responsável entra pelo L22a-1c). A função entra em cada espaço
-- da pessoa, um por vez, e lê sob a RLS normal (sem política ampla).
CREATE FUNCTION pessoa_espacos(p_pessoa uuid)
RETURNS TABLE (instituicao_id uuid, instituicao_nome text, tipo text, perfil text, usuario_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT pe.instituicao_id AS inst, pe.usuario_id AS usr FROM pessoa_espaco pe WHERE pe.pessoa_id = p_pessoa LOOP
    PERFORM set_config('app.instituicao_id', r.inst::text, true);
    RETURN QUERY
      SELECT i.id, i.nome, i.tipo, u.perfil, u.id
        FROM usuario u JOIN instituicao i ON i.id = u.instituicao_id
       WHERE u.instituicao_id = r.inst AND u.id = r.usr AND u.pessoa_id = p_pessoa
         AND u.situacao = 'ativo' AND i.situacao = 'ativa' AND u.perfil IN ('professor', 'pedagogico');
  END LOOP;
  PERFORM set_config('app.instituicao_id', '', true);
END $$;
REVOKE ALL ON FUNCTION pessoa_espacos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pessoa_espacos(uuid) TO siesal_app;
