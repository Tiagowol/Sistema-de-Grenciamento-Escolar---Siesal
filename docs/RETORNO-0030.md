# Retorno da migração 0030 (L22a-3) — 13/11/2026

Migração: `api/migracoes/0030_representante_ver_tudo.sql`. Depende da 0029 (aplicar a 0029 antes).
Só funções e um `UPDATE` de data. **Nenhuma tabela nem coluna nova.**

- Cria 4 funções: `aluno_ler_item` (leitura interna, sem permissão para o app), `representado_ler`, `representado_ficha`, `pessoa_papel`.
- Substitui 2 funções (`CREATE OR REPLACE`): `acompanhando_ler` (0028) e `acompanhamento_instituicao_ler` (0029). Agora aceitam os itens `agenda` e `disciplinas`, que seguem a caixa "Tarefas e plano" (`ver_tarefas`).
- `UPDATE acompanhamento SET itens_alterados_em = now() WHERE ver_tarefas AND situacao <> 'encerrado'`: o acompanhante vê o aviso de novo e o aluno vê o novo rótulo.

## Antes de aplicar
1. Backup: `bash scripts/backup.sh` (WSL).
2. Migrar: `CONFIRMA_BACKUP=sim docker compose --profile release run --rm --build migrate`.

## Como voltar
Opção A (preferida): restaurar o backup feito antes da migração.

Opção B (SQL): recria as duas funções com o texto da 0028 e da 0029 e remove as novas. O código novo (rota `/representado`, tela "Meu aluno") deixa de funcionar; faça também o `git revert` do commit do lote.
```sql
DROP FUNCTION IF EXISTS pessoa_papel(uuid);
DROP FUNCTION IF EXISTS representado_ficha(uuid, uuid);
DROP FUNCTION IF EXISTS representado_ler(uuid, uuid, text);
-- Recriar acompanhando_ler(uuid, uuid, text): copiar o CREATE FUNCTION da seção 5 de api/migracoes/0028_acompanhamento.sql
-- Recriar acompanhamento_instituicao_ler(uuid, uuid, uuid, text): copiar o da seção 10 de api/migracoes/0029_acompanhamento_instituicao.sql
-- (use CREATE OR REPLACE: elas dependem de aluno_ler_item só na versão nova; depois remova-a)
DROP FUNCTION IF EXISTS aluno_ler_item(uuid, uuid, text);
```
O `UPDATE` da data das caixas não precisa de retorno: só faz o aviso aparecer de novo.
