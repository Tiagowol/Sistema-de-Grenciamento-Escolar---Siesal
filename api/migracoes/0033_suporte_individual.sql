-- Migração 0033 (L22f): suporte do espaço individual atendido pelo Master ou por um Admin indicado (A-111, A-127, docs/PROPOSTA-L22F.md).
-- Nada é apagado. Acrescenta: 1 coluna em pedido_suporte, 1 tabela (atendente_suporte) e 9 funções.
-- O aplicativo continua SEM SELECT direto nas tabelas de outro espaço: tudo passa por funções que devolvem só os campos listados.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0033.md.

-- 1) Pedido atendido pela plataforma: quem atende vem de fora do espaço, então não há usuário do espaço em atendido_por.
ALTER TABLE pedido_suporte ADD COLUMN atendido_pela_plataforma boolean NOT NULL DEFAULT false;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'pedido_suporte'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%atendido_por IS NULL%'
  LOOP
    EXECUTE format('ALTER TABLE pedido_suporte DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE pedido_suporte ADD CONSTRAINT pedido_suporte_atendimento CHECK (
  (estado = 'aberto' AND atendido_por IS NULL AND atendido_em IS NULL AND NOT atendido_pela_plataforma)
  OR (estado = 'atendido' AND atendido_em IS NOT NULL
      AND ((atendido_por IS NOT NULL AND NOT atendido_pela_plataforma)
        OR (atendido_por IS NULL AND atendido_pela_plataforma)))
);

-- 2) Admins indicados pelo Master para atender os espaços individuais. Fora do alcance do aplicativo (sem política para siesal_app):
-- só as funções abaixo leem e gravam. Retirar não apaga: grava retirado_em.
CREATE TABLE atendente_suporte (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid        NOT NULL,
  usuario_id     uuid        NOT NULL,
  indicado_por   text        NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  retirado_em    timestamptz,
  retirado_por   text,
  FOREIGN KEY (instituicao_id, usuario_id) REFERENCES usuario (instituicao_id, id),
  CHECK ((retirado_em IS NULL AND retirado_por IS NULL) OR (retirado_em IS NOT NULL AND retirado_por IS NOT NULL))
);
CREATE UNIQUE INDEX atendente_suporte_vigente ON atendente_suporte (instituicao_id, usuario_id) WHERE retirado_em IS NULL;
ALTER TABLE atendente_suporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendente_suporte FORCE ROW LEVEL SECURITY;
CREATE POLICY atendente_suporte_dono ON atendente_suporte TO siesal_owner USING (true) WITH CHECK (true);

