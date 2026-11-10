-- Migração 0013 (L17c): conta e suporte.
-- Cria pedido_conta (troca de e-mail e encerramento de conta, com confirmação ou aprovação) e pedido_suporte
-- (formulário curto para o Pedagógico e o Admin). Acrescenta usuario.encerrada_em e aviso_visto.suporte_id.
-- Ajusta 2 gatilhos para permitir limpar texto pessoal só depois que a conta é encerrada (LGPD).
-- Nada se apaga: a conta encerrada fica desativada e anonimizada. Auditoria e notas oficiais não mudam.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0013.md.

ALTER TABLE usuario ADD COLUMN encerrada_em timestamptz;

CREATE TABLE pedido_conta (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid        NOT NULL,
  tipo           text        NOT NULL CHECK (tipo IN ('email', 'encerramento')),
  email_novo     text        CHECK (email_novo IS NULL OR (length(email_novo) <= 254 AND email_novo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  estado         text        NOT NULL DEFAULT 'aguardando' CHECK (estado IN ('aguardando', 'concluido', 'recusado', 'cancelado')),
  -- Aluno é menor de idade: quem decide é o Responsável vinculado ou o Admin. Os demais perfis confirmam sozinhos.
  exige_aprovacao boolean    NOT NULL,
  decidido_por   uuid,
  decidido_em    timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id)  REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, decidido_por) REFERENCES usuario (instituicao_id, id),
  CHECK ((tipo = 'email' AND email_novo IS NOT NULL) OR (tipo = 'encerramento' AND email_novo IS NULL)),
  CHECK ((estado = 'aguardando' AND decidido_em IS NULL) OR (estado <> 'aguardando' AND decidido_em IS NOT NULL))
);
-- Um pedido aguardando de cada tipo por pessoa
CREATE UNIQUE INDEX pedido_conta_aguardando ON pedido_conta (instituicao_id, usuario_id, tipo) WHERE estado = 'aguardando';
CREATE INDEX pedido_conta_decisao ON pedido_conta (instituicao_id, estado, criado_em DESC);

CREATE TABLE pedido_suporte (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid        NOT NULL,
  assunto        text        NOT NULL CHECK (assunto IN ('acesso', 'nao_consigo_usar', 'duvida_nota', 'erro_na_tela', 'outro')),
  texto          text        NOT NULL CHECK (length(btrim(texto)) BETWEEN 1 AND 500 AND texto !~* '(https?:|www\.|://)'),
  estado         text        NOT NULL DEFAULT 'aberto' CHECK (estado IN ('aberto', 'atendido')),
  atendido_por   uuid,
  atendido_em    timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id)   REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, atendido_por) REFERENCES usuario (instituicao_id, id),
  CHECK ((estado = 'aberto' AND atendido_por IS NULL AND atendido_em IS NULL)
      OR (estado = 'atendido' AND atendido_por IS NOT NULL AND atendido_em IS NOT NULL))
);
CREATE INDEX pedido_suporte_estado ON pedido_suporte (instituicao_id, estado, criado_em DESC);

-- "Visto" do sino: agora também para pedidos de suporte (exatamente um item por linha)
ALTER TABLE aviso_visto ADD COLUMN suporte_id uuid;
ALTER TABLE aviso_visto ADD FOREIGN KEY (instituicao_id, suporte_id) REFERENCES pedido_suporte (instituicao_id, id);
ALTER TABLE aviso_visto DROP CONSTRAINT aviso_visto_um_item;
ALTER TABLE aviso_visto ADD CONSTRAINT aviso_visto_um_item CHECK (num_nonnulls(pedido_id, aviso_id, ajuda_id, suporte_id) = 1);
CREATE UNIQUE INDEX aviso_visto_suporte ON aviso_visto (instituicao_id, usuario_id, suporte_id) WHERE suporte_id IS NOT NULL;

-- LGPD: o texto que o aluno escreveu em um pedido de ajuda só pode ser limpo depois que a conta é encerrada
CREATE OR REPLACE FUNCTION pedido_ajuda_so_atender() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM usuario WHERE instituicao_id = OLD.instituicao_id AND id = OLD.aluno_id
                AND encerrada_em IS NOT NULL)
     AND NEW.estado = OLD.estado AND NEW.id = OLD.id AND NEW.aluno_id = OLD.aluno_id THEN
    RETURN NEW; -- limpeza do texto de conta encerrada
  END IF;
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

-- LGPD: a versão antiga de um evento só pode ter o título limpo depois que o dono encerra a conta
CREATE OR REPLACE FUNCTION evento_versao_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND EXISTS (SELECT 1 FROM evento e JOIN usuario u ON u.instituicao_id = e.instituicao_id AND u.id = e.usuario_id
                  WHERE e.instituicao_id = OLD.instituicao_id AND e.id = OLD.evento_id AND u.encerrada_em IS NOT NULL)
     AND NEW.instituicao_id = OLD.instituicao_id AND NEW.evento_id = OLD.evento_id AND NEW.versao = OLD.versao
     AND NEW.acao = OLD.acao AND NEW.criado_em = OLD.criado_em THEN
    RETURN NEW; -- limpeza do título de conta encerrada
  END IF;
  RAISE EXCEPTION 'evento_versao é append-only: % não é permitido', TG_OP;
END $$;
GRANT UPDATE ON evento_versao TO siesal_app;

-- RLS: instituição do contexto (withTenant). O filtro por dono é feito na API e provado nos testes.
ALTER TABLE pedido_conta ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_conta FORCE ROW LEVEL SECURITY;
CREATE POLICY pedido_conta_da_instituicao ON pedido_conta
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
ALTER TABLE pedido_suporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_suporte FORCE ROW LEVEL SECURITY;
CREATE POLICY pedido_suporte_da_instituicao ON pedido_suporte
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON pedido_conta, pedido_suporte TO siesal_app;
