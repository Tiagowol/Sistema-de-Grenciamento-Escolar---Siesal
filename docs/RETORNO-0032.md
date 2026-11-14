# RETORNO da migração 0032 (L22c) — Termo 6, revogar convite

A 0032 **adiciona colunas** (`instituicao.termo_versao`, `instituicao.termo_aceito_em`, `convite_individual.revogado_em`, `convite_individual.revogado_por`), um `GRANT UPDATE` de colunas e **troca uma função** (`instituicao_criar_por_convite` passa a ter 6 parâmetros). Não apaga nem muda dado existente.

## Antes de aplicar
1. Backup: `bash scripts/backup.sh` (guarde o nome do arquivo `.dump`).
2. Aplicar pelo job `migrate`, com `CONFIRMA_BACKUP=sim`.

## Como voltar (escolha uma)
- **A. Restaurar o backup** feito antes da 0032 (perde o que foi gravado depois dele). É o caminho mais simples e seguro.
- **B. Desfazer só a 0032** (o site precisa estar com o código anterior ao L22c, senão o cadastro de instituição para de funcionar):
  ```sql
  DROP FUNCTION IF EXISTS instituicao_criar_por_convite(text, text, text, text, text, text);
  CREATE FUNCTION instituicao_criar_por_convite(
    p_codigo_hash text, p_nome_instituicao text, p_nome_admin text, p_email text, p_senha_hash text
  ) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DECLARE v_convite uuid; v_inst uuid := gen_random_uuid(); v_usuario uuid := gen_random_uuid();
  BEGIN
    SELECT id INTO v_convite FROM convite_individual
     WHERE codigo_hash = p_codigo_hash AND tipo = 'instituicao' AND usado_em IS NULL AND expira_em > now() FOR UPDATE;
    IF v_convite IS NULL THEN RAISE EXCEPTION 'convite invalido ou vencido'; END IF;
    PERFORM set_config('app.instituicao_id', v_inst::text, true);
    INSERT INTO instituicao (id, nome, tipo, situacao) VALUES (v_inst, btrim(p_nome_instituicao), 'escola', 'em_implantacao');
    INSERT INTO usuario (id, instituicao_id, perfil, nome, email) VALUES (v_usuario, v_inst, 'admin', btrim(p_nome_admin), btrim(p_email));
    INSERT INTO credencial (instituicao_id, usuario_id, senha_hash) VALUES (v_inst, v_usuario, p_senha_hash);
    UPDATE convite_individual SET usado_em = now(), instituicao_id = v_inst WHERE id = v_convite;
    PERFORM set_config('app.instituicao_id', '', true);
    RETURN v_inst;
  END $$;
  REVOKE ALL ON FUNCTION instituicao_criar_por_convite(text, text, text, text, text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION instituicao_criar_por_convite(text, text, text, text, text) TO siesal_app;
  REVOKE UPDATE (expira_em, revogado_em, revogado_por) ON convite_individual FROM siesal_ops;
  ALTER TABLE convite_individual DROP COLUMN revogado_em, DROP COLUMN revogado_por;
  ALTER TABLE instituicao DROP COLUMN termo_versao, DROP COLUMN termo_aceito_em;
  DELETE FROM _migracoes WHERE nome = '0032_admin_convites.sql';
  ```
  Atenção: apagar as colunas **perde** o aceite do Termo 6 já gravado e a marca de convites revogados (um convite revogado voltaria a valer só se ainda não tivesse vencido: a revogação também vence o convite, então ele continua vencido).

## Código
`git revert` do commit do lote. A migração e o código andam juntos: não deixe o código novo com o banco antigo (o cadastro de instituição chama a função de 6 parâmetros) nem o código antigo com o banco novo (a função de 5 parâmetros não existe mais).
