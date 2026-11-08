-- Migração 0007 (Lote 14): turmas, disciplinas e vínculos.
-- Tudo pertence a uma instituição (RLS por app.instituicao_id, via withTenant).
-- Nada se apaga: usa-se desativado_em. O papel siesal_app não tem DELETE.
-- Só acrescenta tabelas novas; nenhuma tabela existente é alterada.

CREATE TABLE turma (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  nome           text        NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 80),
  ano_letivo     integer     NOT NULL CHECK (ano_letivo BETWEEN 2000 AND 2100),
  turno          text        NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite')),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id)
);
-- Não repete nome de turma ativa no mesmo ano letivo
CREATE UNIQUE INDEX turma_nome_ativa ON turma (instituicao_id, ano_letivo, lower(btrim(nome)))
  WHERE desativado_em IS NULL;

CREATE TABLE disciplina (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  nome           text        NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 80),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id)
);
CREATE UNIQUE INDEX disciplina_nome_ativa ON disciplina (instituicao_id, lower(btrim(nome)))
  WHERE desativado_em IS NULL;

-- Vínculo: três tipos, cada um com os campos que exige (CHECK abaixo).
--   professor_turma:   professor (usuario_id) + turma + disciplina
--   aluno_turma:       aluno (usuario_id) + turma
--   responsavel_aluno: responsável (usuario_id) + aluno (aluno_id)
CREATE TABLE vinculo (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  tipo           text        NOT NULL CHECK (tipo IN ('professor_turma', 'aluno_turma', 'responsavel_aluno')),
  usuario_id     uuid        NOT NULL,
  turma_id       uuid,
  disciplina_id  uuid,
  aluno_id       uuid,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id)    REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, turma_id)      REFERENCES turma (instituicao_id, id),
  FOREIGN KEY (instituicao_id, disciplina_id) REFERENCES disciplina (instituicao_id, id),
  FOREIGN KEY (instituicao_id, aluno_id)      REFERENCES usuario (instituicao_id, id),
  CHECK (
    (tipo = 'professor_turma'   AND turma_id IS NOT NULL AND disciplina_id IS NOT NULL AND aluno_id IS NULL) OR
    (tipo = 'aluno_turma'       AND turma_id IS NOT NULL AND disciplina_id IS NULL     AND aluno_id IS NULL) OR
    (tipo = 'responsavel_aluno' AND turma_id IS NULL     AND disciplina_id IS NULL     AND aluno_id IS NOT NULL)
  )
);
-- Não repete o mesmo vínculo ativo
CREATE UNIQUE INDEX vinculo_ativo ON vinculo (
  instituicao_id, tipo, usuario_id,
  coalesce(turma_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(disciplina_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(aluno_id, '00000000-0000-0000-0000-000000000000')
) WHERE desativado_em IS NULL;
CREATE INDEX vinculo_turma ON vinculo (instituicao_id, turma_id) WHERE turma_id IS NOT NULL;
CREATE INDEX vinculo_usuario ON vinculo (instituicao_id, usuario_id);

-- O perfil das pessoas tem que combinar com o tipo do vínculo (defesa no banco, além da API)
CREATE FUNCTION vinculo_conferir_perfis() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE perfil_usuario text; perfil_aluno text;
BEGIN
  SELECT perfil INTO perfil_usuario FROM usuario
   WHERE instituicao_id = NEW.instituicao_id AND id = NEW.usuario_id;
  IF NEW.tipo = 'professor_turma' AND perfil_usuario IS DISTINCT FROM 'professor' THEN
    RAISE EXCEPTION 'vinculo professor_turma exige usuário com perfil professor';
  ELSIF NEW.tipo = 'aluno_turma' AND perfil_usuario IS DISTINCT FROM 'aluno' THEN
    RAISE EXCEPTION 'vinculo aluno_turma exige usuário com perfil aluno';
  ELSIF NEW.tipo = 'responsavel_aluno' THEN
    IF perfil_usuario IS DISTINCT FROM 'responsavel' THEN
      RAISE EXCEPTION 'vinculo responsavel_aluno exige usuário com perfil responsavel';
    END IF;
    SELECT perfil INTO perfil_aluno FROM usuario
     WHERE instituicao_id = NEW.instituicao_id AND id = NEW.aluno_id;
    IF perfil_aluno IS DISTINCT FROM 'aluno' THEN
      RAISE EXCEPTION 'vinculo responsavel_aluno exige aluno_id com perfil aluno';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER vinculo_conferir_perfis BEFORE INSERT ON vinculo
  FOR EACH ROW EXECUTE FUNCTION vinculo_conferir_perfis();

-- RLS: instituição do contexto (withTenant). Sem contexto, nenhuma linha passa.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['turma', 'disciplina', 'vinculo'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
      WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)$p$,
      t || '_da_instituicao', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO siesal_app', t);
  END LOOP;
END $$;
