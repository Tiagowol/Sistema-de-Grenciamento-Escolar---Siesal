# Retorno da migração 0026 (L22a-1b)

A 0026 acrescenta: 3 colunas em `pessoa` (papel desejado, versão e data do termo); as tabelas `credencial_pessoa`, `sessao_pessoa`, `pedido_email_pessoa` e `pessoa_espaco` (todas com RLS forçada, só o dono lê); o gatilho que mantém `pessoa_espaco`; e as funções `pessoa_cadastrar`, `pessoa_confirmar_email`, `pessoa_credencial`, `pessoa_registrar_falha`, `pessoa_sessao_abrir`, `pessoa_sessao_obter`, `pessoa_sessao_encerrar` e `pessoa_espacos`. **Nenhuma linha é apagada.** O login antigo não muda.

## Antes de aplicar
1. Backup (bash, terminal WSL): `bash scripts/backup.sh`
2. Aviso de 1 linha ao autor antes de aplicar no banco do site.
3. Aplicar só pelo job `migrate`; depois reconstruir API e site (`docker compose up -d --build`).

## Ensaio já feito (12/11/2026, sem tocar no banco do site)
Backup `backups/siesal-20261112-170955.dump` (já com a 0025) restaurado em banco temporário (depois apagado) e a 0026 aplicada como `siesal_owner`: 40 usuários, 40 linhas em `pessoa_espaco`, 40 usuários com pessoa.

## Como voltar atrás
**Caminho seguro:** restaurar o backup feito antes da migração.

**Caminho em SQL** (perde só os cadastros próprios e as sessões de pessoa; nenhum dado escolar):
```sql
DROP FUNCTION pessoa_espacos(uuid);
DROP FUNCTION pessoa_sessao_encerrar(text);
DROP FUNCTION pessoa_sessao_obter(text);
DROP FUNCTION pessoa_sessao_abrir(uuid, text, integer);
DROP FUNCTION pessoa_registrar_falha(uuid, integer, integer);
DROP FUNCTION pessoa_credencial(text);
DROP FUNCTION pessoa_confirmar_email(text);
DROP FUNCTION pessoa_cadastrar(text, text, text, text, text, text);
DROP TRIGGER usuario_pessoa_espaco_depois ON usuario;
DROP FUNCTION usuario_manter_pessoa_espaco();
DROP TABLE pessoa_espaco;
DROP TABLE pedido_email_pessoa;
DROP TABLE sessao_pessoa;
DROP TABLE credencial_pessoa;
ALTER TABLE pessoa DROP COLUMN papel_desejado, DROP COLUMN termo_versao, DROP COLUMN termo_aceito_em;
DELETE FROM _migracoes WHERE nome LIKE '0026%';
```
Ao voltar o banco, voltar também o código e o ramo.
