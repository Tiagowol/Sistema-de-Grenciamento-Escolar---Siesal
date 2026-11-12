-- Migração 0023 (20d): dificuldade de 0 a 10 (disciplina e tarefa) e cards de resumo.
-- A dificuldade é a percepção do aluno, pedida pelo NAPNE para o Apoio Pedagógico acompanhar e ajudar o aluno
-- (A-064, A-065, A-066). Não é avaliação nem diagnóstico. O aluno e o Pedagógico a leem; a API só devolve um aluno por vez.
-- Cards de resumo são só do aluno. Só dados fictícios.
-- Nada se apaga. Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0023.md.

ALTER TABLE tarefa ADD COLUMN dificuldade smallint CHECK (dificuldade BETWEEN 0 AND 10);
ALTER TABLE disciplina_aluno ADD COLUMN dificuldade smallint CHECK (dificuldade BETWEEN 0 AND 10);

-- Cards: título, frente e verso, só texto (sem link, e-mail nem HTML), de uma tarefa OU de uma disciplina do aluno
CREATE TABLE cartao_resumo (
  instituicao_id      uuid        NOT NULL REFERENCES instituicao (id),
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id          uuid        NOT NULL,
  tarefa_id           uuid,
  disciplina_aluno_id uuid,
  modelo              text        NOT NULL CHECK (modelo IN ('conceito', 'passo_a_passo', 'formula', 'pergunta_resposta')),
  titulo              text        NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 80 AND titulo !~* '(https?:|www\.|://|@|[<>])'),
  frente              text        NOT NULL CHECK (length(btrim(frente)) BETWEEN 1 AND 500 AND frente !~* '(https?:|www\.|://|@|[<>])'),
  verso               text        NOT NULL CHECK (length(btrim(verso)) BETWEEN 1 AND 500 AND verso !~* '(https?:|www\.|://|@|[<>])'),
  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now(),
  desativado_em       timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, tarefa_id) REFERENCES tarefa (instituicao_id, id),
  FOREIGN KEY (instituicao_id, disciplina_aluno_id) REFERENCES disciplina_aluno (instituicao_id, id),
  CHECK ((tarefa_id IS NULL) <> (disciplina_aluno_id IS NULL))
);
CREATE INDEX cartao_resumo_dono ON cartao_resumo (instituicao_id, usuario_id) WHERE desativado_em IS NULL;

-- Limite no banco (além da API): no máximo 20 cards ativos por tarefa e 20 por disciplina
CREATE FUNCTION cartao_resumo_limite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.desativado_em IS NULL AND (
       SELECT count(*) FROM cartao_resumo c
        WHERE c.instituicao_id = NEW.instituicao_id AND c.desativado_em IS NULL AND c.id <> NEW.id
          AND ((NEW.tarefa_id IS NOT NULL AND c.tarefa_id = NEW.tarefa_id)
            OR (NEW.disciplina_aluno_id IS NOT NULL AND c.disciplina_aluno_id = NEW.disciplina_aluno_id))) >= 20 THEN
    RAISE EXCEPTION 'limite de 20 cards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cartao_resumo_limite BEFORE INSERT OR UPDATE ON cartao_resumo
  FOR EACH ROW EXECUTE FUNCTION cartao_resumo_limite();

ALTER TABLE cartao_resumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartao_resumo FORCE ROW LEVEL SECURITY;
CREATE POLICY cartao_resumo_da_instituicao ON cartao_resumo
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON cartao_resumo TO siesal_app;
