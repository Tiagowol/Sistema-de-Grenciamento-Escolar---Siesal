# Retorno da migração 0024 (L21b)

A 0024 acrescenta 1 coluna, `forma_dia` ('grade' ou 'lista', padrão 'grade'), em `preferencia_usuario`. Nada se apaga; as linhas existentes ficam em 'grade'. RLS e permissões da 0012 não mudam.

## Antes de aplicar
1. Backup (bash, terminal WSL): `bash scripts/backup.sh`
2. Aviso de 1 linha ao autor antes de aplicar no banco do site.
3. Aplicar só pelo job `migrate`; depois reconstruir API e site (`docker compose up -d --build`).

## Como voltar atrás
**Caminho seguro:** restaurar o backup feito antes da migração.

**Caminho em SQL** (perde só a escolha grade/lista de cada usuário):
```sql
ALTER TABLE preferencia_usuario DROP COLUMN forma_dia;
DELETE FROM _migracoes WHERE nome LIKE '0024%';
```
Ao voltar o banco, voltar também o código (sem a coluna, `PUT /preferencias` da API nova falha).
