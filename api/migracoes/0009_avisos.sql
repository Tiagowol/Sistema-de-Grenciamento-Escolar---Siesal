-- Migração 0009 (Lote 16): avisos curtos (só leitura) e controle de "visto" do sino de mensagens.
-- Só acrescenta 2 tabelas e 3 funções de gatilho; nenhuma tabela existente é alterada.
-- Nada se apaga: o aviso só pode ser desativado (desativado_em). O "visto" só aceita INSERT.
-- Retorno: restaurar o backup feito antes, ou (sem dado que importe) DROP TABLE aviso_visto, aviso_escolar +
-- DROP das 3 funções + DELETE FROM _migracoes WHERE nome = '0009_avisos.sql' (ver docs/RETORNO-0009.md).

CREATE TABLE aviso_escolar (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  autor_id       uuid        NOT NULL,
  autor_perfil   text        NOT NULL CHECK (autor_perfil IN ('admin', 'pedagogico')),
  escopo         text        NOT NULL CHECK (escopo IN ('turma', 'instituicao')),
  turma_id       uuid,
  texto          text        NOT NULL CHECK (length(btrim(texto)) BETWEEN 1 AND 300 AND texto !~* '(https?:|www\.|://)'),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  desativado_em  timestamptz,
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, autor_id) REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, turma_id) REFERENCES turma (instituicao_id, id),
  CHECK ((escopo = 'turma' AND turma_id IS NOT NULL) OR (escopo = 'instituicao' AND turma_id IS NULL))
);
CREATE INDEX aviso_escolar_turma ON aviso_escolar (instituicao_id, turma_id, criado_em DESC);
CREATE INDEX aviso_escolar_autor ON aviso_escolar (instituicao_id, autor_id, criado_em DESC);

-- Defesa no banco, além da API: o perfil gravado é o perfil real; Pedagógico fala com uma turma, Admin com a instituição
CREATE FUNCTION aviso_escolar_conferir() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuario WHERE instituicao_id = NEW.instituicao_id AND id = NEW.autor_id
                  AND perfil = NEW.autor_perfil) THEN
    RAISE EXCEPTION 'perfil do aviso diferente do perfil da pessoa';
  END IF;
  IF NEW.desativado_em IS NOT NULL THEN
    RAISE EXCEPTION 'aviso nasce ativo';
  END IF;
  IF (NEW.autor_perfil = 'pedagogico' AND NEW.escopo <> 'turma')
     OR (NEW.autor_perfil = 'admin' AND NEW.escopo <> 'instituicao') THEN
    RAISE EXCEPTION 'escopo do aviso nao combina com o perfil do autor';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER aviso_escolar_conferir BEFORE INSERT ON aviso_escolar
  FOR EACH ROW EXECUTE FUNCTION aviso_escolar_conferir();

-- O aviso só muda uma vez, de ativo para desativado; o resto nunca muda
CREATE FUNCTION aviso_escolar_so_desativar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.desativado_em IS NOT NULL THEN
    RAISE EXCEPTION 'aviso ja desativado';
  END IF;
  IF NEW.desativado_em IS NULL THEN
    RAISE EXCEPTION 'o aviso so pode ser desativado';
  END IF;
  IF NEW.id <> OLD.id OR NEW.autor_id <> OLD.autor_id OR NEW.autor_perfil <> OLD.autor_perfil
     OR NEW.escopo <> OLD.escopo OR NEW.turma_id IS DISTINCT FROM OLD.turma_id
     OR NEW.texto <> OLD.texto OR NEW.criado_em <> OLD.criado_em THEN
    RAISE EXCEPTION 'dados do aviso nao mudam';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER aviso_escolar_so_desativar BEFORE UPDATE ON aviso_escolar
  FOR EACH ROW EXECUTE FUNCTION aviso_escolar_so_desativar();

-- "Visto" do sino: uma linha por pessoa e por item (pedido de revisão ou aviso). Só INSERT.
CREATE TABLE aviso_visto (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid        NOT NULL,
  pedido_id      uuid,
  aviso_id       uuid,
  visto_em       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, id),
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id),
  FOREIGN KEY (instituicao_id, pedido_id)  REFERENCES pedido_revisao (instituicao_id, id),
  FOREIGN KEY (instituicao_id, aviso_id)   REFERENCES aviso_escolar (instituicao_id, id),
  CHECK ((pedido_id IS NOT NULL AND aviso_id IS NULL) OR (pedido_id IS NULL AND aviso_id IS NOT NULL))
);
CREATE UNIQUE INDEX aviso_visto_pedido ON aviso_visto (instituicao_id, usuario_id, pedido_id) WHERE pedido_id IS NOT NULL;
CREATE UNIQUE INDEX aviso_visto_aviso  ON aviso_visto (instituicao_id, usuario_id, aviso_id)  WHERE aviso_id IS NOT NULL;

-- RLS: instituição do contexto (withTenant). Sem contexto, nenhuma linha passa.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['aviso_escolar', 'aviso_visto'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON %I
      USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)
      WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid)$p$,
      t || '_da_instituicao', t);
  END LOOP;
  GRANT SELECT, INSERT, UPDATE ON aviso_escolar TO siesal_app;
  GRANT SELECT, INSERT ON aviso_visto TO siesal_app;
END $$;
