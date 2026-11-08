# Retorno da migração 0008 (Lote 15: notas oficiais e pedidos de revisão)

A 0008 só acrescenta 3 tabelas (`nota_oficial`, `nota_oficial_versao`, `pedido_revisao`), 4 funções de gatilho e as políticas de RLS. Nenhuma tabela existente é alterada.

Backup feito antes de aplicar: `backups/siesal-20261108-142240.dump` (com `.sha256`).

## Opção 1 — restaurar o backup (volta tudo ao estado anterior)
1. Pare a API: `docker compose stop api`.
2. Restaure o dump com `pg_restore --clean --if-exists` no banco do projeto (passo descrito e confirmado antes de executar).
3. Suba de novo: `docker compose up -d`.
Perde tudo que foi gravado depois do backup (inclusive as contas de teste do L15).

## Opção 2 — remover só o que a 0008 criou (sem tocar no resto)
Só use se as 3 tabelas não tiverem dado que importe. Rode no banco como administrador:

```sql
BEGIN;
DROP TABLE pedido_revisao, nota_oficial_versao, nota_oficial CASCADE;
DROP FUNCTION nota_oficial_conferir(), nota_oficial_versao_conferir(),
              pedido_revisao_conferir(), pedido_revisao_so_responder();
DELETE FROM _migracoes WHERE nome = '0008_notas_oficiais.sql';
COMMIT;
```

Depois, volte ao código do commit anterior do L14 para a API não procurar as tabelas.
A auditoria (`auditoria_evento`) é append-only e guarda os eventos `nota.*` e `pedido_revisao.*`; eles permanecem (nada se apaga).
