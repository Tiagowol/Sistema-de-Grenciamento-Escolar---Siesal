# Retorno da migração 0010 (L17: pedido de ajuda)

A 0010 acrescenta a tabela `pedido_ajuda`, 2 funções de gatilho (`pedido_ajuda_conferir`, `pedido_ajuda_so_atender`) e as políticas de RLS. Também altera `aviso_visto`: coluna nova `ajuda_id`, chave estrangeira, índice `aviso_visto_ajuda` e a regra "um item por linha" (`aviso_visto_um_item`, no lugar de `aviso_visto_check`).
Aplicada em 09/11/2026, 21:34, depois do backup `backups/siesal-20261109-213408.dump`.

## Opção 1: restaurar o backup (volta tudo ao estado anterior)
1. Pare a API: `docker compose stop api`.
2. Restaure `backups/siesal-20261109-213408.dump` com `pg_restore --clean --if-exists` no banco do projeto (passo descrito e confirmado antes de executar).
3. Suba de novo: `docker compose up -d`.
Perde tudo o que foi gravado depois do backup.

## Opção 2: remover só o que a 0010 criou
Só use se os pedidos de ajuda não tiverem dado que importe. Rode no banco como administrador:

```sql
BEGIN;
DELETE FROM aviso_visto WHERE ajuda_id IS NOT NULL;
DROP INDEX aviso_visto_ajuda;
ALTER TABLE aviso_visto DROP CONSTRAINT aviso_visto_um_item;
ALTER TABLE aviso_visto DROP COLUMN ajuda_id;
ALTER TABLE aviso_visto ADD CONSTRAINT aviso_visto_check
  CHECK ((pedido_id IS NOT NULL AND aviso_id IS NULL) OR (pedido_id IS NULL AND aviso_id IS NOT NULL));
DROP TABLE pedido_ajuda CASCADE;
DROP FUNCTION pedido_ajuda_conferir(), pedido_ajuda_so_atender();
DELETE FROM _migracoes WHERE nome = '0010_pedido_ajuda.sql';
COMMIT;
```

Depois, volte o código ao commit anterior ao L17 para a API não procurar a tabela.
A auditoria (`auditoria_evento`) é append-only e guarda os eventos `ajuda.*`. Eles permanecem, porque nada se apaga.
