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
