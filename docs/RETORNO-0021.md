# Retorno da migração 0021 (20c-3)

A 0021 acrescenta a coluna `tipo` em `convite_individual` (os convites que já existem viram "individual"), uma política de inserção e uma função nova, e atualiza a função de criar espaço individual (só passa a exigir `tipo = 'individual'`). **Não altera nem apaga** dado existente.

## Antes de aplicar
1. Backup (bash, terminal WSL): `bash scripts/backup.sh`
2. Aviso de 1 linha ao autor antes de aplicar no banco do site.
3. A API só reconstrói com o procedimento da F-052 (certificado do Norton).

## Como voltar atrás
**Caminho seguro:** restaurar o backup feito antes da migração.

**Caminho em SQL** (as instituições já criadas por convite continuam existindo; só some a possibilidade de criar novas):
```sql
DROP FUNCTION instituicao_criar_por_convite(text, text, text, text, text);
DROP POLICY instituicao_criar_escola ON instituicao;
-- volta a função de espaço individual para a versão da 0020 (sem o filtro de tipo): reexecutar o bloco
-- "CREATE FUNCTION espaco_individual_criar" do arquivo 0020_espaco_individual.sql com CREATE OR REPLACE
ALTER TABLE convite_individual DROP COLUMN tipo;
DELETE FROM _migracoes WHERE nome LIKE '0021%';
```
Ao voltar o código, voltar também o ramo (sem a 0021 o código novo não sobe).
