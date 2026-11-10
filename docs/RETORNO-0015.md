# Retorno da migração 0015 (L17d: preferências de interface)

A 0015 cria só a tabela `preferencia_interface` (com RLS). Não altera tabela existente.

## Antes de aplicar
1. Backup no terminal WSL: `bash scripts/backup.sh`. Terminou quando: aparece o arquivo `.dump` novo em `backups/`, com o `.sha256`.
2. Aplicar: `CONFIRMA_BACKUP=sim docker compose --profile release run --rm --build migrate`. Terminou quando: aparece `aplicada 0015_interface.sql`.

## Opção 1: restaurar o backup (volta tudo ao estado anterior)
1. Pare a API: `docker compose stop api`.
2. Restaure o dump feito antes da migração (`backups/`) com `pg_restore --clean --if-exists` (passo descrito e confirmado antes de executar).
3. Suba de novo: `docker compose up -d`.
Perde tudo o que foi gravado depois do backup.

## Opção 2: remover só o que a 0015 criou
Só se as preferências de interface gravadas depois da migração não importarem (o padrão volta: ícones, VLibras mostrado, aviso ainda não aceito):

```sql
BEGIN;
DROP TABLE preferencia_interface CASCADE;
DELETE FROM _migracoes WHERE nome = '0015_interface.sql';
COMMIT;
```
Depois, volte o código ao commit anterior ao L17d (`05f3d01`). A auditoria é append-only e guarda os eventos `interface.*`; eles permanecem.
