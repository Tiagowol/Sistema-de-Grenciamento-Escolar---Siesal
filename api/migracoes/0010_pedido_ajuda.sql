-- Migração 0010 (L17, item 3): o aluno pede ajuda ao professor da turma ou à equipe pedagógica (NAPNE).
-- Acrescenta a tabela pedido_ajuda e 2 funções de gatilho; em aviso_visto, acrescenta a coluna ajuda_id
-- (o "visto" do sino passa a valer também para pedidos de ajuda). Nada se apaga.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0010.md.

CREATE TABLE pedido_ajuda (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  aluno_id       uuid        NOT NULL,
  destino        text        NOT NULL CHECK (destino IN ('professor', 'pedagogico')),
  professor_id   uuid,
  turma_id       uuid,
  disciplina_id  uuid,
  tarefa_id      uuid,
  microetapa_id  uuid,
  motivo         text        NOT NULL CHECK (motivo IN ('nao_entendi', 'nao_sei_comecar', 'preciso_tempo', 'outro')),
  texto          text        NOT NULL DEFAULT '' CHECK (length(texto) <= 300 AND texto !~* '(https?:|www\.|://)'),
  estado         text        NOT NULL DEFAULT 'aberto' CHECK (estado IN ('aberto', 'atendido')),
  resposta       text        NOT NULL DEFAULT '' CHECK (length(resposta) <= 300 AND resposta !~* '(https?:|www\.|://)'),
  atendido_por   uuid,
  atendido_em    timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, aluno_id)      REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, professor_id)  REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, turma_id)      REFERENCES turma (instituicao_id, id),
  FOREIGN KEY (instituicao_id, disciplina_id) REFERENCES disciplina (instituicao_id, id),
  FOREIGN KEY (instituicao_id, tarefa_id)     REFERENCES tarefa (instituicao_id, id),
  FOREIGN KEY (instituicao_id, microetapa_id) REFERENCES microetapa (instituicao_id, id),
  FOREIGN KEY (instituicao_id, atendido_por)  REFERENCES usuario (instituicao_id, id),
  -- Professor: sempre com turma e disciplina. Equipe pedagógica: sem professor, turma nem disciplina.
  CHECK ((destino = 'professor' AND professor_id IS NOT NULL AND turma_id IS NOT NULL AND disciplina_id IS NOT NULL)
      OR (destino = 'pedagogico' AND professor_id IS NULL AND turma_id IS NULL AND disciplina_id IS NULL)),
  CHECK ((estado = 'aberto' AND atendido_por IS NULL AND atendido_em IS NULL AND resposta = '')
      OR (estado = 'atendido' AND atendido_por IS NOT NULL AND atendido_em IS NOT NULL))
);
CREATE INDEX pedido_ajuda_aluno     ON pedido_ajuda (instituicao_id, aluno_id, criado_em DESC);
CREATE INDEX pedido_ajuda_professor ON pedido_ajuda (instituicao_id, professor_id, estado);
CREATE INDEX pedido_ajuda_destino   ON pedido_ajuda (instituicao_id, destino, estado);

-- Defesa no banco, além da API: quem pede é aluno; o professor é professor; o pedido nasce aberto
CREATE FUNCTION pedido_ajuda_conferir() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuario WHERE instituicao_id = NEW.instituicao_id AND id = NEW.aluno_id
                  AND perfil = 'aluno') THEN
    RAISE EXCEPTION 'so o aluno pede ajuda';
  END IF;
  IF NEW.professor_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM usuario WHERE instituicao_id = NEW.instituicao_id AND id = NEW.professor_id
          AND perfil = 'professor') THEN
    RAISE EXCEPTION 'destino nao e professor';
  END IF;
  IF NEW.estado <> 'aberto' THEN
    RAISE EXCEPTION 'pedido de ajuda nasce aberto';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pedido_ajuda_conferir BEFORE INSERT ON pedido_ajuda
  FOR EACH ROW EXECUTE FUNCTION pedido_ajuda_conferir();

-- O pedido só muda uma vez, de aberto para atendido; o que o aluno escreveu nunca muda
CREATE FUNCTION pedido_ajuda_so_atender() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado <> 'aberto' OR NEW.estado <> 'atendido' THEN
    RAISE EXCEPTION 'o pedido de ajuda so pode ser atendido uma vez';
  END IF;
  IF NEW.id <> OLD.id OR NEW.aluno_id <> OLD.aluno_id OR NEW.destino <> OLD.destino
     OR NEW.professor_id IS DISTINCT FROM OLD.professor_id OR NEW.turma_id IS DISTINCT FROM OLD.turma_id
     OR NEW.disciplina_id IS DISTINCT FROM OLD.disciplina_id OR NEW.tarefa_id IS DISTINCT FROM OLD.tarefa_id
     OR NEW.microetapa_id IS DISTINCT FROM OLD.microetapa_id OR NEW.motivo <> OLD.motivo
     OR NEW.texto <> OLD.texto OR NEW.criado_em <> OLD.criado_em THEN
    RAISE EXCEPTION 'dados do pedido de ajuda nao mudam';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pedido_ajuda_so_atender BEFORE UPDATE ON pedido_ajuda
  FOR EACH ROW EXECUTE FUNCTION pedido_ajuda_so_atender();

-- "Visto" do sino: agora também para pedidos de ajuda (exatamente um item por linha)
ALTER TABLE aviso_visto ADD COLUMN ajuda_id uuid;
ALTER TABLE aviso_visto ADD FOREIGN KEY (instituicao_id, ajuda_id) REFERENCES pedido_ajuda (instituicao_id, id);
ALTER TABLE aviso_visto DROP CONSTRAINT aviso_visto_check;
ALTER TABLE aviso_visto ADD CONSTRAINT aviso_visto_um_item CHECK (num_nonnulls(pedido_id, aviso_id, ajuda_id) = 1);
CREATE UNIQUE INDEX aviso_visto_ajuda ON aviso_visto (instituicao_id, usuario_id, ajuda_id) WHERE ajuda_id IS NOT NULL;

-- RLS: instituição do contexto (withTenant). Sem contexto, nenhuma linha passa.
ALTER TABLE pedido_ajuda ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_ajuda FORCE ROW LEVEL SECURITY;
CREATE POLICY pedido_ajuda_da_instituicao ON pedido_ajuda
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON pedido_ajuda TO siesal_app;
