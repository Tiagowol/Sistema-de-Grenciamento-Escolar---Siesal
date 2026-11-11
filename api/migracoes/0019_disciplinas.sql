-- Migração 0019 (L20b): catálogo de disciplinas e disciplinas do aluno.
-- Cria disciplina_catalogo (global, só leitura, sem dado pessoal, versão 1) e disciplina_aluno (por aluno, com RLS),
-- guarda a etapa do aluno, liga tarefa e nota_pessoal a uma disciplina do aluno e converte os textos já usados.
-- Nada se apaga: a coluna de texto "disciplina" continua em tarefa e nota_pessoal (histórico).
-- D6 (A-050): o catálogo v1 traz só o confirmado (BNCC, LDB e nomes confirmados do Técnico em Informática do IFRN).
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0019.md.

-- Texto sem acento e em minúsculas, para busca e para nome repetido
CREATE FUNCTION sem_acento(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(translate(btrim(t),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))
$$;

CREATE TABLE disciplina_catalogo (
  id             integer     PRIMARY KEY,
  nome           text        NOT NULL UNIQUE CHECK (length(btrim(nome)) BETWEEN 1 AND 120),
  nome_busca     text        GENERATED ALWAYS AS (sem_acento(nome)) STORED,
  etapas         text[]      NOT NULL CHECK (etapas <@ ARRAY['fundamental', 'medio', 'tecnico']),
  gerais_em      text[]      NOT NULL DEFAULT '{}' CHECK (gerais_em <@ ARRAY['fundamental', 'medio', 'tecnico']),
  curso          text,
  sinonimos      text[]      NOT NULL DEFAULT '{}',
  origem         text        NOT NULL DEFAULT 'catalogo' CHECK (origem = 'catalogo'),
  codigo_externo text,
  versao         integer     NOT NULL DEFAULT 1
);

INSERT INTO disciplina_catalogo (id, nome, etapas, gerais_em, curso, sinonimos) VALUES
  -- Ensino Fundamental, anos finais, e formação geral comum [BNCC]
  (1,  'Língua Portuguesa',  ARRAY['fundamental', 'medio', 'tecnico'], ARRAY['fundamental', 'medio', 'tecnico'], NULL, ARRAY['Português']),
  (2,  'Arte',               ARRAY['fundamental', 'medio', 'tecnico'], ARRAY['fundamental', 'medio', 'tecnico'], NULL, ARRAY['Artes']),
  (3,  'Educação Física',    ARRAY['fundamental', 'medio', 'tecnico'], ARRAY['fundamental', 'medio', 'tecnico'], NULL, ARRAY['Ed. Física', 'Ed Física']),
  (4,  'Língua Inglesa',     ARRAY['fundamental', 'medio', 'tecnico'], ARRAY['fundamental', 'medio', 'tecnico'], NULL, ARRAY['Inglês']),
  (5,  'Matemática',         ARRAY['fundamental', 'medio', 'tecnico'], ARRAY['fundamental', 'medio', 'tecnico'], NULL, ARRAY[]::text[]),
  (6,  'Ciências',           ARRAY['fundamental'],                     ARRAY['fundamental'],                     NULL, ARRAY['Ciências da Natureza']),
  (7,  'Geografia',          ARRAY['fundamental', 'medio', 'tecnico'], ARRAY['fundamental', 'medio', 'tecnico'], NULL, ARRAY[]::text[]),
  (8,  'História',           ARRAY['fundamental', 'medio', 'tecnico'], ARRAY['fundamental', 'medio', 'tecnico'], NULL, ARRAY[]::text[]),
  (9,  'Ensino Religioso',   ARRAY['fundamental'],                     ARRAY[]::text[],                          NULL, ARRAY[]::text[]),
  -- Ensino Médio, formação geral (componentes da LDB e da BNCC)
  (10, 'Física',             ARRAY['medio', 'tecnico'],                ARRAY['medio', 'tecnico'],                NULL, ARRAY[]::text[]),
  (11, 'Química',            ARRAY['medio', 'tecnico'],                ARRAY['medio', 'tecnico'],                NULL, ARRAY[]::text[]),
  (12, 'Biologia',           ARRAY['medio', 'tecnico'],                ARRAY['medio', 'tecnico'],                NULL, ARRAY[]::text[]),
  (13, 'Filosofia',          ARRAY['medio', 'tecnico'],                ARRAY[]::text[],                          NULL, ARRAY[]::text[]),
  (14, 'Sociologia',         ARRAY['medio', 'tecnico'],                ARRAY[]::text[],                          NULL, ARRAY[]::text[]),
  -- IFRN, Técnico Integrado em Informática [confirmado em página de docente do IFRN, 10/11/2026]
  (20, 'Informática',                                                                  ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY[]::text[]),
  (21, 'Fundamentos de Lógica e Algoritmos',                                           ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY['FLA']),
  (22, 'Programação Estruturada e Orientada a Objetos',                                ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY['POO']),
  (23, 'Programação com Acesso a Banco de Dados',                                      ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY[]::text[]),
  (24, 'Autoria Web',                                                                  ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY[]::text[]),
  (25, 'Programação para Internet',                                                    ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY[]::text[]),
  (26, 'Projeto de Desenvolvimento de Software',                                       ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY[]::text[]),
  (27, 'Arquitetura de Redes de Computadores e Tecnologia de Implementação de Redes', ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY['Redes']),
  (28, 'Fundamentos de Sistemas Operacionais e Sistemas Operacionais de Redes',        ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY['SO']),
  (29, 'Eletricidade Instrumental',                                                    ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY[]::text[]),
  (30, 'Eletrônica Analógica e Digital',                                               ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY[]::text[]),
  (31, 'Organização e Manutenção de Computadores',                                     ARRAY['tecnico'], ARRAY[]::text[], 'Técnico em Informática', ARRAY[]::text[]);

-- Catálogo: tabela global sem dado pessoal. RLS ligada e forçada (regra do esquema), só leitura para a aplicação.
ALTER TABLE disciplina_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplina_catalogo FORCE ROW LEVEL SECURITY;
CREATE POLICY disciplina_catalogo_leitura ON disciplina_catalogo FOR SELECT USING (true);
GRANT SELECT ON disciplina_catalogo TO siesal_app;

CREATE TABLE disciplina_aluno (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid        NOT NULL,
  nome           text        NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 80 AND nome !~* '(https?:|www\.|://|@)'),
  nome_busca     text        GENERATED ALWAYS AS (sem_acento(nome)) STORED,
  catalogo_id    integer     REFERENCES disciplina_catalogo (id),
  origem         text        NOT NULL CHECK (origem IN ('catalogo', 'propria', 'escola', 'suap')),
  codigo_externo text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id),
  CHECK ((origem = 'catalogo') = (catalogo_id IS NOT NULL))
);
-- Cada aluno tem um nome só (sem diferença de maiúscula e acento) entre as ativas
CREATE UNIQUE INDEX disciplina_aluno_nome ON disciplina_aluno (instituicao_id, usuario_id, nome_busca)
  WHERE desativado_em IS NULL;
