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

## F-023 — 08/11/2026 — Push recusado pelo GitHub (e-mail privado nos commits)
- O que falhou: `git push` recusado com GH007 ("would publish a private email address").
- Causa: os 3 commits novos (`9323b93`, `b5691a2`, `6b7d22c`) foram criados pelo Claude com o e-mail pessoal do proprietário como autor. O GitHub bloqueia e-mail privado. Erro do Claude: o autor deve vir da configuração do git do proprietário.
- Correção: regravar o autor dos 3 commits locais (ainda não enviados) com a configuração do proprietário e enviar de novo. Nenhum dado foi publicado.
- Como voltar atrás: `git reflog` guarda os commits antigos; `git reset --hard <hash antigo>` restaura. Antes de regravar, o Claude não cria mais commits com autor próprio.

## F-024 — 08/11/2026 — Porta 8080 recusada pelo Docker no Windows
- O que falhou: `docker compose up -d web` terminou com "ports are not available: exposing port TCP 127.0.0.1:8080 ... status: 500". O contêiner `web` ficou em "Created". A verificação de ambiente mostrou a porta 8080 livre dentro do WSL2.
- Causa provável: no Docker Desktop, a porta é aberta no Windows. Um programa do Windows ou uma faixa reservada pelo Windows ocupa a 8080, e o WSL2 não enxerga isso.
- Correção: trocar `WEB_PORTA` no `.env` para outra porta (18080) e subir de novo. Nenhum dado foi afetado.
- Como voltar atrás: colocar `WEB_PORTA=8080` de volta no `.env` e rodar `docker compose up -d web`.

## F-025 — 08/11/2026 — Lote 12: formatação recusada pelo biome
- O que falhou: `biome check` apontou uma assinatura de função longa demais em `Atividades.tsx` (formatação, sem erro de lógica).
- Causa: o código novo (`EditarPrazo`) foi escrito sem passar o formatador antes do teste.
- Correção: `biome format --write` no arquivo; `biome check`, typecheck e testes do `web` passaram depois (16 de 16).
- Como voltar atrás: `git checkout -- web/src/paginas/Atividades.tsx` desfaz o arquivo inteiro do Lote 12.

## F-026 — 08/11/2026 — Lote 13: lint recusou código novo
- O que falhou: `biome check` apontou 11 erros nos arquivos do Lote 13 (formatação, ordem dos imports e chave de lista com índice em `TempoVisual`). Sem erro de lógica.
- Causa: o código foi escrito sem passar o formatador antes do primeiro teste.
- Correção: `biome check --write` só nos arquivos do lote; a faixa de 7 dias passou a usar uma lista fixa `[1..7]` como chave. Lint, typecheck e testes do `web` passaram depois.
- Como voltar atrás: `git checkout -- web/src` e apagar `blocos.ts`, `componentes/TempoVisual.tsx` e `tempo.test.tsx` desfaz o lote.

## F-027 — 08/11/2026 — Lote 13: edição automática com ordem errada e comando de shell inválido
- O que falhou: (1) uma troca de texto em `MeuDia.tsx` atingiu a frase errada porque a busca curta vinha antes da longa; o script parou por asserção e nada foi gravado naquele arquivo. (2) um comando com aspas mal fechadas não rodou e nenhuma edição foi aplicada.
- Causa: erro do Claude ao montar os scripts de edição.
- Correção: ordem das trocas invertida (longa primeiro); o script passou a ser gravado em arquivo antes de rodar. Conferido que nenhum arquivo ficou pela metade.
- Como voltar atrás: não se aplica; nada foi gravado errado.

## F-028 — 08/11/2026 — Lote 13: 3 testes novos falharam por seletor ambíguo
- O que falhou: `findByText` achou 2 elementos (título do compromisso e o texto escondido do botão "Remover"; o texto da atividade aparece no cartão principal e na lista).
- Causa: seletores dos testes novos amplos demais. A tela estava certa.
- Correção: `selector: '.event-title'` e `findAllByText` nos testes. 32 de 32 passam.
- Como voltar atrás: editar só `web/src/tempo.test.tsx`.

## F-029 — 08/11/2026 — Lote 14: comando de shell com aspas mal fechadas
- O que falhou: um comando com vários arquivos de uma vez não rodou (erro de sintaxe do shell). Nada foi gravado.
- Causa: erro do Claude ao montar o comando longo.
- Correção: os arquivos passaram a ser gravados um a um pela ferramenta de escrita. Conferido com `git status` que nada ficou pela metade.
- Como voltar atrás: não se aplica.

