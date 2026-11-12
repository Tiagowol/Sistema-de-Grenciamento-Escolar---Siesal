-- Migração 0027 (L22a-1c): conta do REPRESENTANTE LEGAL (A-080, docs/PROPOSTA-L22A-1C-E-L22A-2.md).
-- O representante cria a própria conta (pessoa, 1b), depois cria o aluno menor com o convite do Master; o aceite nasce junto.
-- Também: tipo interno do perfil Pedagógico (A-081) e limite de alunos por representante, configurável pelo Master (Q2).
-- Nada se apaga. O fluxo antigo (aluno cria a conta e o responsável confirma por link) continua valendo.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0027.md.

-- 1) Papel desejado ganha 'responsavel' (exibido como "representante legal"); tipo interno do Pedagógico; nascimento declarado
ALTER TABLE pessoa DROP CONSTRAINT pessoa_papel_desejado_check;
ALTER TABLE pessoa ADD CONSTRAINT pessoa_papel_desejado_check
  CHECK (papel_desejado IN ('professor', 'pedagogico', 'responsavel'));
ALTER TABLE pessoa
  ADD COLUMN tipo_profissional text CHECK (tipo_profissional IN (
    'pedagogo', 'psicopedagogo', 'terapeuta_ocupacional', 'fonoaudiologo', 'psicologo', 'psiquiatra', 'outro_saude')),
  ADD COLUMN nascimento date CHECK (nascimento >= DATE '1900-01-01');

-- 2) pessoa_espaco guarda o papel (perfil) do usuário no espaço, para contar os espaços de representante
ALTER TABLE pessoa_espaco ADD COLUMN papel text;
CREATE OR REPLACE FUNCTION usuario_manter_pessoa_espaco() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.pessoa_id IS NOT NULL THEN
    INSERT INTO pessoa_espaco (pessoa_id, instituicao_id, usuario_id, papel)
    VALUES (NEW.pessoa_id, NEW.instituicao_id, NEW.id, NEW.perfil)
    ON CONFLICT (instituicao_id, usuario_id) DO UPDATE SET pessoa_id = EXCLUDED.pessoa_id, papel = EXCLUDED.papel;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER usuario_pessoa_espaco_depois ON usuario;
CREATE TRIGGER usuario_pessoa_espaco_depois AFTER INSERT OR UPDATE OF pessoa_id, perfil ON usuario
  FOR EACH ROW EXECUTE FUNCTION usuario_manter_pessoa_espaco();
-- Preenche o papel dos que já existem (instituição por instituição, por causa da RLS forçada: F-054)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM instituicao LOOP
    PERFORM set_config('app.instituicao_id', r.id::text, true);
    UPDATE pessoa_espaco pe SET papel = u.perfil
      FROM usuario u
     WHERE pe.instituicao_id = r.id AND u.instituicao_id = r.id AND u.id = pe.usuario_id AND pe.papel IS NULL;
  END LOOP;
  PERFORM set_config('app.instituicao_id', '', true);
END $$;

-- 3) O índice de e-mail do espaço individual é só do ALUNO (a pessoa do representante não pode ocupar o e-mail do aluno,
--    e o mesmo representante pode ter vários espaços). Mesma função da 0020, agora só para perfil 'aluno'.
CREATE OR REPLACE FUNCTION usuario_espaco_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t text;
BEGIN
  IF NEW.perfil <> 'aluno' THEN RETURN NEW; END IF;
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

-- 4) Aceite do representante no vínculo (versão do termo e momento)
ALTER TABLE vinculo ADD COLUMN termo_versao text, ADD COLUMN aceito_em timestamptz;

