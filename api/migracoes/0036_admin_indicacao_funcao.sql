-- Migração 0036 (L22k): o Master indica um Admin por FUNÇÃO (suporte dos espaços, pedidos de convite, ou as duas).
-- Substitui o liga/desliga único do L22f. Nada se apaga: a tabela atendente_suporte fica, só deixa de ser lida e escrita.
-- Quem já era indicado recebe as duas funções (Q1 do autor, 18/11/2026). Retorno: docs/RETORNO-0036.md.

-- 1) Indicação por função. Fora do alcance do aplicativo (sem política para siesal_app): só as funções abaixo leem e gravam.
CREATE TABLE admin_indicacao_funcao (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid        NOT NULL,
  usuario_id     uuid        NOT NULL,
  funcao         text        NOT NULL CHECK (funcao IN ('suporte_individual', 'pedido_convite')),
  indicado_por   text        NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  retirado_em    timestamptz,
  retirado_por   text,
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id),
  CHECK ((retirado_em IS NULL AND retirado_por IS NULL) OR (retirado_em IS NOT NULL AND retirado_por IS NOT NULL))
);
CREATE UNIQUE INDEX admin_indicacao_funcao_vigente
  ON admin_indicacao_funcao (instituicao_id, usuario_id, funcao) WHERE retirado_em IS NULL;
ALTER TABLE admin_indicacao_funcao ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_indicacao_funcao FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_indicacao_funcao_dono ON admin_indicacao_funcao TO siesal_owner USING (true) WITH CHECK (true);

-- 2) Cópia das indicações vigentes: cada Admin indicado hoje fica com as duas funções (o que ele já fazia)
INSERT INTO admin_indicacao_funcao (instituicao_id, usuario_id, funcao, indicado_por, criado_em)
SELECT a.instituicao_id, a.usuario_id, f.funcao, a.indicado_por, a.criado_em
  FROM atendente_suporte a
 CROSS JOIN (VALUES ('suporte_individual'), ('pedido_convite')) AS f (funcao)
 WHERE a.retirado_em IS NULL;