## F-030 — 08/11/2026 — Lote 14: arquivos novos fora do padrão do formatador
- O que falhou: o lint (`biome check`) acusou 10 erros de formatação em arquivos novos do lote (linhas longas e fim de linha CRLF vindo do Windows).
- Causa: código escrito sem passar o formatador antes do primeiro `pnpm verificar`.
- Correção: `biome check --write` num contêiner Node (cópia do repositório) e arquivos devolvidos à pasta; depois `sed` para tirar CRLF do teste web. Lint, tipos e 411 testes passaram.
- Como voltar atrás: apagar os arquivos novos do lote (`api/src/turmas/`, `web/src/paginas/Turmas.tsx`, `web/src/turmas.test.tsx`).

## F-031 — 08/11/2026 — Lote 14: 2 testes novos da tela falharam por seletor
- O que falhou: `findByText` achou 2 elementos (o texto do vínculo e o texto escondido do botão "Inativar"); o nome acessível do botão de turma não casou com a busca por papel.
- Causa: seletores dos testes novos amplos demais. A tela estava certa.
- Correção: texto ancorado (`^...$`) e busca do botão por `getAllByText('Inativar', { selector: 'button' })`.
- Como voltar atrás: editar só `web/src/turmas.test.tsx`.

## F-032 — 08/11/2026 — Lote 15: comando de shell com aspas mal fechadas
- O que falhou: um comando que gravava `NotasProfessor.tsx` de uma vez não rodou (erro de sintaxe do shell). Nada foi gravado.
- Causa: erro do Claude ao montar o comando longo (repetição de F-027 e F-029).
- Correção: o arquivo passou a ser gravado pela ferramenta de escrita. Conferido com `git status` que nada ficou pela metade.
- Como voltar atrás: não se aplica.

## F-033 — 08/11/2026 — Lote 15: resposta da API saía antes do commit
- O que falhou: 2 testes de integração novos falharam. Depois de um 201 ou 403, a consulta direta ao banco não achou a linha de negócio nem a de auditoria recém-gravada.
- Causa: as rotas novas enviavam a resposta (`reply.send`) dentro da transação do `withTenant`; o cliente recebia o status antes do commit. Era só uma corrida de leitura imediata, sem perda de dado.
- Correção: nas rotas de notas, o sucesso e a negação auditada passaram a definir o código e devolver o corpo; a resposta sai depois do commit. 110 de 110 testes de integração passam.
- Como voltar atrás: editar só `api/src/notas/rotas.ts`. Observação: as rotas do L14 (`api/src/turmas/rotas.ts`) usam o mesmo padrão antigo; não foram alteradas (fora do escopo).

## F-034 — 08/11/2026 — Lote 15: formatador e seletor de teste antigo
- O que falhou: (1) `biome check` acusou formatação em 9 arquivos do lote; (2) 2 testes antigos de `nucleo.test.tsx` acharam dois botões ("Notas" e "Notas oficiais") com a busca `^Notas`.
- Causa: (1) código escrito sem passar o formatador antes; (2) o menu do aluno ganhou o item "Notas oficiais", e a busca antiga era ampla.
- Correção: `biome check --write` em contêiner Node (cópia do repositório), arquivos devolvidos à pasta; busca do teste antigo passou a excluir " oficiais" e o menu esperado ganhou "Notas oficiais". Lint, tipos e 497 testes unitários passam.
- Como voltar atrás: reverter só `web/src/nucleo.test.tsx`.

## F-035 — 08/11/2026 — Lote 15: acentos quebrados em dados de teste do banco local
- O que falhou: 3 pedidos de revisão de teste ficaram com "�" no lugar de acentos (por exemplo "quest�o") na Instituição Demonstração.
- Causa: o texto foi enviado por `curl` no Git Bash do Windows (página de código não UTF-8). Não é defeito do sistema: pela tela os acentos funcionam.
- Correção: nenhuma na linha (pedido e nota são append-only de propósito). São dados fictícios de teste. Não foi apagado nada.
- Como voltar atrás: restaurar o backup `backups/siesal-20261108-142240.dump` (feito antes da migração 0008) apagaria também tudo que foi criado depois; só vale se quiser voltar ao estado anterior ao L15.
