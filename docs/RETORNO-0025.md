# Retorno da migração 0025 (L22a-1a)

A 0025 acrescenta: a tabela `pessoa` (RLS forçada; só o dono e as funções leem), a coluna `usuario.pessoa_id`, o gatilho que dá uma pessoa a todo usuário novo, a função `pessoa_preencher_faltantes()`, a coluna `vinculo.tipo_responsavel` ('legal' ou 'indicado') com gatilho de padrão 'legal', e uma política de leitura de `instituicao` para o dono. **Nenhuma linha é apagada.** O login não muda.

## Antes de aplicar
1. Backup (bash, terminal WSL): `bash scripts/backup.sh`
2. Aviso de 1 linha ao autor antes de aplicar no banco do site.
3. Aplicar só pelo job `migrate`; depois reconstruir API e site (`docker compose up -d --build`).

## Ensaio já feito (12/11/2026, sem tocar no banco do site)
Backup `backups/siesal-20261112-161511.dump` restaurado em banco temporário (depois apagado) e a 0025 aplicada como `siesal_owner`: 40 usuários, 40 pessoas, 0 usuários sem pessoa, 6 vínculos de responsável, todos 'legal'.

## Como voltar atrás
**Caminho seguro:** restaurar o backup feito antes da migração.

**Caminho em SQL** (perde só as pessoas e o tipo do responsável; nenhum dado escolar):
```sql
DROP TRIGGER vinculo_tipo_responsavel_antes ON vinculo;
DROP FUNCTION vinculo_tipo_responsavel_padrao();
ALTER TABLE vinculo DROP CONSTRAINT vinculo_tipo_responsavel_so_responsavel;
ALTER TABLE vinculo DROP COLUMN tipo_responsavel;
DROP TRIGGER usuario_pessoa_antes ON usuario;
DROP FUNCTION usuario_garantir_pessoa();
DROP FUNCTION pessoa_preencher_faltantes();
DROP INDEX usuario_pessoa;
ALTER TABLE usuario DROP COLUMN pessoa_id;
DROP TABLE pessoa;
DROP POLICY instituicao_listar_dono ON instituicao;
DELETE FROM _migracoes WHERE nome LIKE '0025%';
```
Ao voltar o banco, voltar também o código e o ramo.
