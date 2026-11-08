-- Migração 0006 (Núcleo do TCC, L6 a L10): tarefas, microetapas, agenda, sessões de estudo,
-- notas pessoais e notificações. Tudo pertence a um aluno (usuario_id) de uma instituição.
-- RLS por instituição; o filtro por dono (usuario_id) é feito na API e provado nos testes.
-- Nada se apaga: usa-se desativado_em. O papel siesal_app não tem DELETE.

CREATE TABLE tarefa (
  instituicao_id uuid        NOT NULL,
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid        NOT NULL,
  titulo         text        NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 120),
  descricao      text        NOT NULL DEFAULT '' CHECK (length(descricao) <= 2000),
  disciplina     text        NOT NULL DEFAULT '' CHECK (length(disciplina) <= 80),
  tipo           text        NOT NULL DEFAULT 'tarefa' CHECK (tipo IN ('tarefa', 'trabalho', 'prova', 'leitura')),
  prazo          date,
  prioridade     text        NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  situacao       text        NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'em_andamento', 'concluida')),
  concluida_em   timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id)
);
CREATE INDEX tarefa_dono ON tarefa (instituicao_id, usuario_id, situacao, prazo);

CREATE TABLE microetapa (
  instituicao_id uuid        NOT NULL,
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  tarefa_id      uuid        NOT NULL,
  usuario_id     uuid        NOT NULL,
  texto          text        NOT NULL CHECK (length(btrim(texto)) BETWEEN 1 AND 200),
  feita          boolean     NOT NULL DEFAULT false,
  ordem          integer     NOT NULL DEFAULT 0,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, tarefa_id) REFERENCES tarefa (instituicao_id, id)
);
CREATE INDEX microetapa_tarefa ON microetapa (instituicao_id, tarefa_id, ordem);

-- Agenda: eventos pessoais e blocos de estudo (origem 'plano' vem do plano regressivo)
CREATE TABLE evento (
  instituicao_id uuid        NOT NULL,
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid        NOT NULL,
  tarefa_id      uuid,
  titulo         text        NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 120),
  tipo           text        NOT NULL DEFAULT 'pessoal' CHECK (tipo IN ('aula', 'estudo', 'pessoal', 'prova')),
  origem         text        NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'plano')),
  dia            date        NOT NULL,
  hora_inicio    time,
  minutos        integer     CHECK (minutos IS NULL OR minutos BETWEEN 5 AND 600),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, tarefa_id) REFERENCES tarefa (instituicao_id, id)
);
CREATE INDEX evento_dono ON evento (instituicao_id, usuario_id, dia);

-- Sessões de estudo (modo foco). O tempo real é calculado no servidor, não pelo relógio do navegador.
CREATE TABLE sessao_estudo (
  instituicao_id     uuid        NOT NULL,
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id         uuid        NOT NULL,
  tarefa_id          uuid,
  minutos_planejados integer     NOT NULL CHECK (minutos_planejados BETWEEN 5 AND 180),
  inicio             timestamptz NOT NULL DEFAULT now(),
  fim                timestamptz,
  minutos_reais      integer     CHECK (minutos_reais IS NULL OR minutos_reais >= 0),
  situacao           text        NOT NULL DEFAULT 'em_andamento' CHECK (situacao IN ('em_andamento', 'concluida', 'interrompida')),
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, tarefa_id) REFERENCES tarefa (instituicao_id, id)
);
-- No máximo uma sessão em andamento por aluno
CREATE UNIQUE INDEX sessao_uma_ativa ON sessao_estudo (instituicao_id, usuario_id) WHERE situacao = 'em_andamento';

-- Notas que o próprio aluno anota. Não são o boletim oficial (a nota oficial é lançada por professor).
CREATE TABLE nota_pessoal (
  instituicao_id uuid         NOT NULL,
  id             uuid         NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid         NOT NULL,
  disciplina     text         NOT NULL CHECK (length(btrim(disciplina)) BETWEEN 1 AND 80),
  descricao      text         NOT NULL DEFAULT '' CHECK (length(descricao) <= 200),
  valor          numeric(4,1) NOT NULL CHECK (valor BETWEEN 0 AND 10),
  dia            date         NOT NULL,
  criado_em      timestamptz  NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id)
);
CREATE INDEX nota_pessoal_dono ON nota_pessoal (instituicao_id, usuario_id, disciplina);

-- Notificações dentro do sistema. chave_unica evita lembrete repetido (mesmo motivo, mesmo dia).
CREATE TABLE notificacao (
  instituicao_id uuid        NOT NULL,
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid        NOT NULL,
  tipo           text        NOT NULL CHECK (tipo IN ('prazo_hoje', 'prazo_amanha', 'atrasada', 'evento_hoje', 'sistema')),
  titulo         text        NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 160),
  chave_unica    text        NOT NULL,
  lida_em        timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id),
  UNIQUE (instituicao_id, usuario_id, chave_unica)
);
CREATE INDEX notificacao_dono ON notificacao (instituicao_id, usuario_id, criado_em DESC);

-- RLS: instituição do contexto (withTenant). Sem contexto, nenhuma linha passa.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tarefa', 'microetapa', 'evento', 'sessao_estudo', 'nota_pessoal', 'notificacao'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
      WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)$p$,
      t || '_da_instituicao', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO siesal_app', t);
  END LOOP;
END $$;