CREATE INDEX disciplina_aluno_dono ON disciplina_aluno (instituicao_id, usuario_id) WHERE desativado_em IS NULL;

-- Limite no banco (além da API): no máximo 20 disciplinas próprias ativas por aluno.
-- As do catálogo, da escola e do SUAP não contam.
CREATE FUNCTION disciplina_aluno_limite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.origem = 'propria' AND NEW.desativado_em IS NULL AND (
       SELECT count(*) FROM disciplina_aluno
        WHERE instituicao_id = NEW.instituicao_id AND usuario_id = NEW.usuario_id
          AND origem = 'propria' AND desativado_em IS NULL AND id <> NEW.id) >= 20 THEN
    RAISE EXCEPTION 'limite de 20 disciplinas próprias por aluno' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER disciplina_aluno_limite BEFORE INSERT OR UPDATE ON disciplina_aluno
  FOR EACH ROW EXECUTE FUNCTION disciplina_aluno_limite();

ALTER TABLE disciplina_aluno ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplina_aluno FORCE ROW LEVEL SECURITY;
CREATE POLICY disciplina_aluno_da_instituicao ON disciplina_aluno
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON disciplina_aluno TO siesal_app;

-- Etapa do aluno para as disciplinas (escolhida em Personalizar; o cadastro do L20c passa a pedir)
ALTER TABLE preferencia_usuario ADD COLUMN etapa_disciplinas text
  CHECK (etapa_disciplinas IS NULL OR etapa_disciplinas IN ('fundamental', 'medio', 'tecnico'));