-- 5) Configurações da plataforma (o Master ajusta; a tela do Master vem no L22c). Limite de alunos por representante: 5.
CREATE TABLE configuracao_plataforma (
  chave         text        PRIMARY KEY CHECK (length(chave) BETWEEN 1 AND 80),
  valor         text        NOT NULL CHECK (length(valor) <= 200),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE configuracao_plataforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_plataforma FORCE ROW LEVEL SECURITY;
CREATE POLICY configuracao_plataforma_dono ON configuracao_plataforma TO siesal_owner USING (true) WITH CHECK (true);
CREATE POLICY configuracao_plataforma_operacao ON configuracao_plataforma TO siesal_ops USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON configuracao_plataforma TO siesal_ops;
INSERT INTO configuracao_plataforma (chave, valor) VALUES ('limite_alunos_por_representante', '5');

CREATE FUNCTION plataforma_limite_alunos() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce((SELECT CASE WHEN valor ~ '^[0-9]{1,3}$' THEN valor::integer END
                     FROM configuracao_plataforma WHERE chave = 'limite_alunos_por_representante'), 5)
$$;
REVOKE ALL ON FUNCTION plataforma_limite_alunos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_limite_alunos() TO siesal_app;

-- Quantos espaços individuais a pessoa tem como representante legal
CREATE FUNCTION representante_contar(p_pessoa uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT count(*)::integer FROM pessoa_espaco pe JOIN instituicao i ON i.id = pe.instituicao_id
   WHERE pe.pessoa_id = p_pessoa AND pe.papel = 'responsavel' AND i.tipo = 'individual'
$$;
REVOKE ALL ON FUNCTION representante_contar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION representante_contar(uuid) TO siesal_app;

-- 6) pessoa_cadastrar passa a receber o tipo interno do Pedagógico (a versão da 0026 sai; nada depende dela fora da API)
DROP FUNCTION pessoa_cadastrar(text, text, text, text, text, text);
CREATE FUNCTION pessoa_cadastrar(
  p_nome text, p_email text, p_senha_hash text, p_papel text, p_tipo_profissional text,
  p_termo_versao text, p_token_hash text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_pessoa uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM pessoa WHERE lower(email) = lower(p_email) AND email_confirmado_em IS NOT NULL) THEN
    RETURN 'ja_existe';
  END IF;
  SELECT p.id INTO v_pessoa FROM pessoa p JOIN credencial_pessoa c ON c.pessoa_id = p.id
   WHERE lower(p.email) = lower(p_email) AND p.email_confirmado_em IS NULL
     AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.pessoa_id = p.id)
   ORDER BY p.criada_em DESC LIMIT 1;
  IF v_pessoa IS NULL THEN
    INSERT INTO pessoa (nome, email, papel_desejado, tipo_profissional, termo_versao, termo_aceito_em)
    VALUES (p_nome, p_email, p_papel, p_tipo_profissional, p_termo_versao, now()) RETURNING id INTO v_pessoa;
    INSERT INTO credencial_pessoa (pessoa_id, senha_hash) VALUES (v_pessoa, p_senha_hash);
  ELSE
    UPDATE pessoa SET nome = p_nome, papel_desejado = p_papel, tipo_profissional = p_tipo_profissional,
           termo_versao = p_termo_versao, termo_aceito_em = now() WHERE id = v_pessoa;
    UPDATE credencial_pessoa SET senha_hash = p_senha_hash, falhas_seguidas = 0, bloqueado_ate = NULL,
           atualizado_em = now() WHERE pessoa_id = v_pessoa;
    UPDATE pedido_email_pessoa SET expira_em = now() WHERE pessoa_id = v_pessoa AND confirmado_em IS NULL;
  END IF;
  INSERT INTO pedido_email_pessoa (pessoa_id, token_hash) VALUES (v_pessoa, p_token_hash);
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION pessoa_cadastrar(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pessoa_cadastrar(text, text, text, text, text, text, text) TO siesal_app;

-- 7) Espaços da pessoa: o perfil 'responsavel' também entra por aqui (o Admin continua só pelo login antigo)
CREATE OR REPLACE FUNCTION pessoa_espacos(p_pessoa uuid)
RETURNS TABLE (instituicao_id uuid, instituicao_nome text, tipo text, perfil text, usuario_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT pe.instituicao_id AS inst, pe.usuario_id AS usr FROM pessoa_espaco pe WHERE pe.pessoa_id = p_pessoa LOOP
    PERFORM set_config('app.instituicao_id', r.inst::text, true);
    RETURN QUERY
      SELECT i.id, i.nome, i.tipo, u.perfil, u.id
        FROM usuario u JOIN instituicao i ON i.id = u.instituicao_id
       WHERE u.instituicao_id = r.inst AND u.id = r.usr AND u.pessoa_id = p_pessoa
         AND u.situacao = 'ativo' AND i.situacao = 'ativa' AND u.perfil IN ('professor', 'pedagogico', 'responsavel');
  END LOOP;
  PERFORM set_config('app.instituicao_id', '', true);
END $$;

-- 8) O representante legal cria o aluno menor: espaço individual, aluno, representante, vínculo 'legal' e aceite, numa
--    transação só. Devolve um código ('ok', 'convite', 'email', 'limite', 'pessoa', 'idade') e o espaço criado.
--    Convite inválido, vencido ou usado e e-mail já em uso: a API responde igual para todos (não revela nada).
CREATE FUNCTION representante_criar_aluno(
  p_pessoa uuid, p_codigo_hash text, p_aluno_nome text, p_aluno_email text, p_aluno_senha_hash text,
  p_aluno_nascimento date, p_rep_nascimento date, p_termo_versao text
) RETURNS TABLE (resultado text, instituicao_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_pessoa record; v_convite uuid; v_inst uuid := gen_random_uuid();
  v_aluno uuid := gen_random_uuid(); v_rep uuid := gen_random_uuid();
BEGIN
  SELECT id, nome, email INTO v_pessoa FROM pessoa
   WHERE id = p_pessoa AND email_confirmado_em IS NOT NULL AND desativada_em IS NULL;
  IF v_pessoa.id IS NULL THEN RETURN QUERY SELECT 'pessoa'::text, NULL::uuid; RETURN; END IF;
  -- idade: representante 18 anos ou mais; aluno menor de 18 (as datas são declaradas)
  IF p_rep_nascimento > (current_date - interval '18 years')::date
     OR p_aluno_nascimento <= (current_date - interval '18 years')::date
     OR p_aluno_nascimento > current_date THEN
    RETURN QUERY SELECT 'idade'::text, NULL::uuid; RETURN;
  END IF;
  IF representante_contar(p_pessoa) >= plataforma_limite_alunos() THEN
    RETURN QUERY SELECT 'limite'::text, NULL::uuid; RETURN;
  END IF;
  IF lower(btrim(p_aluno_email)) = lower(btrim(v_pessoa.email))
     OR EXISTS (SELECT 1 FROM espaco_individual WHERE email_busca = lower(btrim(p_aluno_email))) THEN
    RETURN QUERY SELECT 'email'::text, NULL::uuid; RETURN;
  END IF;
  SELECT id INTO v_convite FROM convite_individual
   WHERE codigo_hash = p_codigo_hash AND tipo = 'individual' AND usado_em IS NULL AND expira_em > now() FOR UPDATE;
  IF v_convite IS NULL THEN RETURN QUERY SELECT 'convite'::text, NULL::uuid; RETURN; END IF;

  PERFORM set_config('app.instituicao_id', v_inst::text, true);
  INSERT INTO instituicao (id, nome, tipo, situacao) VALUES (v_inst, 'Espaço individual', 'individual', 'ativa');
  -- aluno menor: entra já ativo, com senha provisória (troca no primeiro acesso)
  INSERT INTO usuario (id, instituicao_id, perfil, nome, email, situacao)
    VALUES (v_aluno, v_inst, 'aluno', btrim(p_aluno_nome), btrim(p_aluno_email), 'ativo');
  INSERT INTO credencial (instituicao_id, usuario_id, senha_hash, senha_provisoria)
    VALUES (v_inst, v_aluno, p_aluno_senha_hash, true);
  INSERT INTO aluno_dados (instituicao_id, usuario_id, nascimento) VALUES (v_inst, v_aluno, p_aluno_nascimento);
  -- representante: participação da pessoa neste espaço (sem senha própria no espaço; entra pela pessoa)
  INSERT INTO usuario (id, instituicao_id, perfil, nome, email, situacao, pessoa_id)
    VALUES (v_rep, v_inst, 'responsavel', v_pessoa.nome, v_pessoa.email, 'ativo', p_pessoa);
  INSERT INTO vinculo (instituicao_id, tipo, usuario_id, aluno_id, tipo_responsavel, termo_versao, aceito_em)
    VALUES (v_inst, 'responsavel_aluno', v_rep, v_aluno, 'legal', p_termo_versao, now());
  UPDATE convite_individual SET usado_em = now(), instituicao_id = v_inst WHERE id = v_convite;
  UPDATE pessoa SET nascimento = coalesce(nascimento, p_rep_nascimento) WHERE id = p_pessoa;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN QUERY SELECT 'ok'::text, v_inst;
END $$;
REVOKE ALL ON FUNCTION representante_criar_aluno(uuid, text, text, text, text, date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION representante_criar_aluno(uuid, text, text, text, text, date, date, text) TO siesal_app;
