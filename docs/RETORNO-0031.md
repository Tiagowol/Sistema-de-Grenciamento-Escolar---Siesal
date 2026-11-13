# RETORNO da migração 0031 (L22b) — árvore do Master

A 0031 só **cria 3 funções de leitura** (`arvore_instituicao`, `arvore_espacos_individuais`, `arvore_sem_vinculo`). Não cria tabela nem coluna e não muda dado. Por isso voltar atrás não perde nada.

## Antes de aplicar
1. Backup: `bash scripts/backup.sh` (guardar o nome do arquivo `.dump`).
2. Aplicar pelo job `migrate`, com `CONFIRMA_BACKUP=sim`.

## Como voltar (escolha uma)
- **A. Só remover as funções** (recomendado; o site volta ao que era, a árvore deixa de funcionar):
  ```sql
  DROP FUNCTION IF EXISTS arvore_instituicao(uuid);
  DROP FUNCTION IF EXISTS arvore_espacos_individuais();
  DROP FUNCTION IF EXISTS arvore_sem_vinculo();
  DELETE FROM _migracoes WHERE nome = '0031_arvore_master.sql';
  ```
  (a tabela de controle é `_migracoes`. Se apagar a linha, o job `migrate` volta a aplicar a 0031 na próxima vez.)
- **B. Restaurar o backup** feito antes da 0031 (perde o que foi gravado depois dele).

## Código
`git revert` do commit do L22b. O item 3 (faixa de ambiente) também volta sozinho removendo `SIESAL_AMBIENTE` do `.env` (sem a variável vale "teste").
