# Retorno da migração 0011 (L17a: calendário do aluno)

A 0011 altera `evento` (tipos e origens novos, colunas `id_externo`, `oculto_em`, `atualizado_em`, índice `evento_id_externo`) e cria `evento_versao` (append-only, com RLS).

## Opção 1: restaurar o backup (volta tudo ao estado anterior)
1. Pare a API: `docker compose stop api`.
2. Restaure o dump feito antes da migração (`backups/`) com `pg_restore --clean --if-exists` (passo descrito e confirmado antes de executar).
3. Suba de novo: `docker compose up -d`.
Perde tudo o que foi gravado depois do backup.

## Opção 2: remover só o que a 0011 criou
Só se não houver evento novo (tipo trabalho, lembrete, compromisso, ou origem de importação) que importe:

```sql
BEGIN;
DROP TABLE evento_versao CASCADE;
DROP FUNCTION evento_versao_imutavel();
DROP INDEX evento_id_externo;
UPDATE evento SET tipo = 'pessoal' WHERE tipo IN ('trabalho', 'lembrete', 'compromisso');
UPDATE evento SET origem = 'manual' WHERE origem NOT IN ('manual', 'plano');
ALTER TABLE evento DROP COLUMN id_externo, DROP COLUMN oculto_em, DROP COLUMN atualizado_em;
ALTER TABLE evento DROP CONSTRAINT evento_tipo_check;
ALTER TABLE evento ADD CONSTRAINT evento_tipo_check CHECK (tipo IN ('aula', 'estudo', 'pessoal', 'prova'));
ALTER TABLE evento DROP CONSTRAINT evento_origem_check;
ALTER TABLE evento ADD CONSTRAINT evento_origem_check CHECK (origem IN ('manual', 'plano'));
DELETE FROM _migracoes WHERE nome = '0011_calendario.sql';
COMMIT;
```
Depois, volte o código ao commit anterior ao L17a. A auditoria é append-only e guarda os eventos `evento.*`; eles permanecem.
