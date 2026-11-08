-- Migração 0008 (Lote 15): notas oficiais com versões e pedidos de revisão.
-- Separada de nota_pessoal (L9), que não muda. Só acrescenta tabelas; nenhuma tabela existente é alterada.
-- Nada se apaga: a nota e suas versões só aceitam INSERT (o papel siesal_app não tem UPDATE nem DELETE nelas).
-- Revisão = nova versão com motivo, autor e data/hora. O pedido de revisão só muda uma vez, de "aberto" para a resposta.
-- Retorno: restaurar o backup feito antes, ou (sem dados reais) DROP TABLE pedido_revisao, nota_oficial_versao,
-- nota_oficial CASCADE + DELETE FROM _migracoes WHERE nome = '0008_notas_oficiais.sql' (ver docs/RETORNO-0008.md).

CREATE TABLE nota_oficial (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  aluno_id       uuid        NOT NULL,
  turma_id       uuid        NOT NULL,
  disciplina_id  uuid        NOT NULL,
  professor_id   uuid        NOT NULL, -- quem lançou; só ele revisa
  descricao      text        NOT NULL DEFAULT '' CHECK (length(descricao) <= 120),
  dia            date        NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, aluno_id)      REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, professor_id)  REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, turma_id)      REFERENCES turma (instituicao_id, id),
  FOREIGN KEY (instituicao_id, disciplina_id) REFERENCES disciplina (instituicao_id, id)
);
CREATE INDEX nota_oficial_aluno ON nota_oficial (instituicao_id, aluno_id);
CREATE INDEX nota_oficial_turma ON nota_oficial (instituicao_id, turma_id, disciplina_id);

CREATE TABLE nota_oficial_versao (
  instituicao_id uuid         NOT NULL REFERENCES instituicao (id),
  id             uuid         NOT NULL DEFAULT gen_random_uuid(),
  nota_id        uuid         NOT NULL,
  numero         integer      NOT NULL CHECK (numero >= 1),
  valor          numeric(3,1) NOT NULL CHECK (valor BETWEEN 0 AND 10),
  motivo         text         NOT NULL DEFAULT '',
  autor_id       uuid         NOT NULL,
  criado_em      timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, nota_id)  REFERENCES nota_oficial (instituicao_id, id),
  FOREIGN KEY (instituicao_id, autor_id) REFERENCES usuario (instituicao_id, id),
  UNIQUE (instituicao_id, nota_id, numero),
  -- A primeira versão não tem motivo; toda revisão exige motivo
  CHECK ((numero = 1 AND motivo = '') OR (numero > 1 AND length(btrim(motivo)) BETWEEN 1 AND 300))
);

-- Defesa no banco, além da API: pessoas com o perfil e o vínculo certos
CREATE FUNCTION nota_oficial_conferir() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuario WHERE instituicao_id = NEW.instituicao_id AND id = NEW.professor_id AND perfil = 'professor') THEN
    RAISE EXCEPTION 'nota oficial exige professor_id com perfil professor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuario WHERE instituicao_id = NEW.instituicao_id AND id = NEW.aluno_id AND perfil = 'aluno') THEN
    RAISE EXCEPTION 'nota oficial exige aluno_id com perfil aluno';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vinculo WHERE instituicao_id = NEW.instituicao_id AND tipo = 'professor_turma'
                  AND usuario_id = NEW.professor_id AND turma_id = NEW.turma_id AND disciplina_id = NEW.disciplina_id
                  AND desativado_em IS NULL) THEN
    RAISE EXCEPTION 'professor sem vinculo com esta turma e disciplina';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vinculo WHERE instituicao_id = NEW.instituicao_id AND tipo = 'aluno_turma'
                  AND usuario_id = NEW.aluno_id AND turma_id = NEW.turma_id AND desativado_em IS NULL) THEN
    RAISE EXCEPTION 'aluno sem vinculo com esta turma';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER nota_oficial_conferir BEFORE INSERT ON nota_oficial
  FOR EACH ROW EXECUTE FUNCTION nota_oficial_conferir();

-- A versão segue a ordem (1, 2, 3...) e só o professor que lançou a nota grava versões novas
CREATE FUNCTION nota_oficial_versao_conferir() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ultima integer; dono uuid;
BEGIN
  SELECT professor_id INTO dono FROM nota_oficial WHERE instituicao_id = NEW.instituicao_id AND id = NEW.nota_id;
  IF NEW.autor_id IS DISTINCT FROM dono THEN
    RAISE EXCEPTION 'so o professor que lancou a nota grava versoes';
  END IF;
  SELECT coalesce(max(numero), 0) INTO ultima FROM nota_oficial_versao
   WHERE instituicao_id = NEW.instituicao_id AND nota_id = NEW.nota_id;
  IF NEW.numero <> ultima + 1 THEN
    RAISE EXCEPTION 'numero de versao fora de ordem';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER nota_oficial_versao_conferir BEFORE INSERT ON nota_oficial_versao
  FOR EACH ROW EXECUTE FUNCTION nota_oficial_versao_conferir();

