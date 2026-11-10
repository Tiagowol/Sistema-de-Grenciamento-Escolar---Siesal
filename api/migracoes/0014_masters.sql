-- Migração 0014 (L18): login dos Masters (/operacao).
-- Acrescenta em operator_account o TOTP, o bloqueio por tentativas e o convite de primeiro acesso.
-- Cria operator_sessao (cookie próprio) e operator_auditoria (trilha append-only com hash, separada da escolar).
-- Tudo só para o papel siesal_ops. Nenhuma permissão em tabela escolar é dada aqui.
-- A API passa a operar como siesal_ops por SET LOCAL ROLE (concessão feita pelo job migrate, sem herança).
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0014.md.

ALTER TABLE operator_account
  ADD COLUMN totp_segredo_cifrado text,
  ADD COLUMN totp_ativo           boolean     NOT NULL DEFAULT false,
  ADD COLUMN totp_ultimo_passo    bigint,
  ADD COLUMN falhas_seguidas      integer     NOT NULL DEFAULT 0 CHECK (falhas_seguidas >= 0),
  ADD COLUMN bloqueado_ate        timestamptz,
  -- Convite de uso único, emitido por comando manual; só o hash fica no banco
  ADD COLUMN convite_hash         text,
  ADD COLUMN convite_expira_em    timestamptz,
  ADD COLUMN atualizado_em        timestamptz NOT NULL DEFAULT now(),
  ADD CHECK ((convite_hash IS NULL) = (convite_expira_em IS NULL)),
  -- Master ativo sempre tem senha e TOTP
  ADD CHECK (situacao <> 'ativo' OR (senha_hash IS NOT NULL AND totp_ativo));

-- Sessão do Master: só o hash do token fica no banco. Revogar = preencher revogada_em.
CREATE TABLE operator_sessao (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id uuid        NOT NULL REFERENCES operator_account (id),
  token_hash  text        NOT NULL UNIQUE,
  nivel       text        NOT NULL CHECK (nivel IN ('completo', 'configurar_totp')),
  criada_em   timestamptz NOT NULL DEFAULT now(),
  expira_em   timestamptz NOT NULL,
  revogada_em timestamptz
);
CREATE INDEX operator_sessao_operador ON operator_sessao (operador_id);

-- Trilha do Master: uma cadeia só, com hash calculado pelo banco. Nunca guarda dado escolar.
CREATE TABLE operator_auditoria (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seq           bigint      NOT NULL DEFAULT 0,
  ator          text        NOT NULL CHECK (length(btrim(ator)) > 0),
  acao          text        NOT NULL CHECK (length(btrim(acao)) > 0),
  alvo          text        NOT NULL DEFAULT '',
  detalhe       jsonb,
  criado_em     timestamptz NOT NULL DEFAULT clock_timestamp(),
  hash_anterior text        NOT NULL DEFAULT '',
  hash          text        NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX operator_auditoria_cadeia ON operator_auditoria (seq);

CREATE FUNCTION operator_auditoria_texto(e operator_auditoria) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', e.id::text, e.seq::text, e.ator, e.acao, e.alvo, coalesce(e.detalhe::text, ''),
    to_char(e.criado_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), e.hash_anterior)
$$;

-- Antes de gravar: trava a cadeia, busca o hash anterior e calcula o hash. O aplicativo não escolhe hash nem data.
CREATE FUNCTION operator_auditoria_preparar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE anterior text; ultima bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('operator_auditoria', 0));
  SELECT hash, seq INTO anterior, ultima FROM operator_auditoria ORDER BY seq DESC LIMIT 1;
  NEW.seq := coalesce(ultima, 0) + 1;
  NEW.criado_em := clock_timestamp();
  NEW.hash_anterior := coalesce(anterior, '');
  NEW.hash := encode(sha256(convert_to(operator_auditoria_texto(NEW), 'UTF8')), 'hex');
  RETURN NEW;
END $$;

CREATE FUNCTION operator_auditoria_bloquear() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'operator_auditoria é append-only: % não é permitido', TG_OP;
END $$;

CREATE TRIGGER operator_auditoria_preparar BEFORE INSERT ON operator_auditoria
  FOR EACH ROW EXECUTE FUNCTION operator_auditoria_preparar();
CREATE TRIGGER operator_auditoria_sem_alterar BEFORE UPDATE OR DELETE ON operator_auditoria
  FOR EACH ROW EXECUTE FUNCTION operator_auditoria_bloquear();
CREATE TRIGGER operator_auditoria_sem_truncar BEFORE TRUNCATE ON operator_auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION operator_auditoria_bloquear();

-- Devolve os eventos que não conferem (lista vazia = cadeia íntegra)
CREATE FUNCTION operator_auditoria_verificar() RETURNS TABLE (evento_id bigint, problema text) LANGUAGE sql AS $$
  SELECT t.id, 'hash_anterior' FROM (
    SELECT e.id, e.hash_anterior, coalesce(lag(e.hash) OVER (ORDER BY e.seq), '') AS esperado
      FROM operator_auditoria e) t
   WHERE t.hash_anterior <> t.esperado
  UNION ALL
  SELECT e.id, 'hash' FROM operator_auditoria e
   WHERE e.hash <> encode(sha256(convert_to(operator_auditoria_texto(e), 'UTF8')), 'hex')
  ORDER BY 1
$$;

-- RLS: só o papel de operação passa. O papel da aplicação (siesal_app) não recebe nenhum GRANT aqui.
ALTER TABLE operator_sessao ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_sessao FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_sessao_operacao ON operator_sessao TO siesal_ops USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON operator_sessao TO siesal_ops;

ALTER TABLE operator_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_auditoria FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_auditoria_leitura ON operator_auditoria FOR SELECT TO siesal_ops USING (true);
CREATE POLICY operator_auditoria_insercao ON operator_auditoria FOR INSERT TO siesal_ops WITH CHECK (true);
-- Só leitura e inclusão. Sem UPDATE, DELETE nem TRUNCATE.
GRANT SELECT, INSERT ON operator_auditoria TO siesal_ops;
GRANT EXECUTE ON FUNCTION operator_auditoria_verificar() TO siesal_ops;