-- 3) A indicação vale agora? Só se não foi retirada, o Admin está ativo e a escola está ativa (conferido a cada chamada).
CREATE FUNCTION suporte_atendente_ativo(p_inst uuid, p_usuario uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old text := coalesce(current_setting('app.instituicao_id', true), ''); v_ok boolean;
BEGIN
  IF p_inst IS NULL OR p_usuario IS NULL THEN RETURN false; END IF;
  PERFORM set_config('app.instituicao_id', p_inst::text, true);
  SELECT EXISTS (
    SELECT 1 FROM atendente_suporte a
      JOIN usuario u ON u.instituicao_id = a.instituicao_id AND u.id = a.usuario_id
      JOIN instituicao i ON i.id = a.instituicao_id
     WHERE a.instituicao_id = p_inst AND a.usuario_id = p_usuario AND a.retirado_em IS NULL
       AND u.perfil = 'admin' AND u.situacao = 'ativo' AND u.desativado_em IS NULL AND u.encerrada_em IS NULL
       AND i.tipo = 'escola' AND i.situacao = 'ativa'
  ) INTO v_ok;
  PERFORM set_config('app.instituicao_id', v_old, true);
  RETURN v_ok;
END $$;
REVOKE ALL ON FUNCTION suporte_atendente_ativo(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suporte_atendente_ativo(uuid, uuid) TO siesal_app;

-- 4) Master: Admins ativos de escolas ativas e se já estão indicados. Só id, escola, nome, e-mail e indicado.
CREATE FUNCTION suporte_atendentes_candidatos()
RETURNS TABLE (instituicao_id uuid, instituicao_nome text, usuario_id uuid, nome text, email text, indicado boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inst record; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  FOR v_inst IN SELECT i.id, i.nome FROM instituicao i WHERE i.tipo = 'escola' AND i.situacao = 'ativa' ORDER BY i.nome, i.id LIMIT 500 LOOP
    PERFORM set_config('app.instituicao_id', v_inst.id::text, true);
    RETURN QUERY
      SELECT v_inst.id, v_inst.nome, u.id, u.nome, u.email,
             EXISTS (SELECT 1 FROM atendente_suporte a
                      WHERE a.instituicao_id = u.instituicao_id AND a.usuario_id = u.id AND a.retirado_em IS NULL)
        FROM usuario u
       WHERE u.instituicao_id = v_inst.id AND u.perfil = 'admin' AND u.situacao = 'ativo'
         AND u.desativado_em IS NULL AND u.encerrada_em IS NULL
       ORDER BY u.nome, u.id;
  END LOOP;
  PERFORM set_config('app.instituicao_id', v_old, true);
END $$;
REVOKE ALL ON FUNCTION suporte_atendentes_candidatos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suporte_atendentes_candidatos() TO siesal_ops;

-- 5) Master indica e retira. Resultado em texto: 'ok', 'nao_admin' (não é Admin ativo de escola ativa), 'ja_indicado', 'nao_indicado'.
CREATE FUNCTION suporte_atendente_indicar(p_inst uuid, p_usuario uuid, p_por text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old text := coalesce(current_setting('app.instituicao_id', true), ''); v_res text;
BEGIN
  PERFORM set_config('app.instituicao_id', p_inst::text, true);
  IF NOT EXISTS (
    SELECT 1 FROM usuario u JOIN instituicao i ON i.id = u.instituicao_id
     WHERE u.instituicao_id = p_inst AND u.id = p_usuario AND u.perfil = 'admin' AND u.situacao = 'ativo'
       AND u.desativado_em IS NULL AND u.encerrada_em IS NULL AND i.tipo = 'escola' AND i.situacao = 'ativa'
  ) THEN
    v_res := 'nao_admin';
  ELSIF EXISTS (SELECT 1 FROM atendente_suporte a WHERE a.instituicao_id = p_inst AND a.usuario_id = p_usuario AND a.retirado_em IS NULL) THEN
    v_res := 'ja_indicado';
  ELSE
    INSERT INTO atendente_suporte (instituicao_id, usuario_id, indicado_por) VALUES (p_inst, p_usuario, p_por);
    v_res := 'ok';
  END IF;
  PERFORM set_config('app.instituicao_id', v_old, true);
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION suporte_atendente_indicar(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suporte_atendente_indicar(uuid, uuid, text) TO siesal_ops;

CREATE FUNCTION suporte_atendente_retirar(p_inst uuid, p_usuario uuid, p_por text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_n integer;
BEGIN
  UPDATE atendente_suporte SET retirado_em = now(), retirado_por = p_por
   WHERE instituicao_id = p_inst AND usuario_id = p_usuario AND retirado_em IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 0 THEN 'nao_indicado' ELSE 'ok' END;
END $$;
REVOKE ALL ON FUNCTION suporte_atendente_retirar(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suporte_atendente_retirar(uuid, uuid, text) TO siesal_ops;

-- 6) Fila: pedidos ABERTOS, só de espaços do tipo 'individual' (nunca de escola). Devolve APENAS: id do pedido, id do espaço,
-- assunto, texto, nome e e-mail de quem pediu e quando. Nenhum outro dado do espaço (Q1 = A, 14/11/2026).
CREATE FUNCTION suporte_ind_listar()
RETURNS TABLE (pedido_id uuid, espaco_id uuid, assunto text, texto text, nome text, email text, criado_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inst uuid; v_total integer := 0; v_n integer; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  FOR v_inst IN SELECT i.id FROM instituicao i WHERE i.tipo = 'individual' ORDER BY i.criado_em, i.id LIMIT 5000 LOOP
    PERFORM set_config('app.instituicao_id', v_inst::text, true);
    RETURN QUERY
      SELECT s.id, v_inst, s.assunto, s.texto, u.nome, u.email, s.criado_em
        FROM pedido_suporte s
        JOIN usuario u ON u.instituicao_id = s.instituicao_id AND u.id = s.usuario_id
       WHERE s.instituicao_id = v_inst AND s.estado = 'aberto'
       ORDER BY s.criado_em, s.id LIMIT 50;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
    EXIT WHEN v_total >= 500;
  END LOOP;
  PERFORM set_config('app.instituicao_id', v_old, true);
END $$;
REVOKE ALL ON FUNCTION suporte_ind_listar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suporte_ind_listar() TO siesal_ops;

CREATE FUNCTION suporte_ind_contar() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inst uuid; v_total integer := 0; v_n integer; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  FOR v_inst IN SELECT i.id FROM instituicao i WHERE i.tipo = 'individual' LIMIT 5000 LOOP
    PERFORM set_config('app.instituicao_id', v_inst::text, true);
    SELECT count(*)::integer INTO v_n FROM pedido_suporte s WHERE s.instituicao_id = v_inst AND s.estado = 'aberto';
    v_total := v_total + v_n;
  END LOOP;
  PERFORM set_config('app.instituicao_id', v_old, true);
  RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION suporte_ind_contar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suporte_ind_contar() TO siesal_ops;

-- 7) Marcar como atendido: só pedido aberto de espaço 'individual'. Fica na cadeia do espaço como "equipe da plataforma"
-- (sem o nome de quem atendeu). Resultado: 'ok' ou 'nao_encontrado' (inclui "já atendido" e pedido de escola).
CREATE FUNCTION suporte_ind_atender(p_espaco uuid, p_pedido uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_n integer; v_old text := coalesce(current_setting('app.instituicao_id', true), '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM instituicao i WHERE i.id = p_espaco AND i.tipo = 'individual') THEN RETURN 'nao_encontrado'; END IF;
  PERFORM set_config('app.instituicao_id', p_espaco::text, true);
  UPDATE pedido_suporte SET estado = 'atendido', atendido_em = now(), atendido_pela_plataforma = true
   WHERE instituicao_id = p_espaco AND id = p_pedido AND estado = 'aberto';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    INSERT INTO auditoria_evento (instituicao_id, ator, acao, alvo)
    VALUES (p_espaco, 'plataforma:suporte', 'suporte.atendido', 'pedido_suporte:' || p_pedido::text);
  END IF;
  PERFORM set_config('app.instituicao_id', v_old, true);
  RETURN CASE WHEN v_n = 0 THEN 'nao_encontrado' ELSE 'ok' END;
END $$;
REVOKE ALL ON FUNCTION suporte_ind_atender(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suporte_ind_atender(uuid, uuid) TO siesal_ops;

-- 8) Admin indicado (papel siesal_app): as mesmas três operações, mas cada chamada confere a indicação vigente.
-- Quem não é atendente ativo recebe lista vazia, zero ou 'proibido'.
CREATE FUNCTION suporte_ind_listar_admin(p_inst uuid, p_usuario uuid)
RETURNS TABLE (pedido_id uuid, espaco_id uuid, assunto text, texto text, nome text, email text, criado_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT suporte_atendente_ativo(p_inst, p_usuario) THEN RETURN; END IF;
  RETURN QUERY SELECT * FROM suporte_ind_listar();
END $$;
REVOKE ALL ON FUNCTION suporte_ind_listar_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suporte_ind_listar_admin(uuid, uuid) TO siesal_app;

CREATE FUNCTION suporte_ind_contar_admin(p_inst uuid, p_usuario uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT suporte_atendente_ativo(p_inst, p_usuario) THEN RETURN 0; END IF;
  RETURN suporte_ind_contar();
END $$;
REVOKE ALL ON FUNCTION suporte_ind_contar_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suporte_ind_contar_admin(uuid, uuid) TO siesal_app;

CREATE FUNCTION suporte_ind_atender_admin(p_inst uuid, p_usuario uuid, p_espaco uuid, p_pedido uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT suporte_atendente_ativo(p_inst, p_usuario) THEN RETURN 'proibido'; END IF;
  RETURN suporte_ind_atender(p_espaco, p_pedido);
END $$;
REVOKE ALL ON FUNCTION suporte_ind_atender_admin(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suporte_ind_atender_admin(uuid, uuid, uuid, uuid) TO siesal_app;
