# RETORNO da migração 0034 (L22i, item 2) — pedido de convite

A 0034 **adiciona** uma tabela (`pedido_convite`) e uma função (`pedido_convite_criar`). Não apaga nem muda dado existente.

## Antes de aplicar
1. Backup: `bash scripts/backup.sh` (guarde o nome do arquivo `.dump`).
2. Aplicar pelo job `migrate`, com `CONFIRMA_BACKUP=sim`.

## Como voltar (escolha uma)
- **A. Restaurar o backup** feito antes da 0034 (perde o que foi gravado depois dele). É o caminho mais simples e seguro.
- **B. Desfazer só a 0034** (o site precisa estar com o código anterior ao L22i item 2; senão "Solicitar convite" falha):
  ```sql
  DROP FUNCTION IF EXISTS pedido_convite_criar(text, text, text);
  DROP TABLE IF EXISTS pedido_convite;
  DELETE FROM _migracoes WHERE nome = '0034_pedido_convite.sql';
  ```
  Os pedidos já feitos são perdidos nesse caminho.

## Código
`git revert` dos commits do L22i item 2, depois `docker compose up -d --build` e `docker compose restart proxy`.