-- Tarefa e nota pessoal ligam a uma disciplina do aluno (opcional; o texto antigo fica)
ALTER TABLE tarefa ADD COLUMN disciplina_aluno_id uuid;
ALTER TABLE tarefa ADD FOREIGN KEY (instituicao_id, disciplina_aluno_id) REFERENCES disciplina_aluno (instituicao_id, id);
ALTER TABLE nota_pessoal ADD COLUMN disciplina_aluno_id uuid;
ALTER TABLE nota_pessoal ADD FOREIGN KEY (instituicao_id, disciplina_aluno_id) REFERENCES disciplina_aluno (instituicao_id, id);

-- Conversão dos textos já usados. 1) o que é igual a uma do catálogo vira "catalogo";
-- 2) o resto vira "propria", até 20 por aluno (as mais usadas primeiro); o que passar do limite continua só como texto.
WITH usados AS (
  SELECT instituicao_id, usuario_id, disciplina FROM tarefa WHERE desativado_em IS NULL AND btrim(disciplina) <> ''
  UNION ALL
  SELECT instituicao_id, usuario_id, disciplina FROM nota_pessoal WHERE desativado_em IS NULL AND btrim(disciplina) <> ''
), contados AS (
  SELECT instituicao_id, usuario_id, sem_acento(disciplina) AS chave
    FROM usados GROUP BY instituicao_id, usuario_id, sem_acento(disciplina)
)
INSERT INTO disciplina_aluno (instituicao_id, usuario_id, nome, catalogo_id, origem)
SELECT c.instituicao_id, c.usuario_id, k.nome, k.id, 'catalogo'
  FROM contados c JOIN disciplina_catalogo k ON k.nome_busca = c.chave;

WITH usados AS (
  SELECT instituicao_id, usuario_id, disciplina FROM tarefa WHERE desativado_em IS NULL AND btrim(disciplina) <> ''
  UNION ALL
  SELECT instituicao_id, usuario_id, disciplina FROM nota_pessoal WHERE desativado_em IS NULL AND btrim(disciplina) <> ''
), contados AS (
  SELECT instituicao_id, usuario_id, sem_acento(disciplina) AS chave, min(btrim(disciplina)) AS nome, count(*) AS n
    FROM usados GROUP BY instituicao_id, usuario_id, sem_acento(disciplina)
), ordenados AS (
  SELECT c.*, row_number() OVER (PARTITION BY c.instituicao_id, c.usuario_id ORDER BY c.n DESC, c.nome) AS posicao
    FROM contados c
   WHERE NOT EXISTS (SELECT 1 FROM disciplina_aluno d
                      WHERE d.instituicao_id = c.instituicao_id AND d.usuario_id = c.usuario_id AND d.nome_busca = c.chave)
     AND c.nome !~* '(https?:|www\.|://|@)' AND length(c.nome) <= 80
)
INSERT INTO disciplina_aluno (instituicao_id, usuario_id, nome, origem)
SELECT instituicao_id, usuario_id, nome, 'propria' FROM ordenados WHERE posicao <= 20;

UPDATE tarefa t SET disciplina_aluno_id = d.id
  FROM disciplina_aluno d
 WHERE d.instituicao_id = t.instituicao_id AND d.usuario_id = t.usuario_id AND d.desativado_em IS NULL
   AND d.nome_busca = sem_acento(t.disciplina) AND btrim(t.disciplina) <> '';
UPDATE nota_pessoal n SET disciplina_aluno_id = d.id
  FROM disciplina_aluno d
 WHERE d.instituicao_id = n.instituicao_id AND d.usuario_id = n.usuario_id AND d.desativado_em IS NULL
   AND d.nome_busca = sem_acento(n.disciplina) AND btrim(n.disciplina) <> '';