-- Pedido de revisão: quem pediu, com qual perfil, qual nota, texto curto (sem links) e estado
CREATE TABLE pedido_revisao (
  instituicao_id    uuid        NOT NULL REFERENCES instituicao (id),
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  nota_id           uuid        NOT NULL,
  pedido_por        uuid        NOT NULL,
  perfil_pedinte    text        NOT NULL CHECK (perfil_pedinte IN ('aluno', 'responsavel', 'admin', 'pedagogico')),
  texto             text        NOT NULL CHECK (length(btrim(texto)) BETWEEN 1 AND 300 AND texto !~* '(https?:|www\.|://)'),
  estado            text        NOT NULL DEFAULT 'aberto' CHECK (estado IN ('aberto', 'revisada', 'mantida')),
  versao_resposta_id uuid,
  motivo_resposta   text        NOT NULL DEFAULT '' CHECK (length(motivo_resposta) <= 300),
  respondido_por    uuid,
  respondido_em     timestamptz,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, nota_id)            REFERENCES nota_oficial (instituicao_id, id),
  FOREIGN KEY (instituicao_id, pedido_por)         REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, versao_resposta_id) REFERENCES nota_oficial_versao (instituicao_id, id),
  FOREIGN KEY (instituicao_id, respondido_por)     REFERENCES usuario (instituicao_id, id),
  CHECK (
    (estado = 'aberto'   AND versao_resposta_id IS NULL AND respondido_por IS NULL AND respondido_em IS NULL) OR
    (estado = 'revisada' AND versao_resposta_id IS NOT NULL AND respondido_por IS NOT NULL AND respondido_em IS NOT NULL) OR
    (estado = 'mantida'  AND versao_resposta_id IS NULL AND respondido_por IS NOT NULL AND respondido_em IS NOT NULL
                         AND length(btrim(motivo_resposta)) >= 1)
  )
);
CREATE INDEX pedido_revisao_nota ON pedido_revisao (instituicao_id, nota_id);
CREATE INDEX pedido_revisao_pedinte ON pedido_revisao (instituicao_id, pedido_por);
-- Um pedido aberto por pessoa e por nota (evita repetição)
CREATE UNIQUE INDEX pedido_revisao_aberto ON pedido_revisao (instituicao_id, nota_id, pedido_por)
  WHERE estado = 'aberto';

-- O perfil gravado tem que ser o perfil real da pessoa; o pedido nasce aberto
CREATE FUNCTION pedido_revisao_conferir() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado <> 'aberto' THEN
    RAISE EXCEPTION 'pedido de revisao nasce aberto';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuario WHERE instituicao_id = NEW.instituicao_id AND id = NEW.pedido_por
                  AND perfil = NEW.perfil_pedinte) THEN
    RAISE EXCEPTION 'perfil do pedido diferente do perfil da pessoa';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pedido_revisao_conferir BEFORE INSERT ON pedido_revisao
  FOR EACH ROW EXECUTE FUNCTION pedido_revisao_conferir();

-- O pedido só muda uma vez (aberto -> revisada ou mantida); os dados de origem nunca mudam
CREATE FUNCTION pedido_revisao_so_responder() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado <> 'aberto' THEN
    RAISE EXCEPTION 'pedido de revisao ja respondido';
  END IF;
  IF NEW.id <> OLD.id OR NEW.nota_id <> OLD.nota_id OR NEW.pedido_por <> OLD.pedido_por
     OR NEW.perfil_pedinte <> OLD.perfil_pedinte OR NEW.texto <> OLD.texto OR NEW.criado_em <> OLD.criado_em THEN
    RAISE EXCEPTION 'dados do pedido de revisao nao mudam';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nota_oficial WHERE instituicao_id = NEW.instituicao_id AND id = NEW.nota_id
                  AND professor_id = NEW.respondido_por) THEN
    RAISE EXCEPTION 'so o professor que lancou a nota responde';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pedido_revisao_so_responder BEFORE UPDATE ON pedido_revisao
  FOR EACH ROW EXECUTE FUNCTION pedido_revisao_so_responder();

-- RLS: instituição do contexto (withTenant). Sem contexto, nenhuma linha passa.
-- Nota e versões: só SELECT e INSERT. Pedido: também UPDATE (apenas a resposta, garantida pelo gatilho).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['nota_oficial', 'nota_oficial_versao', 'pedido_revisao'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
      WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)$p$,
      t || '_da_instituicao', t);
  END LOOP;
  GRANT SELECT, INSERT ON nota_oficial, nota_oficial_versao TO siesal_app;
  GRANT SELECT, INSERT, UPDATE ON pedido_revisao TO siesal_app;
END $$;
