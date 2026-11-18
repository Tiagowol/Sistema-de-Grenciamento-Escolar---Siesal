-- Migração 0034 (L22i, item 2): pedido de convite feito por quem não tem código (docs/diario/2026-11-18-1400.md, A-071).
-- Acrescenta: 1 tabela (pedido_convite) e 1 função. Nada é apagado. O pedido NÃO cria conta nem convite: fica pendente
-- até o Master (ou Admin indicado) decidir (item 3). Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0034.md.

-- Tabela global, fora do alcance do aplicativo (sem política para siesal_app): só a função abaixo grava.
CREATE TABLE pedido_convite (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text        NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 80),
  email        text        NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  email_busca  text        NOT NULL CHECK (email_busca = lower(btrim(email_busca))),
  motivo       text        NOT NULL CHECK (char_length(motivo) BETWEEN 5 AND 300),
  estado       text        NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'aprovado', 'recusado')),
  criado_em    timestamptz NOT NULL DEFAULT now(),
  decidido_em  timestamptz,
  decidido_por text,
  convite_id   uuid        REFERENCES convite_individual (id),
  CHECK ((estado = 'pendente' AND decidido_em IS NULL AND decidido_por IS NULL)
      OR (estado <> 'pendente' AND decidido_em IS NOT NULL AND decidido_por IS NOT NULL))
);
-- Um pedido pendente por e-mail
CREATE UNIQUE INDEX pedido_convite_pendente ON pedido_convite (email_busca) WHERE estado = 'pendente';
ALTER TABLE pedido_convite ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_convite FORCE ROW LEVEL SECURITY;
CREATE POLICY pedido_convite_dono ON pedido_convite TO siesal_owner USING (true) WITH CHECK (true);

-- Registra o pedido. Devolve false (sem erro) se o e-mail já tem espaço individual ou já tem pedido pendente:
-- a API responde igual nos dois casos, para não revelar quem já tem conta.
CREATE FUNCTION pedido_convite_criar(p_nome text, p_email text, p_motivo text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_busca text := lower(btrim(p_email)); v_n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM espaco_individual WHERE email_busca = v_busca) THEN
    RETURN false;
  END IF;
  INSERT INTO pedido_convite (nome, email, email_busca, motivo)
  VALUES (btrim(p_nome), btrim(p_email), v_busca, btrim(p_motivo))
  ON CONFLICT (email_busca) WHERE estado = 'pendente' DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END $$;
REVOKE ALL ON FUNCTION pedido_convite_criar(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_convite_criar(text, text, text) TO siesal_app;
