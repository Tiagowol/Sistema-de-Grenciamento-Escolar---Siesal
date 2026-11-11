-- Migração 0017 (L20): painel Master real. 4 situações da instituição, módulos por instituição e contagens
-- agregadas por perfil (só números). Nada se apaga. Retorno: backup feito antes, ou docs/RETORNO-0017.md.

-- 1. Situações: em implantação (só o Admin entra), ativa, suspensa e encerrada (ninguém entra; dados guardados)
ALTER TABLE instituicao DROP CONSTRAINT instituicao_situacao_check;
ALTER TABLE instituicao ADD CONSTRAINT instituicao_situacao_check
  CHECK (situacao IN ('em_implantacao', 'ativa', 'suspensa', 'encerrada'));

-- Módulos ligados ou desligados por instituição. Sem linha = ligado (o padrão de sempre).
CREATE TABLE instituicao_modulo (
  instituicao_id uuid        NOT NULL REFERENCES instituicao (id),
  modulo         text        NOT NULL CHECK (modulo IN ('mensagens', 'calendario', 'apoio_aluno')),
  ligado         boolean     NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, modulo)
);
ALTER TABLE instituicao_modulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE instituicao_modulo FORCE ROW LEVEL SECURITY;
-- A escola só lê os próprios módulos; o Master (siesal_ops) lê e muda os de todas
CREATE POLICY instituicao_modulo_da_instituicao ON instituicao_modulo FOR SELECT TO siesal_app
  USING (instituicao_id = nullif(current_setting('app.instituicao_id', true), '')::uuid);
CREATE POLICY instituicao_modulo_operacao ON instituicao_modulo TO siesal_ops USING (true) WITH CHECK (true);
GRANT SELECT ON instituicao_modulo TO siesal_app;
GRANT SELECT, INSERT, UPDATE ON instituicao_modulo TO siesal_ops;

-- 2. Contagens agregadas para o Master: só instituição, perfil e total de usuários ativos.
-- O siesal_ops não lê a tabela usuario; esta função lê por ele, uma instituição por vez (a RLS continua valendo:
-- o Master passa a lista de instituições, que ele já pode ler) e devolve só números. Nunca nome, e-mail ou nota.
CREATE FUNCTION contagem_por_perfil(instituicoes uuid[])
RETURNS TABLE (instituicao_id uuid, perfil text, total integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE inst uuid; anterior text := current_setting('app.instituicao_id', true);
BEGIN
  FOREACH inst IN ARRAY coalesce(instituicoes, '{}') LOOP
    PERFORM set_config('app.instituicao_id', inst::text, true);
    RETURN QUERY
      SELECT inst, u.perfil, count(*)::integer FROM usuario u
       WHERE u.situacao = 'ativo' AND u.desativado_em IS NULL
       GROUP BY u.perfil;
  END LOOP;
  PERFORM set_config('app.instituicao_id', coalesce(anterior, ''), true);
END $$;
REVOKE ALL ON FUNCTION contagem_por_perfil(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION contagem_por_perfil(uuid[]) TO siesal_ops;
