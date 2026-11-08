-- Migração 0002 (Lote 4, item 1): auditoria append-only com cadeia de hash (ADR-006).
-- Cada instituição tem a própria cadeia (instituicao_id nulo = eventos da plataforma).

CREATE TABLE auditoria_evento (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seq            bigint      NOT NULL DEFAULT 0, -- posição na cadeia, definida pelo gatilho sob trava
  instituicao_id uuid        REFERENCES instituicao (id),
  ator           text        NOT NULL CHECK (length(btrim(ator)) > 0),
  acao           text        NOT NULL CHECK (length(btrim(acao)) > 0),
  alvo           text        NOT NULL DEFAULT '',
  antes          jsonb,
  depois         jsonb,
  criado_em      timestamptz NOT NULL DEFAULT clock_timestamp(),
  hash_anterior  text        NOT NULL DEFAULT '',
  hash           text        NOT NULL DEFAULT ''
);
-- A ordem da cadeia é seq, não id: o id é atribuído antes da trava e pode chegar fora de ordem
CREATE UNIQUE INDEX auditoria_evento_cadeia ON auditoria_evento ((coalesce(instituicao_id::text, 'plataforma')), seq);

-- Texto que entra no hash: campos do evento na ordem fixa, mais o hash do evento anterior
CREATE FUNCTION auditoria_texto(e auditoria_evento) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|',
    e.id::text, e.seq::text, coalesce(e.instituicao_id::text, ''), e.ator, e.acao, e.alvo,
    coalesce(e.antes::text, ''), coalesce(e.depois::text, ''),
    to_char(e.criado_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    e.hash_anterior)
$$;

-- Antes de gravar: trava a cadeia da instituição, busca o hash anterior e calcula o hash do evento.
-- O aplicativo não escolhe hash nem data.
CREATE FUNCTION auditoria_preparar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE anterior text; ultima bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(NEW.instituicao_id::text, 'plataforma'), 0));
  SELECT hash, seq INTO anterior, ultima FROM auditoria_evento
   WHERE instituicao_id IS NOT DISTINCT FROM NEW.instituicao_id
   ORDER BY seq DESC LIMIT 1;
  NEW.seq := coalesce(ultima, 0) + 1;
  NEW.criado_em := clock_timestamp();
  NEW.hash_anterior := coalesce(anterior, '');
  NEW.hash := encode(sha256(convert_to(auditoria_texto(NEW), 'UTF8')), 'hex');
  RETURN NEW;
END $$;

CREATE FUNCTION auditoria_bloquear() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'auditoria_evento é append-only: % não é permitido', TG_OP;
END $$;

CREATE TRIGGER auditoria_preparar BEFORE INSERT ON auditoria_evento
  FOR EACH ROW EXECUTE FUNCTION auditoria_preparar();
CREATE TRIGGER auditoria_sem_alterar BEFORE UPDATE OR DELETE ON auditoria_evento
  FOR EACH ROW EXECUTE FUNCTION auditoria_bloquear();
CREATE TRIGGER auditoria_sem_truncar BEFORE TRUNCATE ON auditoria_evento
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_bloquear();

-- Verifica a cadeia visível (a da instituição do contexto): devolve os eventos com problema
CREATE FUNCTION auditoria_verificar() RETURNS TABLE (evento_id bigint, problema text) LANGUAGE sql AS $$
  SELECT t.id, 'hash_anterior' FROM (
    SELECT e.id, e.hash_anterior,
           coalesce(lag(e.hash) OVER (PARTITION BY e.instituicao_id ORDER BY e.seq), '') AS esperado
      FROM auditoria_evento e) t
   WHERE t.hash_anterior <> t.esperado
  UNION ALL
  SELECT e.id, 'hash' FROM auditoria_evento e
   WHERE e.hash <> encode(sha256(convert_to(auditoria_texto(e), 'UTF8')), 'hex')
  ORDER BY 1
$$;

ALTER TABLE auditoria_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_evento FORCE ROW LEVEL SECURITY;

CREATE POLICY auditoria_leitura ON auditoria_evento FOR SELECT
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
CREATE POLICY auditoria_insercao ON auditoria_evento FOR INSERT
  WITH CHECK (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);

-- Só leitura e inclusão. Sem UPDATE, DELETE nem TRUNCATE.
GRANT SELECT, INSERT ON auditoria_evento TO siesal_app;
GRANT EXECUTE ON FUNCTION auditoria_verificar() TO siesal_app;
