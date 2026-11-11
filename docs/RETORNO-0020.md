# Retorno da migração 0020 (20c-1)

A 0020 acrescenta: a coluna `tipo` em `instituicao` (padrão "escola"), a tabela `espaco_individual` (índice de e-mails), 5 funções, 1 gatilho em `usuario` e a coluna `disciplinas_convertidas_em` em `preferencia_usuario`. **Não altera nem apaga** dado existente: todas as instituições atuais viram "escola".

## Antes de aplicar
1. Backup (bash, terminal WSL): `bash scripts/backup.sh`
2. Aviso de 1 linha ao autor antes de aplicar no banco do site.
3. A API só reconstrói com o procedimento da F-052 (certificado do Norton).

## Como voltar atrás
**Caminho seguro:** restaurar o backup feito antes da migração.

**Caminho em SQL** (só se nenhum espaço individual foi criado; senão, ele some junto com o índice):
```sql
DROP TRIGGER usuario_espaco_individual ON usuario;
DROP FUNCTION usuario_espaco_individual();
DROP FUNCTION espaco_individual_achar(text);
DROP FUNCTION espaco_individual_contar();
DROP FUNCTION espaco_individual_registrar(uuid, text);
DROP FUNCTION espaco_individual_remover(uuid, text);
DROP TABLE espaco_individual;
ALTER TABLE preferencia_usuario DROP COLUMN disciplinas_convertidas_em;
ALTER TABLE instituicao DROP COLUMN tipo;
DELETE FROM _migracoes WHERE nome LIKE '0020%';
```
Ao voltar o código, voltar também o ramo (sem a 0020 o código novo não sobe).
