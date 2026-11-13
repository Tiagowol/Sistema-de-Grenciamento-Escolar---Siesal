# Retorno da migração 0029 (L22a-2b) — 13/11/2026

Migração: `api/migracoes/0029_acompanhamento_instituicao.sql`. Depende da 0028 (aplicar a 0028 antes).
Altera `acompanhamento` (colunas `origem`, `instituicao_acomp_id`, `instituicao_acomp_nome`, `usuario_acomp_id`; `email_convidado` passa a aceitar nulo;
novas regras de coerência e `encerrado_por` aceita `instituicao`), cria `codigo_acompanhamento` e 9 funções
(`acompanhamento_validade_instituicao`, `acompanhamento_codigo_pedir`, `acompanhamento_fila`, `acompanhamento_instituicao_aceitar`,
`acompanhamento_instituicao_encerrar`, `acompanhamento_instituicao_vinculos`, `acompanhamento_instituicao_aviso_visto`,
`acompanhamento_instituicao_ler`, `acompanhamento_instituicao_renovar`).

## Antes de aplicar
1. Backup: `bash scripts/backup.sh` (WSL).
2. Migrar: `CONFIRMA_BACKUP=sim docker compose --profile release run --rm --build migrate`.

## Como voltar
Opção A (preferida): restaurar o backup feito antes da migração.

Opção B (SQL; perde os pedidos feitos por código depois da 0029):
```sql
DROP FUNCTION IF EXISTS acompanhamento_instituicao_renovar(uuid, uuid[]);
DROP FUNCTION IF EXISTS acompanhamento_instituicao_ler(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS acompanhamento_instituicao_aviso_visto(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS acompanhamento_instituicao_vinculos(uuid);
DROP FUNCTION IF EXISTS acompanhamento_instituicao_encerrar(uuid, uuid, text);
DROP FUNCTION IF EXISTS acompanhamento_instituicao_aceitar(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS acompanhamento_fila(uuid);
DROP FUNCTION IF EXISTS acompanhamento_codigo_pedir(uuid, uuid, uuid, text, boolean, boolean, boolean, boolean, boolean);
DROP FUNCTION IF EXISTS acompanhamento_validade_instituicao(uuid);
DROP TABLE IF EXISTS codigo_acompanhamento;
DROP INDEX IF EXISTS acompanhamento_da_instituicao;
DROP INDEX IF EXISTS acompanhamento_codigo_aberto;
DELETE FROM acompanhamento WHERE origem = 'codigo';
ALTER TABLE acompanhamento DROP CONSTRAINT acompanhamento_encerrado_por_check;
ALTER TABLE acompanhamento ADD CONSTRAINT acompanhamento_encerrado_por_check CHECK (encerrado_por IN ('aluno', 'representante'));
ALTER TABLE acompanhamento DROP CONSTRAINT acompanhamento_origem_coerente;
ALTER TABLE acompanhamento DROP COLUMN usuario_acomp_id, DROP COLUMN instituicao_acomp_nome, DROP COLUMN instituicao_acomp_id, DROP COLUMN origem;
ALTER TABLE acompanhamento ALTER COLUMN email_convidado SET NOT NULL;
ALTER TABLE acompanhamento ADD CONSTRAINT acompanhamento_email_convidado_check CHECK (length(btrim(email_convidado)) BETWEEN 3 AND 254);
DELETE FROM _migracoes WHERE nome LIKE '0029%';
```
(O `DELETE FROM acompanhamento` apaga só pedidos por código; use só se aceitar perdê-los. Pela regra do projeto, prefira a opção A.)
Código: `git revert` do commit do L22a-2b.
