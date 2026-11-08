-- Migração 0004 (Lote 5): credenciais, sessões e códigos de recuperação dos usuários escolares.
-- Autenticação própria com node:crypto (plano B da ADR-004). Nenhum segredo aqui.

-- Senha (Argon2id, formato PHC), TOTP cifrado e controle de bloqueio. Uma por usuário.
CREATE TABLE credencial (
  instituicao_id       uuid        NOT NULL,
  usuario_id           uuid        NOT NULL,
  senha_hash           text        NOT NULL,
  totp_segredo_cifrado text,
  totp_ativo           boolean     NOT NULL DEFAULT false,
  totp_ultimo_passo    bigint,
  falhas_seguidas      integer     NOT NULL DEFAULT 0 CHECK (falhas_seguidas >= 0),
  bloqueado_ate        timestamptz,
  atualizado_em        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, usuario_id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id)
);

-- Sessão opaca: só o hash do token fica no banco. Revogar = preencher revogada_em.
CREATE TABLE sessao (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  instituicao_id uuid        NOT NULL,
  usuario_id     uuid        NOT NULL,
  token_hash     text        NOT NULL UNIQUE,
  nivel          text        NOT NULL CHECK (nivel IN ('completo', 'configurar_totp')),
  criada_em      timestamptz NOT NULL DEFAULT now(),
  expira_em      timestamptz NOT NULL,
  revogada_em    timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id)
);
CREATE INDEX sessao_usuario ON sessao (instituicao_id, usuario_id);

-- Códigos de recuperação do TOTP: só o hash; cada um vale uma vez
CREATE TABLE codigo_recuperacao (
  instituicao_id uuid        NOT NULL,
  usuario_id     uuid        NOT NULL,
  codigo_hash    text        NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  usado_em       timestamptz,
  PRIMARY KEY (instituicao_id, usuario_id, codigo_hash),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['credencial', 'sessao', 'codigo_recuperacao'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
      WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)$p$,
      t || '_da_instituicao', t);
    -- Sem DELETE: nada se apaga de verdade
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO siesal_app', t);
  END LOOP;
END $$;
