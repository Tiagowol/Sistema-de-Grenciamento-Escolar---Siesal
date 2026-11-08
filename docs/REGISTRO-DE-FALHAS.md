# REGISTRO DE FALHAS E RETORNO — SIESAL 4.0

Toda falha corrigida entra aqui, no procedimento. Falha de segurança, dados, escopo, prazo ou não resolvida também vira 1 linha na mensagem. Registro nunca é apagado. A cópia completa, com data, causa, correção e retorno de cada falha, fica no projeto do Claude em `claude/lote-0/REGISTRO-DE-FALHAS.md`.

| ID | Data | Resumo | Situação |
| --- | --- | --- | --- |
| F-001 | 07/11/2026 | Ambiente do Claude sem Docker, banco e instalação de pacotes. Validação no PC do autor | aberta |
| F-002 | 07/11/2026 | Leitura do arquivo do padrão TI-REX excedeu o limite. Leitura por faixas | corrigida |
| F-003 | 07/11/2026 | Segredos no histórico do repositório público v3. Proprietário aceitou o risco (A-004) | risco aceito |
| F-004 | 07/11/2026 | Docker indisponível no terminal do app. Comandos rodam no WSL2 do autor | corrigida |
| F-005 | 07/11/2026 | Commit recusado por falta de identidade no git. Identidade local configurada | corrigida |
| F-006 | 07/11/2026 | Autenticação no GitHub falhou no push. Resolvido com convite de colaboradora, token e push em 07/11/2026 20:35 | corrigida |
| F-007 | 07/11/2026 | Arquivos temporários vazios do pnpm em `api/`. Apagados | corrigida |
| F-008 | 07/11/2026 | `.pnpm-store/` e `_tmp_39_1d36b93e/` na raiz, fora do `.gitignore`. Corrigido em 07/11/2026: `.gitignore` ajustado e as 2 pastas (vazias) apagadas. Retorno: `git revert` do commit | corrigida |
| F-009 | 07/11/2026 | Pasta `siesal-4` não aparece como conectada no chat do Claude. Contorno: o chat pede acesso à pasta a cada sessão (concedido em 07/11/2026 20:41 e 20:53) | aberta (contornada) |
| F-010 | 07/11/2026 | Saída de comando colada no terminal como se fosse comando. Só gerou erros, sem alteração | corrigida |
| F-011 | 07/11/2026 | Token recusado na 1ª tentativa de envio (provável erro ao colar). A 2ª tentativa funcionou | corrigida |
| F-012 | 07/11/2026 | Push recusado com erro 403 (sem permissão de escrita). Novo token com escopo `repo`; push passou em 20:49 (`cb0958f..e828775`). Causa exata não confirmada | corrigida |
| F-013 | 07/11/2026 | `pnpm ci` é comando nativo do pnpm (instalação limpa), não o script `ci` do projeto; apagou `node_modules` da cópia de trabalho e falhou no store do `/tmp`. Script renomeado para `verificar`; store em pasta própria. Nada alterado na pasta do autor | corrigida |
| F-014 | 07/11/2026 | `typescript-eslint` aceita só TypeScript abaixo de 6.1.0, incompatível com o TypeScript 7.0.2 aprovado (A-007). Lint feito com Biome 2.6.6 por decisão do proprietário. Retorno: remover `biome.json` e a dependência | corrigida |
| F-017 | 07/11/2026 | Teste de gravações simultâneas na auditoria quebrou: o `id` é atribuído antes da trava, então a ordem por `id` não era a ordem da cadeia. Corrigido com a coluna `seq` definida pelo gatilho sob trava (migração 0002 ainda não aplicada em nenhum banco). Teste passou em 3 rodadas seguidas | corrigida |
| F-018 | 07/11/2026 | Teste de integração da autenticação esperava 415 para `text/plain`, mas a API respondeu 400: o Fastify aceita texto por padrão. Nada era processado, mas formulário de outro site chegava até a validação. Corrigido removendo o parser de texto (agora 415). Retorno: apagar a linha `removeContentTypeParser` em `api/src/app.ts` | corrigida |

## F-020 — 08/11/2026 — Teste de senha falhou no ambiente do Claude
- O que falhou: `primitivas.test.ts` com "original argument must be of type function" em `senha.ts`.
- Causa: o ambiente do Claude usa Node 22, que não tem `crypto.argon2` (existe no Node 24.7 ou mais novo). O projeto usa Node 26.
- Correção: nenhuma no código. Testes rodados com Node 26: 317 passam.
- Como voltar atrás: não se aplica. Quem rodar fora do Docker precisa de Node 26.

## F-021 — 08/11/2026 — Consulta SQL do Núcleo falhou e a API mostrou o erro do banco
- O que falhou: `PATCH /tarefas/:id` devolveu 500 com a mensagem do Prisma (código 42P18, "could not determine data type of parameter").
- Causa: parâmetros nulos ou booleanos sem tipo explícito dentro de `coalesce`/`CASE` em SQL cru. Além disso, a API não tinha tratador de erro e repassava a mensagem do banco ao cliente (risco de segurança: vaza detalhe interno).
- Correção: casts explícitos (`::text`, `::boolean`, `::date`) nas consultas; novo `setErrorHandler` na API: erro 5xx devolve só "Erro interno. Tente de novo." e o detalhe vai para o log.
- Como voltar atrás: reverter o commit do Núcleo; a migração 0006 só cria tabelas novas (para desfazer no banco, restaurar o backup feito antes da migração).

## F-022 — 08/11/2026 — Processos de fundo morrem entre comandos no ambiente do Claude
- O que falhou: o PostgreSQL de teste e a API pararam entre dois comandos ("ECONNREFUSED"; lock `/tmp/.s.PGSQL.54329.lock` velho).
- Causa: o ambiente encerra processos ao fim de cada comando. Não é defeito do SIESAL.
- Correção: a fumaça ponta a ponta sobe tudo em um só comando (`/tmp/smoke.sh`) e limpa o lock antes.
- Como voltar atrás: não se aplica.
