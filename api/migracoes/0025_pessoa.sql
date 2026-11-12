-- Migração 0025 (L22a-1a): "pessoa", a camada acima dos espaços (A-074, docs/PROPOSTA-L22A-1.md).
-- Esta migração só cria a BASE de dados. O login continua como era (por usuário e instituição); o login por pessoa e a
-- escolha de espaço entram no L22a-1b. Nada se apaga e nenhum e-mail é unido a outro sem confirmação.
--
-- Modelo: uma "participação" de uma pessoa num espaço é a linha de `usuario` daquele espaço ligada à pessoa
-- (usuario.pessoa_id). Não existe tabela de participação duplicada: perfil e situação já estão em `usuario`.
-- Retorno: restaurar o backup feito antes, ou o SQL de docs/RETORNO-0025.md.

-- Pessoa: identidade de login acima dos espaços. Só identificadores (nenhum dado escolar).
-- Nenhum papel da aplicação lê esta tabela: só as funções SECURITY DEFINER (mesmo padrão de pedido_responsavel).
CREATE TABLE pessoa (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                text        NOT NULL CHECK (length(btrim(nome)) > 0),
  email               text        NOT NULL CHECK (length(btrim(email)) > 0),
  email_confirmado_em timestamptz,
  criada_em           timestamptz NOT NULL DEFAULT now(),
  desativada_em       timestamptz
);
-- E-mail repetido só é impedido para e-mail CONFIRMADO. As pessoas criadas a partir de usuários que já existiam
-- ficam sem confirmação e podem repetir o e-mail (a mesma pessoa em duas instituições): não se junta sem prova.
CREATE UNIQUE INDEX pessoa_email_confirmado ON pessoa (lower(email)) WHERE email_confirmado_em IS NOT NULL;
ALTER TABLE pessoa ENABLE ROW LEVEL SECURITY;
ALTER TABLE pessoa FORCE ROW LEVEL SECURITY;
CREATE POLICY pessoa_dono ON pessoa TO siesal_owner USING (true) WITH CHECK (true);

-- O dono (que roda as funções abaixo e esta migração) precisa LISTAR as instituições para entrar em cada uma, por causa da
-- RLS forçada em `usuario` (F-054). Só leitura do `id`; escrita continua restrita pelas políticas das migrações 0020 e 0021.
CREATE POLICY instituicao_listar_dono ON instituicao FOR SELECT TO siesal_owner USING (true);

-- Cada usuário de um espaço pertence a uma pessoa
ALTER TABLE usuario ADD COLUMN pessoa_id uuid REFERENCES pessoa (id);
CREATE INDEX usuario_pessoa ON usuario (pessoa_id) WHERE pessoa_id IS NOT NULL;

-- Todo usuário novo ganha a sua pessoa, por qualquer caminho de cadastro (função, API ou job), se não vier com uma.
CREATE FUNCTION usuario_garantir_pessoa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_pessoa uuid;
BEGIN
  IF NEW.pessoa_id IS NULL THEN
    INSERT INTO pessoa (nome, email) VALUES (NEW.nome, NEW.email) RETURNING id INTO v_pessoa;
    NEW.pessoa_id := v_pessoa;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION usuario_garantir_pessoa() FROM PUBLIC;
CREATE TRIGGER usuario_pessoa_antes BEFORE INSERT ON usuario
  FOR EACH ROW EXECUTE FUNCTION usuario_garantir_pessoa();

-- Preenche as pessoas dos usuários que já existiam. A RLS é forçada em `usuario`, então a função entra em cada
-- instituição, uma por vez (lição da F-054: sem isso o UPDATE não enxergaria nenhuma linha e "terminaria com sucesso").
-- Devolve quantos usuários receberam pessoa. Pode rodar de novo sem efeito colateral.
CREATE FUNCTION pessoa_preencher_faltantes() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; u record; v_pessoa uuid; n integer := 0;
BEGIN
  FOR r IN SELECT id FROM instituicao LOOP
    PERFORM set_config('app.instituicao_id', r.id::text, true);
    FOR u IN SELECT id, nome, email FROM usuario WHERE instituicao_id = r.id AND pessoa_id IS NULL LOOP
      INSERT INTO pessoa (nome, email) VALUES (u.nome, u.email) RETURNING id INTO v_pessoa;
      UPDATE usuario SET pessoa_id = v_pessoa WHERE instituicao_id = r.id AND id = u.id;
      n := n + 1;
    END LOOP;
  END LOOP;
  PERFORM set_config('app.instituicao_id', '', true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION pessoa_preencher_faltantes() FROM PUBLIC;
-- A função de preenchimento é só do job de migração; a aplicação não a executa.

-- Responsável: tipo do vínculo. 'legal' = responsável do aluno menor; 'indicado' = pessoa que o aluno maior indicou
-- (o aluno pode retirar). Só vale para vínculos responsavel_aluno. Os que já existem viram 'legal'.
ALTER TABLE vinculo ADD COLUMN tipo_responsavel text CHECK (tipo_responsavel IN ('legal', 'indicado'));
ALTER TABLE vinculo ADD CONSTRAINT vinculo_tipo_responsavel_so_responsavel
  CHECK (tipo_responsavel IS NULL OR tipo = 'responsavel_aluno');

CREATE FUNCTION vinculo_tipo_responsavel_padrao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo = 'responsavel_aluno' AND NEW.tipo_responsavel IS NULL THEN
    NEW.tipo_responsavel := 'legal';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER vinculo_tipo_responsavel_antes BEFORE INSERT ON vinculo
  FOR EACH ROW EXECUTE FUNCTION vinculo_tipo_responsavel_padrao();

-- Vínculos de responsável que já existiam: viram 'legal' (de novo, instituição por instituição por causa da RLS)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM instituicao LOOP
    PERFORM set_config('app.instituicao_id', r.id::text, true);
    UPDATE vinculo SET tipo_responsavel = 'legal'
     WHERE instituicao_id = r.id AND tipo = 'responsavel_aluno' AND tipo_responsavel IS NULL;
  END LOOP;
  PERFORM set_config('app.instituicao_id', '', true);
END $$;

-- Preenche as pessoas dos usuários existentes (mesma regra: uma pessoa por usuário, sem juntar)
SELECT pessoa_preencher_faltantes();
