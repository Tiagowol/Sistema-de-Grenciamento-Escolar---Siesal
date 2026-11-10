# Retorno da migração 0013 (L17c: conta e suporte)

A 0013 acrescenta `usuario.encerrada_em`, cria `pedido_conta` e `pedido_suporte` (com RLS), acrescenta `aviso_visto.suporte_id` (e troca a regra "um item por linha"), e substitui 2 funções de gatilho (`pedido_ajuda_so_atender`, `evento_versao_imutavel`) para permitir limpar texto pessoal só de conta encerrada. Também concede UPDATE em `evento_versao` ao papel da aplicação.

## Opção 1: restaurar o backup (volta tudo ao estado anterior)
1. Pare a API: `docker compose stop api`.
2. Restaure o dump feito antes da migração (`backups/`) com `pg_restore --clean --if-exists` (passo descrito e confirmado antes de executar).
3. Suba de novo: `docker compose up -d`.
Perde tudo o que foi gravado depois do backup. Contas encerradas depois da migração voltam a existir só pelo backup (a anonimização não se desfaz de outro modo).

## Opção 2: remover só o que a 0013 criou
Só se nenhuma conta foi encerrada e os pedidos criados depois da migração não importarem:

```sql
BEGIN;
DELETE FROM aviso_visto WHERE suporte_id IS NOT NULL;
DROP INDEX aviso_visto_suporte;
ALTER TABLE aviso_visto DROP CONSTRAINT aviso_visto_um_item;
ALTER TABLE aviso_visto DROP COLUMN suporte_id;
ALTER TABLE aviso_visto ADD CONSTRAINT aviso_visto_um_item CHECK (num_nonnulls(pedido_id, aviso_id, ajuda_id) = 1);
DROP TABLE pedido_suporte CASCADE;
DROP TABLE pedido_conta CASCADE;
REVOKE UPDATE ON evento_versao FROM siesal_app;
CREATE OR REPLACE FUNCTION evento_versao_imutavel() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  RAISE EXCEPTION 'evento_versao é append-only: % não é permitido', TG_OP;
END $f$;
-- Recrie pedido_ajuda_so_atender com o texto da migração 0010 (sem o desvio de conta encerrada).
ALTER TABLE usuario DROP COLUMN encerrada_em;
DELETE FROM _migracoes WHERE nome = '0013_conta_suporte.sql';
COMMIT;
```
Antes de `COMMIT`, copie a função `pedido_ajuda_so_atender` de `api/migracoes/0010_pedido_ajuda.sql`. Depois, volte o código ao commit do L17b. A auditoria é append-only e guarda os eventos `conta.*` e `suporte.*`; eles permanecem.
