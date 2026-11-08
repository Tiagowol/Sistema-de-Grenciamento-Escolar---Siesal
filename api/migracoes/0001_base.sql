-- Migração 0001 (Lote 3): tabelas base, RLS e permissões do papel da aplicação.
-- Roda como siesal_owner (SET ROLE feito pelo job migrate). Nenhuma senha aqui.

-- Instituições (escolas). Nada se apaga de verdade: usa-se desativado_em.
CREATE TABLE instituicao (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text        NOT NULL CHECK (length(btrim(nome)) > 0),
  situacao      text        NOT NULL DEFAULT 'ativa' CHECK (situacao IN ('ativa', 'suspensa')),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  desativado_em timestamptz
);

-- Usuários escolares. O master NÃO fica aqui: terá tabela própria (ADR-004).
CREATE TABLE usuario (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  perfil         text        NOT NULL CHECK (perfil IN ('admin', 'professor', 'aluno', 'pedagogico', 'responsavel')),
  nome           text        NOT NULL CHECK (length(btrim(nome)) > 0),
  email          text        NOT NULL CHECK (length(btrim(email)) > 0),
  situacao       text        NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'inativo')),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id),
  UNIQUE (instituicao_id, email)
);

-- RLS: a instituição vem de app.instituicao_id, definida por transação (withTenant).
-- Sem valor definido, o resultado é NULL e nenhuma linha passa (nega por padrão).
ALTER TABLE instituicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE instituicao FORCE ROW LEVEL SECURITY;
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario FORCE ROW LEVEL SECURITY;

CREATE POLICY instituicao_propria ON instituicao
  FOR SELECT
  USING (id = nullif(current_setting('app.instituicao_id', true), '')::uuid);

CREATE POLICY usuario_da_instituicao ON usuario
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);

-- Permissões mínimas do papel da aplicação: sem DELETE (exclusão é lógica) e sem escrita em instituicao.
GRANT SELECT ON instituicao TO siesal_app;
GRANT SELECT, INSERT, UPDATE ON usuario TO siesal_app;
