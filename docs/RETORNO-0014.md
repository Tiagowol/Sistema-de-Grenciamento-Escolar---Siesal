# Retorno da migração 0014 (L18: login dos Masters)

A 0014 acrescenta colunas em `operator_account` (TOTP, bloqueio, convite), cria `operator_sessao` e `operator_auditoria` (com RLS, gatilhos e 4 funções). O job `migrate` também passa a executar `GRANT siesal_ops TO siesal_app WITH INHERIT FALSE, SET TRUE`. Nenhuma tabela escolar muda.

## Opção 1: restaurar o backup (volta tudo ao estado anterior)
1. Pare a API: `docker compose stop api`.
2. Restaure o dump feito antes da migração (`backups/`) com `pg_restore --clean --if-exists` (passo descrito e confirmado antes de executar).
3. Suba de novo: `docker compose up -d`.
Perde tudo o que foi gravado depois do backup.

## Opção 2: remover só o que a 0014 criou
Perde as senhas, os TOTP e a trilha dos Masters. As instituições criadas ou suspensas pelo painel continuam como estão.

```sql
BEGIN;
DROP TABLE operator_sessao;
DROP TABLE operator_auditoria CASCADE;
DROP FUNCTION operator_auditoria_preparar();
DROP FUNCTION operator_auditoria_bloquear();
UPDATE operator_account SET situacao = 'pendente', senha_hash = NULL WHERE situacao = 'ativo';
ALTER TABLE operator_account
  DROP COLUMN totp_segredo_cifrado, DROP COLUMN totp_ativo, DROP COLUMN totp_ultimo_passo,
  DROP COLUMN falhas_seguidas, DROP COLUMN bloqueado_ate, DROP COLUMN convite_hash,
  DROP COLUMN convite_expira_em, DROP COLUMN atualizado_em;
REVOKE siesal_ops FROM siesal_app;
DELETE FROM _migracoes WHERE nome = '0014_masters.sql';
COMMIT;
```
Rodar como administrador do banco. `DROP TABLE operator_auditoria CASCADE` leva junto as funções `operator_auditoria_texto` e `operator_auditoria_verificar`. Depois, volte o código ao commit do L17c (`1453fca`); sem isso a API tenta `SET ROLE` e as rotas `/operacao/*` respondem erro 500 (as rotas da escola não são afetadas).

## Se uma instituição ficou suspensa por engano
Entrar em `/operacao` e usar "Reativar". Sem acesso ao painel, como administrador do banco:

```sql
UPDATE instituicao SET situacao = 'ativa' WHERE id = '<id da instituição>';
```
