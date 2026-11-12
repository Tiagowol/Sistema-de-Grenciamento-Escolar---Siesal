# Retorno da migração 0027 (L22a-1c)

A 0027 acrescenta: o papel `responsavel` e o tipo interno do Pedagógico (`tipo_profissional`) e o nascimento declarado em `pessoa`; a coluna `papel` em `pessoa_espaco` (com o gatilho atualizado e o preenchimento dos existentes); o gatilho do índice de e-mail do espaço individual passa a valer só para o perfil `aluno`; as colunas `termo_versao` e `aceito_em` em `vinculo`; a tabela `configuracao_plataforma` (limite de alunos por representante, padrão 5, o Master ajusta); as funções `plataforma_limite_alunos`, `representante_contar` e `representante_criar_aluno`; a nova `pessoa_cadastrar` (7 parâmetros, no lugar da de 6); e `pessoa_espacos` passa a incluir o perfil `responsavel`. **Nenhuma linha é apagada.** O fluxo antigo de cadastro de aluno menor (link do e-mail) continua.

## Antes de aplicar
1. Backup (bash, terminal WSL): `bash scripts/backup.sh`
2. Aviso de 1 linha ao autor antes de aplicar no banco do site.
3. Aplicar só pelo job `migrate`; depois reconstruir API e site (`docker compose up -d --build`).

## Ensaio já feito (12/11/2026, sem tocar no banco do site)
Backup `backups/siesal-20261112-174047.dump` (já com a 0026) restaurado em banco temporário (depois apagado) e a 0027 aplicada como `siesal_owner`: 40 usuários, 40 em `pessoa_espaco`, 0 sem papel, limite 5, 6 vínculos de responsável todos "legal".

## Como voltar atrás
**Caminho seguro:** restaurar o backup feito antes da migração.

**Caminho em SQL** (só vale se nenhum representante criou aluno; senão, esses espaços e vínculos ficam e o retorno correto é o backup):
```sql
DROP FUNCTION representante_criar_aluno(uuid, text, text, text, text, date, date, text);
DROP FUNCTION representante_contar(uuid);
DROP FUNCTION plataforma_limite_alunos();
DROP TABLE configuracao_plataforma;
ALTER TABLE vinculo DROP COLUMN termo_versao, DROP COLUMN aceito_em;
-- volta a pessoa_cadastrar da 0026 (6 parâmetros), o gatilho do índice de e-mail da 0020 e pessoa_espacos da 0026:
-- copiar as definições de api/migracoes/0020, 0026 (pessoa_cadastrar, pessoa_espacos) e 0026 (usuario_manter_pessoa_espaco)
DROP FUNCTION pessoa_cadastrar(text, text, text, text, text, text, text);
ALTER TABLE pessoa_espaco DROP COLUMN papel;
ALTER TABLE pessoa DROP COLUMN tipo_profissional, DROP COLUMN nascimento;
ALTER TABLE pessoa DROP CONSTRAINT pessoa_papel_desejado_check;
ALTER TABLE pessoa ADD CONSTRAINT pessoa_papel_desejado_check CHECK (papel_desejado IN ('professor', 'pedagogico'));
DELETE FROM _migracoes WHERE nome LIKE '0027%';
```
Ao voltar o banco, voltar também o código e o ramo.
