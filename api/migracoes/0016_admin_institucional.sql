-- Migração 0016 (L19): Admin institucional. Calendário escolar, regras de notas versionadas e identidade visual.
-- Nada se apaga: itens do calendário são desativados; regras e identidade só ganham versões novas (append-only).
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0016.md.

-- Bloqueio comum das tabelas append-only deste lote
CREATE FUNCTION l19_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% é append-only: % não é permitido', TG_TABLE_NAME, TG_OP;
END $$;

-- 1. Calendário escolar: períodos letivos, feriados e eventos. turma_id vazio = escola toda.
CREATE TABLE calendario_escolar (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  tipo           text        NOT NULL CHECK (tipo IN ('periodo_letivo', 'feriado', 'evento')),
  titulo         text        NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 120),
  dia_inicio     date        NOT NULL,
  dia_fim        date        NOT NULL,
  turma_id       uuid,
  criado_por     uuid        NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, turma_id)   REFERENCES turma (instituicao_id, id),
  FOREIGN KEY (instituicao_id, criado_por) REFERENCES usuario (instituicao_id, id),
  CHECK (dia_fim >= dia_inicio AND dia_fim - dia_inicio <= 400)
);
CREATE INDEX calendario_escolar_dias ON calendario_escolar (instituicao_id, dia_inicio, dia_fim);

CREATE TABLE calendario_escolar_versao (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  item_id        uuid        NOT NULL,
  versao         integer     NOT NULL CHECK (versao >= 1),
  acao           text        NOT NULL CHECK (acao IN ('criado', 'editado', 'desativado')),
  tipo           text        NOT NULL,
  titulo         text        NOT NULL,
  dia_inicio     date        NOT NULL,
  dia_fim        date        NOT NULL,
  turma_id       uuid,
  autor_id       uuid        NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, item_id, versao),
  FOREIGN KEY (instituicao_id, item_id)  REFERENCES calendario_escolar (instituicao_id, id),
  FOREIGN KEY (instituicao_id, autor_id) REFERENCES usuario (instituicao_id, id)
);
CREATE TRIGGER calendario_escolar_versao_sem_alterar BEFORE UPDATE OR DELETE ON calendario_escolar_versao
  FOR EACH ROW EXECUTE FUNCTION l19_append_only();

-- O aluno oculta um item da escola só para si (o item continua para os outros)
CREATE TABLE calendario_escolar_oculto (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  item_id        uuid        NOT NULL,
  usuario_id     uuid        NOT NULL,
  oculto_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, item_id, usuario_id),
  FOREIGN KEY (instituicao_id, item_id)    REFERENCES calendario_escolar (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id)
);
CREATE TRIGGER calendario_escolar_oculto_sem_alterar BEFORE UPDATE OR DELETE ON calendario_escolar_oculto
  FOR EACH ROW EXECUTE FUNCTION l19_append_only();

-- 2. Regras de notas: cada versão é imutável e vale a partir de vigente_desde.
-- periodos = lista de { nome, inicio, fim, peso }; a API valida o formato e a ordem.
CREATE TABLE regra_nota_versao (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  numero         integer     NOT NULL CHECK (numero >= 1),
  vigente_desde  date        NOT NULL,
  arredondamento text        NOT NULL CHECK (arredondamento IN ('nenhum', 'decimo', 'meio')),
  periodos       jsonb       NOT NULL CHECK (jsonb_typeof(periodos) = 'array' AND jsonb_array_length(periodos) BETWEEN 1 AND 8),
  autor_id       uuid        NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, numero),
  FOREIGN KEY (instituicao_id, autor_id) REFERENCES usuario (instituicao_id, id)
);
CREATE TRIGGER regra_nota_versao_sem_alterar BEFORE UPDATE OR DELETE ON regra_nota_versao
  FOR EACH ROW EXECUTE FUNCTION l19_append_only();

-- O lançamento e a revisão citam a versão da regra vigente no dia da nota (vazio nas notas antigas)
ALTER TABLE nota_oficial_versao ADD COLUMN regra_numero integer;
ALTER TABLE nota_oficial_versao ADD CONSTRAINT nota_oficial_versao_regra
  FOREIGN KEY (instituicao_id, regra_numero) REFERENCES regra_nota_versao (instituicao_id, numero);

-- 3. Identidade visual: nome de exibição, cor da escola (uma para tema claro, uma para tema escuro) e logotipo
CREATE TABLE identidade_instituicao_versao (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  numero         integer     NOT NULL CHECK (numero >= 1),
  nome_exibicao  text        NOT NULL CHECK (length(btrim(nome_exibicao)) BETWEEN 1 AND 80),
  cor_claro      text        CHECK (cor_claro ~ '^#[0-9a-f]{6}$'),
  cor_escuro     text        CHECK (cor_escuro ~ '^#[0-9a-f]{6}$'),
  logotipo       bytea       CHECK (octet_length(logotipo) <= 204800),
  logotipo_tipo  text        CHECK (logotipo_tipo IN ('image/png', 'image/jpeg')),
  autor_id       uuid        NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, numero),
  FOREIGN KEY (instituicao_id, autor_id) REFERENCES usuario (instituicao_id, id),
  CHECK ((logotipo IS NULL) = (logotipo_tipo IS NULL))
);
CREATE TRIGGER identidade_instituicao_versao_sem_alterar BEFORE UPDATE OR DELETE ON identidade_instituicao_versao
  FOR EACH ROW EXECUTE FUNCTION l19_append_only();

-- RLS: tudo preso à instituição do contexto (withTenant)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['calendario_escolar', 'calendario_escolar_versao', 'calendario_escolar_oculto',
                           'regra_nota_versao', 'identidade_instituicao_versao'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
      WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)$p$,
      t || '_da_instituicao', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON calendario_escolar TO siesal_app;
GRANT SELECT, INSERT ON calendario_escolar_versao, calendario_escolar_oculto,
                        regra_nota_versao, identidade_instituicao_versao TO siesal_app;
