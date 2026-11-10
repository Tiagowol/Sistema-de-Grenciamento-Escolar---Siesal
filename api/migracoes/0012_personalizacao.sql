-- Migração 0012 (L17b): personalização por usuário e tipos de atividade do aluno.
-- Cria preferencia_usuario (uma linha por aluno, sem dado sensível) e tipo_atividade (tipos próprios).
-- Acrescenta tipo_atividade_id em tarefa e evento. Nada se apaga: tipo some com desativado_em.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0012.md.

CREATE TABLE preferencia_usuario (
  instituicao_id     uuid        NOT NULL REFERENCES instituicao (id),
  usuario_id         uuid        NOT NULL,
  apelido            text        CHECK (apelido IS NULL OR (length(btrim(apelido)) BETWEEN 1 AND 40 AND apelido !~* '(https?:|www\.|://|@)')),
  cor_destaque       text        CHECK (cor_destaque IS NULL OR cor_destaque IN ('azul', 'verde', 'roxo', 'rosa', 'laranja', 'cinza')),
  tema               text        NOT NULL DEFAULT 'claro' CHECK (tema IN ('claro', 'escuro', 'alto_contraste')),
  fonte              integer     NOT NULL DEFAULT 100 CHECK (fonte BETWEEN 90 AND 150),
  reduzir_movimento  boolean     NOT NULL DEFAULT false,
  leitura_facilitada boolean     NOT NULL DEFAULT false,
  modo_simples       boolean     NOT NULL DEFAULT false,
  tempo_visual       boolean     NOT NULL DEFAULT true,
  linguagem_curta    boolean     NOT NULL DEFAULT false,
  escolha_agora      boolean     NOT NULL DEFAULT true,
  tela_inicial       text        NOT NULL DEFAULT 'meudia' CHECK (tela_inicial IN ('meudia', 'agenda', 'calendario')),
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, usuario_id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id)
);

CREATE TABLE tipo_atividade (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid        NOT NULL,
  nome           text        NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 40),
  cor            text        NOT NULL CHECK (cor IN ('azul', 'verde', 'roxo', 'rosa', 'laranja', 'cinza')),
  icone          text        NOT NULL CHECK (icone IN ('book', 'tasks', 'focus', 'spark', 'heart', 'school', 'clock', 'chart', 'file', 'message', 'calendar')),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id)
);
-- Cada aluno tem um nome de tipo só (sem diferença entre maiúscula e minúscula) entre os ativos
CREATE UNIQUE INDEX tipo_atividade_nome ON tipo_atividade (instituicao_id, usuario_id, lower(nome))
  WHERE desativado_em IS NULL;

ALTER TABLE tarefa ADD COLUMN tipo_atividade_id uuid;
ALTER TABLE tarefa ADD FOREIGN KEY (instituicao_id, tipo_atividade_id) REFERENCES tipo_atividade (instituicao_id, id);
ALTER TABLE evento ADD COLUMN tipo_atividade_id uuid;
ALTER TABLE evento ADD FOREIGN KEY (instituicao_id, tipo_atividade_id) REFERENCES tipo_atividade (instituicao_id, id);

-- RLS: instituição do contexto (withTenant). O filtro por dono (usuario_id) é feito na API e provado nos testes.
ALTER TABLE preferencia_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferencia_usuario FORCE ROW LEVEL SECURITY;
CREATE POLICY preferencia_usuario_da_instituicao ON preferencia_usuario
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
ALTER TABLE tipo_atividade ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_atividade FORCE ROW LEVEL SECURITY;
CREATE POLICY tipo_atividade_da_instituicao ON tipo_atividade
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON preferencia_usuario, tipo_atividade TO siesal_app;
