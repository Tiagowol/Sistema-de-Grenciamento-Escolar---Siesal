-- Migração 0011 (L17a): calendário do aluno. Usa a mesma tabela `evento` da Agenda (uma fonte, duas formas de ver).
-- Acrescenta tipos (trabalho, lembrete, compromisso), origens de importação futura, id_externo, oculto_em
-- e a tabela evento_versao (append-only): cada criação, edição, ocultação e desativação grava uma versão.
-- Nada se apaga. Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0011.md.

ALTER TABLE evento DROP CONSTRAINT evento_tipo_check;
ALTER TABLE evento ADD CONSTRAINT evento_tipo_check
  CHECK (tipo IN ('aula', 'estudo', 'pessoal', 'prova', 'trabalho', 'lembrete', 'compromisso'));
ALTER TABLE evento DROP CONSTRAINT evento_origem_check;
ALTER TABLE evento ADD CONSTRAINT evento_origem_check
  CHECK (origem IN ('manual', 'plano', 'google_agenda', 'google_sala_de_aula', 'calendario_escolar'));
ALTER TABLE evento ADD COLUMN id_externo text CHECK (id_externo IS NULL OR length(id_externo) BETWEEN 1 AND 200);
ALTER TABLE evento ADD COLUMN oculto_em timestamptz;
ALTER TABLE evento ADD COLUMN atualizado_em timestamptz NOT NULL DEFAULT now();
-- Evento importado repetido é o mesmo evento: um id externo por origem e por aluno
CREATE UNIQUE INDEX evento_id_externo ON evento (instituicao_id, usuario_id, origem, id_externo)
  WHERE id_externo IS NOT NULL;

CREATE TABLE evento_versao (
  instituicao_id uuid        NOT NULL,
  evento_id      uuid        NOT NULL,
  versao         integer     NOT NULL CHECK (versao >= 1),
  acao           text        NOT NULL CHECK (acao IN ('criado', 'editado', 'ocultado', 'desativado')),
  titulo         text        NOT NULL,
  tipo           text        NOT NULL,
  dia            date        NOT NULL,
  hora_inicio    time,
  minutos        integer,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, evento_id, versao),
  FOREIGN KEY (instituicao_id, evento_id) REFERENCES evento (instituicao_id, id)
);

-- Append-only: versão gravada não muda e não some
CREATE FUNCTION evento_versao_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'evento_versao é append-only: % não é permitido', TG_OP;
END $$;
CREATE TRIGGER evento_versao_sem_alterar BEFORE UPDATE OR DELETE ON evento_versao
  FOR EACH ROW EXECUTE FUNCTION evento_versao_imutavel();

ALTER TABLE evento_versao ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_versao FORCE ROW LEVEL SECURITY;
CREATE POLICY evento_versao_da_instituicao ON evento_versao
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
GRANT SELECT, INSERT ON evento_versao TO siesal_app;