-- 3) A função vale agora? Indicação vigente para ESTA função, Admin ativo e escola ativa (conferido a cada chamada).
CREATE FUNCTION admin_funcao_ativa(p_inst uuid, p_usuario uuid, p_funcao text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old text := coalesce(current_setting('app.instituicao_id', true), ''); v_ok boolean;
BEGIN
  IF p_inst IS NULL OR p_usuario IS NULL OR p_funcao IS NULL THEN RETURN false; END IF;
  PERFORM set_config('app.instituicao_id', p_inst::text, true);
  SELECT EXISTS (
    SELECT 1 FROM admin_indicacao_funcao a
      JOIN usuario u ON u.instituicao_id = a.instituicao_id AND u.id = a.usuario_id
      JOIN instituicao i ON i.id = a.instituicao_id
     WHERE a.instituicao_id = p_inst AND a.usuario_id = p_usuario AND a.funcao = p_funcao AND a.retirado_em IS NULL
       AND u.perfil = 'admin' AND u.situacao = 'ativo' AND u.desativado_em IS NULL AND u.encerrada_em IS NULL
       AND i.tipo = 'escola' AND i.situacao = 'ativa'
  ) INTO v_ok;
  PERFORM set_config('app.instituicao_id', v_old, true);
  RETURN v_ok;
END $$;
REVOKE ALL ON FUNCTION admin_funcao_ativa(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_funcao_ativa(uuid, uuid, text) TO siesal_app;

-- 4) O suporte dos espaços (0033) passa a conferir só a função 'suporte_individual'. Mesma assinatura: as suporte_ind_*_admin seguem iguais.
CREATE OR REPLACE FUNCTION suporte_atendente_ativo(p_inst uuid, p_usuario uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT admin_funcao_ativa(p_inst, p_usuario, 'suporte_individual')
$$;

-- 5) Os pedidos de convite (0035) passam a conferir só a função 'pedido_convite'
CREATE OR REPLACE FUNCTION pedido_convite_listar_admin(p_inst uuid, p_usuario uuid)
RETURNS TABLE (pedido_id uuid, nome text, email text, motivo text, criado_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT admin_funcao_ativa(p_inst, p_usuario, 'pedido_convite') THEN RETURN; END IF;
  RETURN QUERY SELECT * FROM pedido_convite_listar();
END $$;

CREATE OR REPLACE FUNCTION pedido_convite_contar_admin(p_inst uuid, p_usuario uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT admin_funcao_ativa(p_inst, p_usuario, 'pedido_convite') THEN RETURN 0; END IF;
  RETURN pedido_convite_contar();
END $$;

CREATE OR REPLACE FUNCTION pedido_convite_aprovar_admin(p_inst uuid, p_usuario uuid, p_pedido uuid, p_codigo_hash text)
RETURNS TABLE (resultado text, nome text, email text, expira_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT admin_funcao_ativa(p_inst, p_usuario, 'pedido_convite') THEN
    RETURN QUERY SELECT 'proibido'::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM pedido_convite_aprovar(p_pedido, p_codigo_hash, 'admin:' || p_usuario::text);
END $$;

CREATE OR REPLACE FUNCTION pedido_convite_recusar_admin(p_inst uuid, p_usuario uuid, p_pedido uuid)
RETURNS TABLE (resultado text, nome text, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT admin_funcao_ativa(p_inst, p_usuario, 'pedido_convite') THEN
    RETURN QUERY SELECT 'proibido'::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM pedido_convite_recusar(p_pedido, 'admin:' || p_usuario::text);
END $$;

-- 6) Master: Admins ativos de escolas ativas e as funções vigentes de cada um. Só id, escola, nome, e-mail e funções.
CREATE FUNCTION admin_funcoes_candidatos()
RETURNS TABLE (instituicao_id uuid, instituicao_nome text, usuario_id uuid, nome text, email text, funcoes text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inst record; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  FOR v_inst IN SELECT i.id, i.nome FROM instituicao i WHERE i.tipo = 'escola' AND i.situacao = 'ativa' ORDER BY i.nome, i.id LIMIT 500 LOOP
    PERFORM set_config('app.instituicao_id', v_inst.id::text, true);
    RETURN QUERY
      SELECT v_inst.id, v_inst.nome, u.id, u.nome, u.email,
             coalesce((SELECT array_agg(a.funcao ORDER BY a.funcao) FROM admin_indicacao_funcao a
                        WHERE a.instituicao_id = u.instituicao_id AND a.usuario_id = u.id AND a.retirado_em IS NULL),
                      ARRAY[]::text[])
        FROM usuario u
       WHERE u.instituicao_id = v_inst.id AND u.perfil = 'admin' AND u.situacao = 'ativo'
         AND u.desativado_em IS NULL AND u.encerrada_em IS NULL
       ORDER BY u.nome, u.id;
  END LOOP;
  PERFORM set_config('app.instituicao_id', v_old, true);
END $$;
REVOKE ALL ON FUNCTION admin_funcoes_candidatos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_funcoes_candidatos() TO siesal_ops;

-- 7) Master indica e retira UMA função. Resultado: 'ok', 'funcao_invalida', 'nao_admin', 'ja_indicado', 'nao_indicado'.
CREATE FUNCTION admin_funcao_indicar(p_inst uuid, p_usuario uuid, p_funcao text, p_por text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old text := coalesce(current_setting('app.instituicao_id', true), ''); v_res text;
BEGIN
  IF p_funcao IS NULL OR p_funcao NOT IN ('suporte_individual', 'pedido_convite') THEN RETURN 'funcao_invalida'; END IF;
  PERFORM set_config('app.instituicao_id', p_inst::text, true);
  IF NOT EXISTS (
    SELECT 1 FROM usuario u JOIN instituicao i ON i.id = u.instituicao_id
     WHERE u.instituicao_id = p_inst AND u.id = p_usuario AND u.perfil = 'admin' AND u.situacao = 'ativo'
       AND u.desativado_em IS NULL AND u.encerrada_em IS NULL AND i.tipo = 'escola' AND i.situacao = 'ativa'
  ) THEN
    v_res := 'nao_admin';
  ELSIF EXISTS (SELECT 1 FROM admin_indicacao_funcao a WHERE a.instituicao_id = p_inst AND a.usuario_id = p_usuario
                   AND a.funcao = p_funcao AND a.retirado_em IS NULL) THEN
    v_res := 'ja_indicado';
  ELSE
    INSERT INTO admin_indicacao_funcao (instituicao_id, usuario_id, funcao, indicado_por) VALUES (p_inst, p_usuario, p_funcao, p_por);
    v_res := 'ok';
  END IF;
  PERFORM set_config('app.instituicao_id', v_old, true);
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION admin_funcao_indicar(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_funcao_indicar(uuid, uuid, text, text) TO siesal_ops;

CREATE FUNCTION admin_funcao_retirar(p_inst uuid, p_usuario uuid, p_funcao text, p_por text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_n integer;
BEGIN
  IF p_funcao IS NULL OR p_funcao NOT IN ('suporte_individual', 'pedido_convite') THEN RETURN 'funcao_invalida'; END IF;
  UPDATE admin_indicacao_funcao SET retirado_em = now(), retirado_por = p_por
   WHERE instituicao_id = p_inst AND usuario_id = p_usuario AND funcao = p_funcao AND retirado_em IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 0 THEN 'nao_indicado' ELSE 'ok' END;
END $$;
REVOKE ALL ON FUNCTION admin_funcao_retirar(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_funcao_retirar(uuid, uuid, text, text) TO siesal_ops;

-- 8) O liga/desliga antigo (0033) deixa de ser usado: nega por padrão. As funções e a tabela ficam (nada se apaga).
REVOKE EXECUTE ON FUNCTION suporte_atendentes_candidatos() FROM siesal_ops;
REVOKE EXECUTE ON FUNCTION suporte_atendente_indicar(uuid, uuid, text) FROM siesal_ops;
REVOKE EXECUTE ON FUNCTION suporte_atendente_retirar(uuid, uuid, text) FROM siesal_ops;
