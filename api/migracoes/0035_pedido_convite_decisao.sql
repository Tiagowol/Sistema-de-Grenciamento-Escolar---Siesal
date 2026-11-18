-- Migração 0035 (L22i, item 3): fila de pedidos de convite para o Master e para o Admin indicado (A-071, L22f).
-- Acrescenta só funções (nenhuma tabela nova). Aprovar cria o convite de aluno (7 dias) e marca o pedido; recusar só marca.
-- O aplicativo continua sem acesso direto à tabela pedido_convite: tudo passa por funções. Retorno: docs/RETORNO-0035.md.

-- Fila: só os campos que a tela mostra (nome, e-mail, motivo, quando)
CREATE FUNCTION pedido_convite_listar()
RETURNS TABLE (pedido_id uuid, nome text, email text, motivo text, criado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id, nome, email, motivo, criado_em FROM pedido_convite WHERE estado = 'pendente' ORDER BY criado_em, id LIMIT 200
$$;
REVOKE ALL ON FUNCTION pedido_convite_listar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_convite_listar() TO siesal_ops;

CREATE FUNCTION pedido_convite_contar() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT count(*)::integer FROM pedido_convite WHERE estado = 'pendente'
$$;
REVOKE ALL ON FUNCTION pedido_convite_contar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_convite_contar() TO siesal_ops;

-- Aprovar: cria o convite individual (só o hash do código fica no banco) e marca o pedido. Resultado: 'ok' ou 'nao_encontrado'
-- (inclui "já decidido"). A API envia o código por e-mail na mesma transação e desfaz tudo se o e-mail falhar.
CREATE FUNCTION pedido_convite_aprovar(p_pedido uuid, p_codigo_hash text, p_por text)
RETURNS TABLE (resultado text, nome text, email text, expira_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_p pedido_convite%ROWTYPE; v_convite uuid; v_expira timestamptz;
BEGIN
  SELECT * INTO v_p FROM pedido_convite WHERE id = p_pedido AND estado = 'pendente' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'nao_encontrado'::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  INSERT INTO convite_individual (codigo_hash, criado_por, tipo) VALUES (p_codigo_hash, p_por, 'individual')
  RETURNING id, convite_individual.expira_em INTO v_convite, v_expira;
  UPDATE pedido_convite SET estado = 'aprovado', decidido_em = now(), decidido_por = p_por, convite_id = v_convite WHERE id = p_pedido;
  RETURN QUERY SELECT 'ok'::text, v_p.nome, v_p.email, v_expira;
END $$;
REVOKE ALL ON FUNCTION pedido_convite_aprovar(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_convite_aprovar(uuid, text, text) TO siesal_ops;

CREATE FUNCTION pedido_convite_recusar(p_pedido uuid, p_por text)
RETURNS TABLE (resultado text, nome text, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_p pedido_convite%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM pedido_convite WHERE id = p_pedido AND estado = 'pendente' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'nao_encontrado'::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  UPDATE pedido_convite SET estado = 'recusado', decidido_em = now(), decidido_por = p_por WHERE id = p_pedido;
  RETURN QUERY SELECT 'ok'::text, v_p.nome, v_p.email;
END $$;
REVOKE ALL ON FUNCTION pedido_convite_recusar(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_convite_recusar(uuid, text) TO siesal_ops;

-- Admin indicado (papel siesal_app): as mesmas operações, conferindo a indicação vigente a cada chamada (suporte_atendente_ativo, 0033)
CREATE FUNCTION pedido_convite_listar_admin(p_inst uuid, p_usuario uuid)
RETURNS TABLE (pedido_id uuid, nome text, email text, motivo text, criado_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT suporte_atendente_ativo(p_inst, p_usuario) THEN RETURN; END IF;
  RETURN QUERY SELECT * FROM pedido_convite_listar();
END $$;
REVOKE ALL ON FUNCTION pedido_convite_listar_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_convite_listar_admin(uuid, uuid) TO siesal_app;

CREATE FUNCTION pedido_convite_contar_admin(p_inst uuid, p_usuario uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT suporte_atendente_ativo(p_inst, p_usuario) THEN RETURN 0; END IF;
  RETURN pedido_convite_contar();
END $$;
REVOKE ALL ON FUNCTION pedido_convite_contar_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_convite_contar_admin(uuid, uuid) TO siesal_app;

CREATE FUNCTION pedido_convite_aprovar_admin(p_inst uuid, p_usuario uuid, p_pedido uuid, p_codigo_hash text)
RETURNS TABLE (resultado text, nome text, email text, expira_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT suporte_atendente_ativo(p_inst, p_usuario) THEN
    RETURN QUERY SELECT 'proibido'::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM pedido_convite_aprovar(p_pedido, p_codigo_hash, 'admin:' || p_usuario::text);
END $$;
REVOKE ALL ON FUNCTION pedido_convite_aprovar_admin(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_convite_aprovar_admin(uuid, uuid, uuid, text) TO siesal_app;

CREATE FUNCTION pedido_convite_recusar_admin(p_inst uuid, p_usuario uuid, p_pedido uuid)
RETURNS TABLE (resultado text, nome text, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT suporte_atendente_ativo(p_inst, p_usuario) THEN
    RETURN QUERY SELECT 'proibido'::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM pedido_convite_recusar(p_pedido, 'admin:' || p_usuario::text);
END $$;
REVOKE ALL ON FUNCTION pedido_convite_recusar_admin(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pedido_convite_recusar_admin(uuid, uuid, uuid) TO siesal_app;
