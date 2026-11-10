# Retorno da migração 0012 (L17b: personalização e tipos de atividade)

A 0012 cria `preferencia_usuario` e `tipo_atividade` (com RLS) e acrescenta `tipo_atividade_id` em `tarefa` e `evento`.

## Opção 1: restaurar o backup (volta tudo ao estado anterior)
1. Pare a API: `docker compose stop api`.
2. Restaure o dump feito antes da migração (`backups/`) com `pg_restore --clean --if-exists` (passo descrito e confirmado antes de executar).
3. Suba de novo: `docker compose up -d`.
Perde tudo o que foi gravado depois do backup.

## Opção 2: remover só o que a 0012 criou
Só se as preferências e os tipos criados depois da migração não importarem:

```sql
BEGIN;
ALTER TABLE tarefa DROP COLUMN tipo_atividade_id;
ALTER TABLE evento DROP COLUMN tipo_atividade_id;
DROP TABLE tipo_atividade CASCADE;
DROP TABLE preferencia_usuario CASCADE;
DELETE FROM _migracoes WHERE nome = '0012_personalizacao.sql';
COMMIT;
```
Depois, volte o código ao commit do L17a. A auditoria é append-only e guarda os eventos `preferencias.*` e `tipo_atividade.*`; eles permanecem.
