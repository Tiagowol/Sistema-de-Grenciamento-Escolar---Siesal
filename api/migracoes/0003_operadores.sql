-- Migração 0003 (Lote 4, item 3): os 2 Masters da plataforma (ADR-004), fora do modelo escolar.
-- A tabela mantém o nome operator_account da ADR. Os nomes de usuário vêm do comando de instalação.

CREATE TABLE operator_account (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vaga          smallint    NOT NULL CHECK (vaga IN (1, 2)),
  usuario       text        NOT NULL CHECK (usuario ~ '^[a-z0-9_]{3,32}$'),
  senha_hash    text,
  situacao      text        NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'ativo', 'inativo')),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  desativado_em timestamptz
);

-- No máximo 1 conta viva por vaga (logo, no máximo 2 Masters) e nome de usuário único
CREATE UNIQUE INDEX operator_account_vaga_viva ON operator_account (vaga)
  WHERE situacao IN ('pendente', 'ativo');
CREATE UNIQUE INDEX operator_account_usuario ON operator_account (lower(usuario));

-- Defesa em profundidade: mesmo que alguém dê GRANT por engano, só o papel de operação passa
ALTER TABLE operator_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_account FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_account_operacao ON operator_account TO siesal_ops USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON operator_account TO siesal_ops;

-- O papel de operação cria e suspende instituições, mas NÃO recebe nenhuma permissão em tabela escolar
CREATE POLICY instituicao_operacao ON instituicao TO siesal_ops USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON instituicao TO siesal_ops;
