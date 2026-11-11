# Retorno da migração 0016 (L19: Admin institucional)

A 0016 cria 5 tabelas (`calendario_escolar`, `calendario_escolar_versao`, `calendario_escolar_oculto`, `regra_nota_versao`, `identidade_instituicao_versao`), a função `l19_append_only` e acrescenta a coluna `regra_numero` (opcional) em `nota_oficial_versao`. Não muda nenhum dado existente.

## Antes de aplicar
1. Backup no terminal WSL: `bash scripts/backup.sh`. Terminou quando: aparece o arquivo `.dump` novo em `backups/`, com o `.sha256`.
2. Aplicar: `CONFIRMA_BACKUP=sim docker compose --profile release run --rm --build migrate`. Terminou quando: aparece `aplicada 0016_admin_institucional.sql`.

## Opção 1: restaurar o backup (volta tudo ao estado anterior)
1. Pare a API: `docker compose stop api`.
2. Restaure o dump feito antes da migração (`backups/`) com `pg_restore --clean --if-exists` (passo descrito e confirmado antes de executar).
3. Suba de novo: `docker compose up -d`.
Perde tudo o que foi gravado depois do backup.

## Opção 2: remover só o que a 0016 criou
Só se o calendário da escola, as regras de notas e a identidade gravados depois da migração não importarem. As notas continuam; perdem só a citação da regra.

```sql
BEGIN;
ALTER TABLE nota_oficial_versao DROP CONSTRAINT nota_oficial_versao_regra;
ALTER TABLE nota_oficial_versao DROP COLUMN regra_numero;
DROP TABLE identidade_instituicao_versao, regra_nota_versao, calendario_escolar_oculto,
           calendario_escolar_versao, calendario_escolar CASCADE;
DROP FUNCTION l19_append_only();
DELETE FROM _migracoes WHERE nome = '0016_admin_institucional.sql';
COMMIT;
```
Atenção: `nota_oficial_versao` pode ter trava contra alteração; se o `DROP COLUMN` for recusado, use a Opção 1.
Depois, volte o código ao commit anterior ao L19. A auditoria é append-only e guarda os eventos `calendario_escolar.*`, `regra_nota.*` e `identidade.*`; eles permanecem.
