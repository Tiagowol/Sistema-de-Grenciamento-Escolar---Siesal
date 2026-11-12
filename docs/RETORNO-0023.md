# Retorno da migração 0023 (20d)

A 0023 acrescenta: a coluna `dificuldade` (0 a 10, opcional) em `tarefa` e `disciplina_aluno`, a tabela `cartao_resumo` (RLS forçada) e 1 gatilho de limite (20 cards por tarefa e por disciplina). **Não altera nem apaga** dado existente.

## Antes de aplicar
1. Backup (bash, terminal WSL): `bash scripts/backup.sh`
2. Aviso de 1 linha ao autor antes de aplicar no banco do site.
3. A API só reconstrói com o procedimento da F-052 (certificado do Norton), se o erro voltar.

## Como voltar atrás
**Caminho seguro:** restaurar o backup feito antes da migração.

**Caminho em SQL** (só se nenhum card foi criado e nenhuma dificuldade foi marcada; senão, esses dados somem):
```sql
DROP TRIGGER cartao_resumo_limite ON cartao_resumo;
DROP FUNCTION cartao_resumo_limite();
DROP TABLE cartao_resumo;
ALTER TABLE disciplina_aluno DROP COLUMN dificuldade;
ALTER TABLE tarefa DROP COLUMN dificuldade;
DELETE FROM _migracoes WHERE nome LIKE '0023%';
```
Ao voltar o código, voltar também o ramo (sem a 0023 a API nova não sobe as rotas de dificuldade e de cards).

## Observação
O evento da agenda já tinha a coluna `tarefa_id`; a grade do dia só passou a preenchê-la. Nenhuma migração para isso.
