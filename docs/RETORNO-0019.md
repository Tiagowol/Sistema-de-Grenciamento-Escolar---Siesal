# Retorno da migração 0019 (L20b)

A 0019 cria tabelas e colunas novas e liga as tarefas e notas existentes a disciplinas do aluno. **Não altera nem apaga** nenhuma coluna existente: o texto da disciplina em `tarefa` e `nota_pessoal` continua igual.

## Antes de aplicar
1. Backup (bash, terminal WSL): `bash scripts/backup.sh`
2. Aviso de 1 linha ao autor antes de aplicar no banco do site.
3. A API só reconstrói com o procedimento da F-052 (certificado do Norton).

## Como voltar atrás
**Caminho seguro:** restaurar o backup feito antes da migração.

**Caminho em SQL** (perde as disciplinas que os alunos criaram depois da 0019; as tarefas e notas ficam como estão):
```sql
ALTER TABLE nota_pessoal DROP COLUMN disciplina_aluno_id;
ALTER TABLE tarefa DROP COLUMN disciplina_aluno_id;
ALTER TABLE preferencia_usuario DROP COLUMN etapa_disciplinas;
DROP TABLE disciplina_aluno;
DROP FUNCTION disciplina_aluno_limite();
DROP TABLE disciplina_catalogo;
DROP FUNCTION sem_acento(text);
DELETE FROM _migracoes WHERE nome LIKE '0019%';
```
Ao voltar o código, voltar também o ramo (sem a 0019 o código novo não sobe).
