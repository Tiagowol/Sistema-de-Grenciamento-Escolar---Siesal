# PROPOSTA L22l — Correção definitiva da F-061 (fim de linha da 0025 e da 0026) — 18/11/2026

Estado: **Planejado (proposta escrita). Nada executado.** Origem: autorização do autor de 18/11/2026, 20:22, item 2 ("proponha o lote antes de executar").

## Estado anterior (conferido)
- No git, `0025_pessoa.sql` e `0026_pessoa_login.sql` estão com LF (o `.gitattributes` manda `*.sql text eol=lf` desde a F-050).
- No banco do site, a tabela `_migracoes` guarda o hash desses dois arquivos **com CRLF**, porque foram aplicados assim em 13/11.
- Para o `migrate` aceitar, os dois arquivos estão com CRLF só na pasta (F-061), e por isso o `git status` mostra os dois como alterados.

| Arquivo | Hash gravado (CRLF) | Hash do arquivo no git (LF) |
|---|---|---|
| 0025_pessoa.sql | `10d25a4d…010758` | `0b45f729…76643c` |
| 0026_pessoa_login.sql | `84969fda…6f9136` | `6eafd4f9…cb5074` |

## Itens do lote (1)
1. **Gravar em `_migracoes` o hash com LF dos dois arquivos** e devolver os arquivos da pasta ao estado do git.
   - Passos: backup; `UPDATE _migracoes SET hash = <hash LF> WHERE nome = <arquivo> AND hash = <hash CRLF>` (2 linhas, cada uma só muda se o hash antigo for o esperado); `git checkout` dos dois arquivos; rodar o `migrate`, que deve responder "nenhuma migração pendente".
   - **Não muda tabela, dado escolar nem função.** Só a coluna `hash` de 2 linhas da tabela de controle das migrações.

## Por que esta forma
- O conteúdo SQL é o mesmo; só o fim de linha difere (conferido: o hash com CRLF bate com o arquivo do git convertido para CRLF).
- A trava do `migrate` continua igual para todos os outros arquivos.
- Alternativa descartada: fazer o `migrate` ignorar CRLF ao calcular o hash. Muda código da ferramenta de migração e afrouxa a trava; sozinha, nem resolve (o hash gravado é o com CRLF).

## Critério de "terminou"
1. `git status` sem a 0025 e a 0026.
2. `migrate` responde "nenhuma migração pendente", sem erro.
3. Todas as migrações em `_migracoes` conferem com os arquivos da pasta.

## Retorno
`UPDATE _migracoes SET hash = '<hash CRLF da tabela acima, completo no diário>' WHERE nome = …` para as duas linhas (ou restaurar o backup). Os hashes completos ficam no diário da execução.

## Feito, Falta e Sugestões
- **Feito:** esta proposta.
- **Falta:** aprovação do autor (pode ser em uma linha).
- **Sugestões:** nenhuma além do lote.
