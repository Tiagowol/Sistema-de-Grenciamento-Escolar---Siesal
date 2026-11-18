# RETORNO da migração 0035 (L22i, item 3) — fila de pedidos de convite

A 0035 **adiciona** 8 funções (`pedido_convite_*`). Não cria tabela nem muda dado existente.

## Antes de aplicar
1. Backup: `bash scripts/backup.sh` (guarde o nome do arquivo `.dump`).
2. Aplicar pelo job `migrate`, com `CONFIRMA_BACKUP=sim`.

## Como voltar (escolha uma)
- **A. Restaurar o backup** feito antes da 0035.
- **B. Desfazer só a 0035** (o site precisa estar com o código anterior ao item 3):
  ```sql
  DROP FUNCTION IF EXISTS pedido_convite_recusar_admin(uuid, uuid, uuid);
  DROP FUNCTION IF EXISTS pedido_convite_aprovar_admin(uuid, uuid, uuid, text);
  DROP FUNCTION IF EXISTS pedido_convite_contar_admin(uuid, uuid);
  DROP FUNCTION IF EXISTS pedido_convite_listar_admin(uuid, uuid);
  DROP FUNCTION IF EXISTS pedido_convite_recusar(uuid, text);
  DROP FUNCTION IF EXISTS pedido_convite_aprovar(uuid, text, text);
  DROP FUNCTION IF EXISTS pedido_convite_contar();
  DROP FUNCTION IF EXISTS pedido_convite_listar();
  DELETE FROM _migracoes WHERE nome = '0035_pedido_convite_decisao.sql';
  ```
  Pedidos já decididos continuam na tabela; convites já criados continuam valendo até vencer (revogue em Convites, se preciso).

## Código
`git revert` dos commits do item 3, depois `docker compose up -d --build` e `docker compose restart proxy`.
