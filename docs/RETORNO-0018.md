# Retorno da migração 0018 (L20a)

A 0018 só acrescenta: um valor ao tema e 3 colunas com valor padrão. Nenhum dado é apagado ou convertido.

## Antes de aplicar
1. Backup (bash, terminal WSL): `bash scripts/backup.sh`
2. Aviso de 1 linha ao autor antes de aplicar no banco do site.

## Como voltar atrás
**Caminho seguro:** restaurar o backup feito antes da migração.

**Caminho em SQL** (só se ninguém usou o tema novo; senão a linha precisa ser ajustada antes):
```sql
UPDATE preferencia_usuario SET tema = 'alto_contraste' WHERE tema = 'alto_contraste_escuro';
ALTER TABLE preferencia_usuario DROP CONSTRAINT preferencia_usuario_blocos_check;
ALTER TABLE preferencia_usuario DROP COLUMN minutos_curto, DROP COLUMN minutos_medio, DROP COLUMN minutos_longo;
ALTER TABLE preferencia_usuario DROP CONSTRAINT preferencia_usuario_tema_check;
ALTER TABLE preferencia_usuario ADD CONSTRAINT preferencia_usuario_tema_check
  CHECK (tema IN ('claro', 'escuro', 'alto_contraste'));
DELETE FROM _migracoes WHERE nome LIKE '0018%';  -- ajuste ao nome da tabela de controle usada pelo job migrate
```
Ao voltar o código, voltar também o ramo `siesal-4` (sem a 0018 o código novo não sobe).
