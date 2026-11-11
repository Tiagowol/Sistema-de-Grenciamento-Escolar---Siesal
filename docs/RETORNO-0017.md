# Retorno da migração 0017 (L20: painel Master real)

A 0017 troca a regra de `instituicao.situacao` (de 2 para 4 situações), cria a tabela `instituicao_modulo` e a função `contagem_por_perfil(uuid[])`. Não muda nenhum dado existente: as instituições continuam `ativa` ou `suspensa`.

## Antes de aplicar
1. Backup no terminal WSL: `bash scripts/backup.sh`. Terminou quando: aparece o arquivo `.dump` novo em `backups/`, com o `.sha256`.
2. Aplicar: `CONFIRMA_BACKUP=sim docker compose --profile release run --rm --build migrate`. Terminou quando: aparece `aplicada 0017_master.sql`.

## Opção 1: restaurar o backup (volta tudo ao estado anterior)
1. Pare a API: `docker compose stop api`.
2. Restaure o dump feito antes da migração (`backups/`) com `pg_restore --clean --if-exists` (passo descrito e confirmado antes de executar).
3. Suba de novo: `docker compose up -d`.
Perde tudo o que foi gravado depois do backup.

## Opção 2: remover só o que a 0017 criou
Antes, volte para `ativa` ou `suspensa` toda instituição que estiver `em_implantacao` ou `encerrada` (pelo painel do Master), senão a regra antiga é recusada. Os módulos voltam todos a ligados.

```sql
BEGIN;
DROP FUNCTION contagem_por_perfil(uuid[]);
DROP TABLE instituicao_modulo;
ALTER TABLE instituicao DROP CONSTRAINT instituicao_situacao_check;
ALTER TABLE instituicao ADD CONSTRAINT instituicao_situacao_check CHECK (situacao IN ('ativa', 'suspensa'));
DELETE FROM _migracoes WHERE nome = '0017_master.sql';
COMMIT;
```
Depois, volte o código ao commit anterior ao L20. A trilha `operator_auditoria` é append-only e guarda os eventos do L20; eles permanecem.
