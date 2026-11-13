# Retorno da migração 0028 (L22a-2) — 13/11/2026

Migração: `api/migracoes/0028_acompanhamento.sql`. Cria `acompanhamento` (por espaço, RLS), `convite_acompanhamento` (só o dono) e 5 funções
(`acompanhamento_convite_gravar`, `acompanhamento_aceitar`, `acompanhando_listar`, `acompanhando_aviso_visto`, `acompanhando_ler`) e o gatilho
`acompanhamento_limite`. Nenhuma tabela ou coluna antiga é alterada.

## Antes de aplicar
1. Backup: `bash scripts/backup.sh` (WSL).
2. Migrar: `CONFIRMA_BACKUP=sim docker compose --profile release run --rm --build migrate`.

## Como voltar
Opção A (preferida): restaurar o backup feito antes da migração.

Opção B (SQL, sem perder o resto; apaga só o que a 0028 criou, portanto perde os pedidos de acompanhamento feitos depois dela):
```sql
DROP FUNCTION IF EXISTS acompanhando_ler(uuid, uuid, text);
DROP FUNCTION IF EXISTS acompanhando_aviso_visto(uuid, uuid);
DROP FUNCTION IF EXISTS acompanhando_listar(uuid);
DROP FUNCTION IF EXISTS acompanhamento_aceitar(uuid, text);
DROP FUNCTION IF EXISTS acompanhamento_convite_gravar(uuid, uuid, text, text);
DROP TABLE IF EXISTS convite_acompanhamento;
DROP TABLE IF EXISTS acompanhamento;
DROP FUNCTION IF EXISTS acompanhamento_limite();
DELETE FROM _migracoes WHERE nome LIKE '0028%';
```
Código: `git revert` do commit do L22a-2.
