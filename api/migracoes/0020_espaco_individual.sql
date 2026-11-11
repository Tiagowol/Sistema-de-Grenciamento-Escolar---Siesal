-- Migração 0020 (20c-1): espaço individual para o aluno sem instituição (D1, A-053) e correção da conversão da 0019 (F-054).
-- Cada aluno sem instituição tem uma "instituição" do tipo individual, só dele (e do Responsável, se for menor).
-- A RLS que já separa uma escola da outra passa a separar também os espaços individuais. O Master vê só a quantidade.
-- Nada se apaga. Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0020.md.

ALTER TABLE instituicao ADD COLUMN tipo text NOT NULL DEFAULT 'escola' CHECK (tipo IN ('escola', 'individual'));

-- Índice global e-mail -> espaço individual, só para a tela de entrada "Sem instituição" achar o espaço.
-- Nenhum papel da aplicação lê esta tabela: só as funções abaixo (SECURITY DEFINER, dono siesal_owner).
-- Ela guarda um e-mail por linha e só de contas ativas; o mesmo e-mail não pode estar em dois espaços individuais.
CREATE TABLE espaco_individual (
  email_busca    text        PRIMARY KEY CHECK (email_busca = lower(btrim(email_busca))),
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX espaco_individual_instituicao ON espaco_individual (instituicao_id);
ALTER TABLE espaco_individual ENABLE ROW LEVEL SECURITY;
ALTER TABLE espaco_individual FORCE ROW LEVEL SECURITY;
CREATE POLICY espaco_individual_dono ON espaco_individual TO siesal_owner USING (true) WITH CHECK (true);

-- Acha o espaço pelo e-mail e devolve só o identificador (nunca o e-mail nem o nome)
CREATE FUNCTION espaco_individual_achar(p_email text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT instituicao_id FROM espaco_individual WHERE email_busca = lower(btrim(p_email))
$$;
REVOKE ALL ON FUNCTION espaco_individual_achar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION espaco_individual_achar(text) TO siesal_app;

-- Só números para o Master: quantos espaços individuais têm alguém ativo
CREATE FUNCTION espaco_individual_contar() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT count(DISTINCT instituicao_id)::integer FROM espaco_individual
$$;
REVOKE ALL ON FUNCTION espaco_individual_contar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION espaco_individual_contar() TO siesal_ops;

-- Mantém o índice (só o trigger de usuario chama estas duas)
CREATE FUNCTION espaco_individual_registrar(p_inst uuid, p_email text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO espaco_individual (email_busca, instituicao_id) VALUES (lower(btrim(p_email)), p_inst)
$$;
CREATE FUNCTION espaco_individual_remover(p_inst uuid, p_email text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM espaco_individual WHERE email_busca = lower(btrim(p_email)) AND instituicao_id = p_inst
$$;
REVOKE ALL ON FUNCTION espaco_individual_registrar(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION espaco_individual_remover(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION espaco_individual_registrar(uuid, text) TO siesal_app;
GRANT EXECUTE ON FUNCTION espaco_individual_remover(uuid, text) TO siesal_app;

-- Trigger: só vale para espaço individual (lê o tipo da própria instituição do usuário).
-- Conta ativa entra no índice; conta inativa ou desativada (encerrada) e e-mail trocado saem dele.
CREATE FUNCTION usuario_espaco_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t text;
BEGIN
  SELECT tipo INTO t FROM instituicao WHERE id = NEW.instituicao_id;
  IF t IS DISTINCT FROM 'individual' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND lower(btrim(OLD.email)) <> lower(btrim(NEW.email)) THEN
    PERFORM espaco_individual_remover(OLD.instituicao_id, OLD.email);
  END IF;
  IF NEW.situacao = 'ativo' AND NEW.desativado_em IS NULL THEN
    PERFORM espaco_individual_remover(NEW.instituicao_id, NEW.email);
    PERFORM espaco_individual_registrar(NEW.instituicao_id, NEW.email);
  ELSE
    PERFORM espaco_individual_remover(NEW.instituicao_id, NEW.email);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER usuario_espaco_individual AFTER INSERT OR UPDATE ON usuario
  FOR EACH ROW EXECUTE FUNCTION usuario_espaco_individual();

-- F-054: a conversão de disciplinas da 0019 não converteu nada no site (a migração roda como siesal_owner, sem BYPASSRLS,
-- e a RLS forçada escondia as linhas). A conversão passa a ser feita pela API, por aluno, dentro do withTenant.
-- Esta coluna marca quem já foi convertido, para não recriar uma disciplina que o aluno tirou da lista.
ALTER TABLE preferencia_usuario ADD COLUMN disciplinas_convertidas_em timestamptz;

-- ---------- Cadastro por convite (D4 = convite, A-055) ----------
-- O Master gera um código de uso único (guardado só como hash, validade de 7 dias). Quem tem o código cria a própria
-- conta com nome, e-mail e senha; a função abaixo cria o espaço individual, o aluno e a credencial numa transação só.
CREATE TABLE convite_individual (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_hash    text        NOT NULL UNIQUE,
  criado_por     text        NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  expira_em      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  usado_em       timestamptz,
  instituicao_id uuid        REFERENCES instituicao (id)
);
ALTER TABLE convite_individual ENABLE ROW LEVEL SECURITY;
ALTER TABLE convite_individual FORCE ROW LEVEL SECURITY;
CREATE POLICY convite_individual_operacao ON convite_individual TO siesal_ops USING (true) WITH CHECK (true);
CREATE POLICY convite_individual_dono ON convite_individual TO siesal_owner USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON convite_individual TO siesal_ops;

-- O dono (que roda a função abaixo) só pode criar instituição do tipo individual
CREATE POLICY instituicao_criar_individual ON instituicao FOR INSERT TO siesal_owner WITH CHECK (tipo = 'individual');

CREATE FUNCTION espaco_individual_criar(p_codigo_hash text, p_nome text, p_email text, p_senha_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_convite uuid; v_inst uuid := gen_random_uuid(); v_usuario uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_convite FROM convite_individual
   WHERE codigo_hash = p_codigo_hash AND usado_em IS NULL AND expira_em > now() FOR UPDATE;
  IF v_convite IS NULL THEN
    RAISE EXCEPTION 'convite invalido ou vencido';
  END IF;
  -- Contexto do novo espaço, só dentro desta transação (a RLS das tabelas escolares exige)
  PERFORM set_config('app.instituicao_id', v_inst::text, true);
  INSERT INTO instituicao (id, nome, tipo, situacao) VALUES (v_inst, 'Espaço individual', 'individual', 'ativa');
  INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES (v_usuario, v_inst, 'aluno', btrim(p_nome), btrim(p_email));
  INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES (v_inst, v_usuario, p_senha_hash);
  UPDATE convite_individual SET usado_em = now(), instituicao_id = v_inst WHERE id = v_convite;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN v_inst;
END $$;
REVOKE ALL ON FUNCTION espaco_individual_criar(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION espaco_individual_criar(text, text, text, text) TO siesal_app;
