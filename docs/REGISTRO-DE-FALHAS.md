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

## F-036 — 08/11/2026 — Lote 16: motivo da revisão aparecia a quem fez o pedido (afeta segurança)
- O que falhou: a rota `GET /pedidos-revisao` (L15, commit d428548) devolvia `motivo_resposta` também quando o pedido fechava como "revisada". Assim aluno, responsável, Admin e Pedagógico, ao verem o próprio pedido, recebiam o motivo que o professor escreveu ao revisar a nota. Isso contraria o A-027: o motivo da revisão e as versões antigas são só do professor e do Admin (no histórico da nota). A rota também devolvia o número da versão atual a todos.
- Causa: o L15 tratou o motivo da revisão e o motivo de "mantida" como o mesmo campo e o entregou sempre a quem fez o pedido. Os testes do L15 só conferiam o histórico em `/notas-oficiais`, não esta rota.
- Correção (L16, ainda sem commit): em `api/src/notas/rotas.ts`, o motivo só sai em "mantida" (a quem fez o pedido e ao professor) ou, em "revisada", só para o professor; o número da versão só sai para o professor. A caixa do sino (`api/src/avisos/rotas.ts`) já nasce sem motivo de revisão e sem versões. Testes novos provam que o Pedagógico, o aluno e o responsável não recebem o motivo nem versões antigas em `/caixa`, `/pedidos-revisao` e `/notas-oficiais`.
- Como voltar atrás: reverter só os trechos de `motivo_resposta` e `versao_atual` em `api/src/notas/rotas.ts`. Não é recomendado: reabre a falha.
- Pendência: o commit d428548 (L15) ainda contém o defeito. O L15 não vai para push nem merge sozinho: só junto com a correção do L16, ou depois dela.
- Dados já gravados: nenhum dado foi exposto fora do banco local de teste (só dados fictícios).

## F-037 — 08/11/2026 — Lote 16: ajustes de lint, teste e topo do celular
- O que falhou: (1) `biome` acusou `noStaticElementInteractions` no `div` do sino (evento de foco em elemento estático); (2) o teste de contraste não achou as cores: o Vitest deixa o CSS vazio e `node:fs` não existe no tsconfig da web; (3) o primeiro desenho do topo no celular (360 px) ficou com 134 px de altura, com Menu e sinos desalinhados; (4) o botão "Menu" tinha 41 px de altura (menos de 44 px).
- Causa: (1) escrita sem passar o lint antes; (2) configuração padrão do Vitest para CSS; (3) o desenho inicial deixou o nome ao lado dos sinos; (4) valor antigo do protótipo (`min-height: 41px`).
- Correção: (1) o fechamento ao sair do foco passou para um `focusout` registrado no efeito; (2) `vitest.config.ts` passou a ler só `estilos/extra.css`, e o teste importa o arquivo com `?raw`; (3) no celular a linha 1 tem Menu, sinos e Sair, e o nome fica na linha 2 (topo de 112 px); (4) botões do topo com no mínimo 44 px.
- Como voltar atrás: reverter `web/src/estilos/extra.css`, `web/src/componentes/Sinos.tsx` e `vitest.config.ts`.

## F-038 — 08/11/2026 — Auditoria do L16: Permissions-Policy não é enviado na página inicial (CORRIGIDA no L16a, 08/11/2026)
- O que falhou: a verificação externa pela URL HTTPS mostrou que a página inicial não traz o cabeçalho `Permissions-Policy` (câmera, microfone e localização bloqueados). Os outros cabeçalhos (CSP, nosniff, frame DENY, referrer) chegam.
- Causa: em `web/nginx.conf`, o `location /` define seus próprios `add_header`; no nginx isso substitui os `add_header` do nível `server`, e a linha do `Permissions-Policy` está só no `server`.
- Correção: NÃO aplicada. Sugestão: repetir `add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;` dentro de `location /` e refazer o container web. Fora da autorização da auditoria externa (só identificar).
- Como voltar atrás: não se aplica (nada mudou). Impacto: baixo (o sistema não usa esses recursos).

- Atualização 08/11/2026 (L16a, AUD-02): os cabeçalhos de segurança passaram para `web/seguranca.conf`, incluído no `server` e em cada `location` com `add_header`. Conferido com `curl` em `localhost:18080`, `localhost:18081` (proxy) e na URL HTTPS da Cloudflare: `Permissions-Policy` presente em `/`, em `/assets/` e nas respostas da API. Como voltar atrás: reverter `web/nginx.conf`, `web/seguranca.conf` e a linha `COPY` em `web/Dockerfile`.

## F-039 — 08/11/2026 — L16c, L16a e L16b: tropeços de formatação e de teste (corrigidos)
- O que falhou: (1) `biome` acusou formatação e ordem de imports nos scripts de `scripts/auditoria/` e em `proxy/`; (2) um teste novo da prévia do plano usou a data errada (5 blocos entre 08/11 e 12/11 dão 4 dias, não 3); (3) `POST` em manutenção respondia 405 em vez da página (nginx não serve arquivo estático para POST dentro de local nomeado).
- Causa: (1) arquivos operacionais escritos sem passar pelo formatador; (2) conta de dias feita errada no teste, não no código; (3) `error_page` para local nomeado mantém o método.
- Correção: (1) `biome check --write` e arquivos devolvidos à pasta; (2) prazo do teste passou a 11/11; (3) `error_page 503 /_manutencao.html` (URL interna), que troca o método por GET; reteste com GET, POST, PUT, DELETE e HEAD: todos 503 com a página.
- Como voltar atrás: reverter `proxy/nginx.conf`, `web/src/plano.test.ts` e os scripts reformatados.

## F-040 — 08/11/2026 — CORRIGIDA no L16b, item 1 (08/11/2026): vermelho de alarme em outras telas (mesma família do selo tratado no L16b)
- O que há: a etiqueta "Atrasada" em vermelho continua em `Atividades.tsx` e `MeuDia.tsx` (e o cartão "Atrasadas" do Meu dia). O L16b tratou só "Prazo passou" (Avisos) e o contador lateral, como autorizado.
- Impacto: contradiz a regra "sem vermelho de alarme" do L16. Decisão do autor (08/11/2026): incluir em um próximo lote, tratado como item 1 do L16b (numeração corrigida pela A-030).
- Correção (L16b, item 1): "Atrasada" virou "Prazo passou", em azul calmo, em Atividades (etiqueta e filtro) e Meu dia (etiqueta, ícone e cartão). Teste novo `web/src/prazo-passou.test.tsx` (sem `.t-red`, sem a palavra "atrasad", axe). Como voltar atrás: reverter `web/src/paginas/MeuDia.tsx` e `web/src/paginas/Atividades.tsx`.

## F-041 — 08/11/2026 — L16c, L16d e L16e: tropeços de teste e de escopo (corrigidos)
- O que falhou: (1) o L16c entregue usava um horário único (`MANUTENCAO_A_PARTIR_DE`), sem a janela diária 06:00 a 23:59 nem comandos manuais pedidos na A-030; (2) testes novos com tipo `readonly`, dados de simulação incompletos (`/meu-dia`), perfil errado no teste e regex de senha ampla demais; (3) `scrollIntoView` não existe no jsdom.
- Causa: (1) escopo do L16c lido de forma incompleta; (2) e (3) erros só nos testes novos.
- Correção: (1) proxy reescrito com `MANUTENCAO_MODO` (auto, ligada, liberada) e `MANUTENCAO_JANELA` (06:00-23:59, America/Sao_Paulo), mais `scripts/manutencao.sh`; testado com horas simuladas nas bordas; (2) e (3) testes ajustados; `scrollIntoView?.()` na tela.
- Como voltar atrás: reverter `proxy/`, `compose.yaml` (serviço `proxy`), `scripts/manutencao.sh` e `.env.example` para a versão com `MANUTENCAO_A_PARTIR_DE`; reverter `web/src/menu*`, `manual.ts`, `paginas/Ajuda.tsx` e os trechos de `Shell.tsx`.


## F-042 — 09/11/2026 — L16c: link externo (Funnel) abre só na máquina do autor (FECHADA em 09/11/2026; ver o fim desta seção)
- O que falhou: `https://ntb-w1lopes.tail378cb5.ts.net` abre no Windows do autor, mas não em outras máquinas ("não é possível acessar esse site"). Em 08/11/2026 abriu no celular com dados móveis.
- Medido (09/11/2026, somente leitura, 20:11): `tailscale funnel status` = Funnel on, `/` → `http://127.0.0.1:18081`; `curl` local em 18081 = HTTP 200; `docker compose ps` = api, db e proxy saudáveis, web em execução; nó Running, sem alerta de saúde; permissões do nó incluem `funnel`, `https` e `funnel-ports` 443/8443/10000 (a política nodeAttrs permite Funnel); `nslookup` do nome em 8.8.8.8, 1.1.1.1 e 9.9.9.9 = "Non-existent domain".
- Causa provável (não confirmada): o registro DNS público do Funnel não existe ou ainda não propagou (resposta negativa pode ficar em cache). O sistema, o proxy e a permissão estão corretos, então não é defeito do SIESAL nem da política de acesso. Ainda possível: estado do nó/chave, ou bloqueio na rede de quem testa.
- Correção já feita (20:05 e 20:06, autorizada): `tailscale funnel reset` e `tailscale funnel --bg 18081`. Efeito ainda não confirmado.
- Como voltar atrás / repetir: `tailscale funnel --bg 18081` (religa) e `tailscale funnel reset` (desliga). Não instalar o Tailscale no WSL (criaria segunda máquina).
- Se acontecer de novo, nesta ordem: (1) `tailscale funnel status`; (2) `curl.exe http://127.0.0.1:18081/` e `docker compose ps`; (3) `nslookup <nome> 8.8.8.8` — se for "Non-existent domain" com os dois primeiros bons, o problema é o DNS público: religar o Funnel e esperar; (4) conferir `funnel` nas permissões do nó; (5) testar de fora (celular com dados móveis).
- Estado: aberta até `nslookup <nome> 8.8.8.8` listar endereços que não começam com `100.` e o celular com dados móveis abrir o login.
- Atualização F-042 (09/11/2026, 20:20): o link parou de funcionar depois de reiniciar o computador (boot às 19:46). Testado também no celular, na mesma rede e fora dela: não abre.
  - Descartado: SIESAL (api, db, proxy saudáveis; web no ar; 127.0.0.1:18081 = 200); config do Funnel (`AllowFunnel` ligado, `https` 443); permissão do nó (`funnel`); MagicDNS e HTTPS ligados; nó Online e conectado; Norton VPN desconectado e sem rota 100.x em conflito com o Tailscale; chave do nó sem alerta.
  - Sobrou: o Tailscale não publicou o registro DNS público do Funnel depois do boot (NXDOMAIN em 8.8.8.8, 1.1.1.1 e 9.9.9.9). `funnel reset` + `--bg 18081` não bastou. O Code não consegue reiniciar o serviço (`Restart-Service Tailscale`: acesso negado, falta PowerShell como administrador).
  - Próximo passo (autor): PowerShell como administrador, `Restart-Service Tailscale`, esperar 1 minuto, `tailscale funnel status` e `nslookup <nome> 8.8.8.8`. Se continuar: sair e entrar de novo no nó pelo ícone do Tailscale, ou abrir chamado/fórum do Tailscale com o sintoma "Funnel on, DNS público NXDOMAIN depois de reinício".
  - Para a próxima vez (depois de reiniciar o computador): rodar logo `nslookup <nome> 8.8.8.8`; se for NXDOMAIN, reiniciar o serviço Tailscale como administrador antes de mexer em qualquer outra coisa. Item de melhoria: incluir esse teste em `scripts/manutencao.sh` ou no roteiro de abertura do dia.
- Atualização F-042 (09/11/2026, 20:25): o autor reiniciou o serviço (`Restart-Service Tailscale`, como administrador). Resultado: Funnel continua ligado e o DNS público continua NXDOMAIN em 8.8.8.8. O nó vê 23 nós `funnel-ingress-node` online (a malha do Funnel está acessível), chave válida até 08/05/2027, sem alertas de saúde. Reiniciar o serviço NÃO resolveu.
  - Próximos passos, do menos para o mais invasivo (cada um com "sim" do autor): (1) painel do Tailscale, Access controls: conferir o trecho `nodeAttrs` com `funnel` e se há `tagOwners`/`autoApprovers` que excluam este nó; (2) `tailscale funnel --https=443 off`, esperar 1 minuto, `tailscale funnel --bg 18081`; (3) sair e entrar de novo no nó (pode mudar o nome do link); (4) fórum/suporte do Tailscale.
- Atualização F-042 (09/11/2026, 20:30): o painel do Tailscale (CSV de dispositivos e capturas) mostra o nó com Funnel = true e uma solicitação pendente de "Exit Node" (o menu do ícone tinha "Run exit node" marcado). O SIESAL não precisa de exit node, e ele roteia a internet de quem o usar por este computador. Rodado `tailscale set --advertise-exit-node=false` (autorizado pelo pedido "resolva"; sem efeito colateral para o Funnel). Antes do comando, `AdvertiseRoutes` já era null. DNS público: ainda NXDOMAIN em 8.8.8.8 depois disso. Retorno: `tailscale set --advertise-exit-node=true`. O nó foi criado em 08/11/2026 21:17 (horário local), ou seja, foi registrado de novo na noite anterior.
- Atualização F-042 (09/11/2026, 20:40): log de configuração do Tailscale lido. O tailnet foi criado em 08/11 às 21:14 (horário local); nó em 21:17; MagicDNS 21:18; HTTPS 21:19; política em 21:41 com `nodeAttrs` = `funnel` para `autogroup:member` (correto, é o padrão). Nenhum evento de remoção ou novo registro do nó depois disso. Os únicos eventos de hoje são `AUTO_APPROVED_ROUTES` às 20:20 e 20:31 (reinício do serviço e `--advertise-exit-node=false`), sem relação com o Funnel.
  - Prova de que não é cache: consultado direto o servidor autoritativo de `ts.net` (ns1.dnsimple.com e ns2.dnsimple-edge.net): NXDOMAIN. O registro público não existe na origem.
  - Já tentado sem efeito: `funnel reset` + `--bg 18081`; reinício do serviço; `tailscale down` + `tailscale up` (20:39); desligar exit node.
  - Restante: sair e entrar de novo no nó (`tailscale logout` + login; apagar antes o nó antigo no painel para manter o nome), ou suporte do Tailscale (sintoma: Funnel on, `funnel` no nó, NXDOMAIN no autoritativo, tailnet novo de 08/11).
- Atualização F-042 (09/11/2026, 20:42): feito `tailscale logout` e novo login pelo autor. O nó manteve nome e IP (ntb-w1lopes, 100.117.77.6), então não foi preciso apagar o nó antigo. O logout apagou a configuração do Funnel; refeito `tailscale funnel --bg 18081`. Painel: 1 máquina, etiqueta Funnel, sem a solicitação de Exit Node. Mesmo assim, NXDOMAIN no autoritativo ns1.dnsimple.com. Esgotado o que o autor pode fazer localmente; resta suporte do Tailscale. Estado: ABERTA. Depois de qualquer logout, refazer `tailscale funnel --bg 18081` (o logout apaga a configuração).
- Atualização F-042 (09/11/2026, 21:00): alternativa em uso enquanto o Funnel está sem DNS público. Acesso pela rede local: `WEB_BIND=0.0.0.0` no `.env` (fora do git), container `web` recriado, regra de firewall do Windows "SIESAL 18080 (rede privada)" (entrada, TCP 18080, perfil Privado). Confirmado pelo autor: a tela de login abriu no aparelho do filho em `http://192.168.100.110:18080`. Retorno: `WEB_BIND=127.0.0.1` no `.env`, `docker compose up -d web` e `Remove-NetFirewallRule -DisplayName "SIESAL 18080 (rede privada)"` (administrador). O Funnel segue ABERTO (NXDOMAIN).
- Atualização F-042 (09/11/2026, 20:55): RESOLVIDA no DNS. O autor renomeou o nó para `siesal` no painel (20:47) e religou MagicDNS e HTTPS (20:47 e 20:48, com DNS global 1.1.1.1). Novo nome: `siesal.tail378cb5.ts.net`. O novo nome resolve publicamente (209.177.145.97 em ns1.dnsimple.com, 8.8.8.8 e 1.1.1.1). A configuração do Funnel ainda apontava para o nome antigo; refeito `tailscale funnel reset` e `tailscale funnel --bg 18081`. HTTPS do novo nome responde 200 (a primeira chamada passou de 20 s: emissão do certificado). Causa provável: o registro do nome antigo ficou preso no Tailscale depois do reinício; trocar o nome do nó criou um registro novo. LINK NOVO: https://siesal.tail378cb5.ts.net (o antigo ntb-w1lopes não vale mais). Falta o teste de aceite em celular com dados móveis. Se acontecer de novo: renomear o nó no painel (Edit machine name) e refazer `tailscale funnel reset` + `--bg 18081`.
- Fechamento F-042 (09/11/2026): FECHADA. Teste de aceite confirmado pelo autor: o link https://siesal.tail378cb5.ts.net abriu a tela de login do SIESAL fora da rede. Chamado no suporte do Tailscale dispensado.

## F-043 — 10/11/2026 — L18: a tarefa agendada para 01:00 não executou o lote
- O que falhou: a tarefa `siesal-l18-fechamento` abriu a sessão à 01:00 de 10/11/2026, mas parou no primeiro comando, esperando permissão na tela. Nenhum arquivo foi alterado e nenhum ramo foi criado. O autor encontrou o lote sem fazer ao acordar.
- Causa: tarefa agendada só roda sozinha se as ferramentas já estiverem liberadas. Faltou o autor clicar "Run now" uma vez antes (o Code avisou, mas não confirmou que foi feito).
- Correção: o L18 foi executado na sessão normal em 10/11/2026, de 06:40 a 07:04, a pedido do autor ("o lote 18 foi executado? se não foi execute").
- Como voltar atrás: não se aplica (nada tinha sido feito). Para a próxima vez: não prometer trabalho de madrugada sem um teste da tarefa agendada com o autor presente.

## F-044 — 10/11/2026 — Alvos de toque menores que 44 px (medido no navegador em 360 px)
- O que falhou: botões pequenos (`.btn-sm`, 36 px) no Calendário e em outras telas; botões e campos de formulário com 43 px; em Personalizar, campo do apelido (28 px), barra do tamanho da letra (16 px), lista "Tela que abre primeiro" (23 px) e as chaves liga/desliga (42 x 25 px).
- Causa: valores herdados do protótipo (`prototipo.css`), anteriores à regra dos 44 px. Os testes automáticos (jsdom) não medem altura; só a medição no navegador mostra.
- Correção: bloco "F-044" no início de `web/src/estilos/extra.css` (altura mínima de 44 px para botões, campos e barra; largura mínima de 44 px para botões; área de toque maior na chave, sem mudar o desenho). Medido de novo em 360, 768 e 1280 px: Calendário (4 visões), Personalizar, Minha conta, Atividades, Agenda e `/operacao` sem alvo menor que 44 px, **com 1 exceção aberta**: os dias da grade do mês (Calendário e Agenda) têm 38 a 39 px de largura em 360 px (7 colunas não cabem com 44 px). Altura deles: 44 px ou mais.
- Como voltar atrás: apagar o bloco "F-044" de `extra.css` e refazer o site (`docker compose up -d --build web`).
- Estado: corrigida, com a exceção acima aberta (decisão do autor: aceitar, ou reduzir as margens da tela em 360 px no L19).

## F-045 — 10/11/2026 — Texto maior no Firefox e menor no Chrome do celular (relato do autor)
- O que falhou: no celular do autor, a mesma tela aparece com letra maior no Firefox e menor no Chrome.
- Causa provável (não confirmada; não foi possível reproduzir no computador): o site não declarava `text-size-adjust`. Sem essa regra, cada navegador de celular decide sozinho se aumenta o texto. O Firefox para Android aplica o tamanho de fonte do sistema a todo o texto; o Chrome não faz isso do mesmo jeito. A base do site é fixa (`font-size: calc(15px * var(--scale))`), então a diferença vem do navegador, não do SIESAL.
- Correção: `-webkit-text-size-adjust: 100%; text-size-adjust: 100%` em `html` (`web/src/estilos/prototipo.css`). O tamanho da letra continua sendo escolhido em Personalizar (90% a 150%) e o zoom do navegador continua funcionando.
- Como voltar atrás: apagar as 2 linhas e refazer o site.
- Estado: **aberta até o autor confirmar no celular**. Se continuar diferente: mandar uma captura de tela de cada navegador e dizer o tamanho de fonte configurado no Android (Configurações, Tela, Tamanho da fonte) e no Firefox (Configurações, Acessibilidade, "Tamanho automático da fonte").
- Atualização F-045 (10/11/2026, 07:25): o autor mandou 1 captura de cada navegador, tiradas depois da correção. Continua diferente. Medido nas capturas: no Firefox tudo fica cerca de 23% maior (texto, ícones, margens e botões), não só o texto. Isso é zoom da página inteira, não aumento de texto: o Firefox desenha a tela como se ela tivesse cerca de 320 px de largura; o Chrome, cerca de 393 px. Causa provável revista: o Firefox para Android segue o tamanho de fonte do sistema ("Tamanho automático da fonte") e aplica como zoom; o Chrome não segue essa configuração. `text-size-adjust` não muda isso, e o site não deve bloquear: é uma preferência de acessibilidade da pessoa. As 2 linhas ficam (são inofensivas). Não é defeito do SIESAL.
- Achado novo nas capturas (defeito pequeno, aberto): na largura de cerca de 320 px, o botão "Sair" cai para a linha de baixo no topo da tela. O resto da tela se ajusta sem rolagem horizontal.
- Estado: diferença entre navegadores explicada (configuração do aparelho, a confirmar pelo autor nas configurações do Firefox). Topo em 320 px: aberto.
- Correção do topo (10/11/2026, 07:45, aprovada pelo autor em chat: "1"): em telas de até 340 px, o topo usa margens laterais de 8 px e espaço de 6 px entre os botões (`web/src/estilos/extra.css`, bloco "F-045: tela estreita"). Medido no navegador embutido (motor do Chrome): Menu, Mensagens, Prazos e Sair na mesma linha em 280, 300, 360, 768 e 1280 px, sem rolagem horizontal e com alvos de 44 px ou mais. Não medido no Firefox real: falta o autor confirmar no celular. Como voltar atrás: apagar o bloco e refazer o site (`docker compose up -d --build web`).
- Segunda correção do topo (10/11/2026, tarde): o autor conferiu no Firefox do celular e respondeu "Não ficou" (o "Sair" continuou na segunda linha). Causa: a correção anterior dependia de a tela ter até 340 px e de a letra ter a mesma largura do Chrome; nenhuma das duas coisas é garantida no Firefox. A página não estava em cache (`Cache-Control: no-cache`). Correção: em telas de até 780 px, a linha 1 do topo passou a ser uma grade de 3 colunas (Menu, sinos, Sair) em `web/src/estilos/extra.css` (bloco "F-045"); grade não quebra linha. Se faltar espaço, os botões dos sinos encolhem até 44 px. O bloco anterior (até 340 px) foi substituído. Medido no navegador embutido (motor do Chrome) com o topo montado na tela de entrada, sem login (a leitura da senha da conta de verificação foi bloqueada pela ferramenta; a conta foi desativada de novo sem uso): uma linha, sem rolagem horizontal, sem sobreposição e alvos de 44 px ou mais em 280, 300, 320, 360, 393, 768 e 1280 px, com letra em 100%, 130% e 150%. Limite conhecido: em 260 px com letra em 150% os botões se sobrepõem. Não medido no Firefox real nem com sessão aberta: falta o autor confirmar no celular. Como voltar atrás: `git checkout 37bacb1 -- web/src/estilos/extra.css` e refazer o site (`docker compose up -d --build web`).
- Confirmação do autor (10/11/2026, em chat: "ficou ok"): no Firefox do celular, o "Sair" ficou na mesma linha do Menu. Topo: corrigido. A diferença de tamanho da letra entre Firefox e Chrome continua (vem da configuração do aparelho).

## F-046 — 10/11/2026 — Script de edição esvaziou o roteiro por alguns segundos; push saiu antes do commit dos documentos
- O que falhou: ao corrigir "A-027" e "A-028" em `docs/ROTEIRO-L17A-A-L20.md`, o script do Code abriu o arquivo para gravar antes de calcular o texto novo; uma conferência interna falhou e o arquivo ficou com 0 bytes no disco. No mesmo comando, o commit não rodou, mas o push rodou: o ramo `lote-18-masters-fechamento` foi ao GitHub primeiro só com os 3 commits antigos (o push estava autorizado, A-035).
- Causa: script gravava antes de validar; comando encadeado sem parar no primeiro erro.
- Correção: arquivo restaurado do último commit (`git checkout -- docs/ROTEIRO-L17A-A-L20.md`; ele não tinha alteração pendente), script corrigido para calcular antes de gravar, correção aplicada, commit feito e segundo push enviado. Nada foi perdido e o arquivo vazio nunca entrou em commit.
- Como voltar atrás: não se aplica.

## F-047 — 10/11/2026 — Link externo fora do ar (502) depois de refazer o site
- O que falhou: depois de `docker compose up -d --build`, o proxy (`siesal-proxy-1`) reiniciava sem parar e o link externo respondia 502. O site local (porta 18080) funcionava.
- Causa: ao trocar de ramo (`git checkout`), o git do Windows regravou `proxy/vigia.sh` com fim de linha CRLF. O `sh` do contêiner não aceita CRLF ("syntax error: unexpected word"). A imagem do proxy foi refeita com esse arquivo.
- Correção: todos os `*.sh` do repositório voltaram para LF, e um `.gitattributes` novo (`*.sh text eol=lf`) impede a repetição. Proxy refeito com `docker compose up -d --build proxy`. Link externo respondeu 200, com a mesma versão do site local.
- Como voltar atrás: apagar o `.gitattributes`. Não é recomendado: a falha volta na próxima troca de ramo.
- Também neste lote (corrigida antes da entrega): no modo texto do celular, os sinos se sobrepunham no topo; agora ficam numa linha própria (`web/src/estilos/extra.css`, bloco "L17d: modo texto no celular").

## F-048 — 10/11/2026 — L17d: sinos sobrepostos no topo, no modo texto do celular
- O que falhou: com os rótulos em modo texto (Personalizar), em telas de até 780 px, os botões dos sinos ("Mensagens" e "Prazos", com o nome escrito) não cabiam na linha 1 da grade do topo (Menu, sinos, Sair) e ficavam por cima uns dos outros.
- Causa: a grade de 3 colunas da F-045 foi feita para os sinos só com ícone. Com o nome escrito, a coluna do meio fica mais larga que o espaço livre, e a grade não quebra linha.
- Correção (feita antes do commit do L17d): no modo texto, em telas de até 780 px, os sinos vão para uma linha própria (linha 2) e o nome e o perfil para a linha 3. Linha 1: Menu, "?" e Sair. Bloco "L17d: modo texto no celular" em `web/src/estilos/extra.css`. Medido no navegador embutido (motor do Chrome) de 280 a 1280 px, nos dois modos: sem sobreposição, sem rolagem horizontal e com alvos de 44 px. Não medido no Firefox real: falta a checagem humana.
- Como voltar atrás: apagar o bloco "L17d: modo texto no celular" de `extra.css` e refazer o site (`docker compose up -d --build web`). A sobreposição volta no modo texto.

## F-049 — 10/11/2026 — L17d: lint com 73 erros de formatação na rodada final (fim de linha CRLF na cópia de trabalho)
- O que falhou: `pnpm lint` (contêiner node:26, cópia da pasta de trabalho) acusou 73 erros "format" em arquivos que o L17d não mudou.
- Causa: `core.autocrlf=true` no git do Windows. Na troca de ramo (a mesma da F-047), 113 arquivos foram regravados na pasta com CRLF; no git eles continuam LF. O Biome do contêiner lê CRLF como formatação errada. Dois documentos (`REGISTRO-DE-APROVACOES.md` e `REGISTRO-DE-FALHAS.md`) ficaram com fim de linha misturado.
- Correção: os 2 documentos misturados voltaram para LF. O lint foi rodado de novo numa cópia com fim de linha LF (igual ao conteúdo que entra no commit): 0 erros e 1 aviso antigo (`api/src/conta/rotas.ts:386`, do L17c). Tipos sem erro; 805 testes unitários e 211 de integração passando. Nenhum arquivo do commit tem CRLF (o git converte ao gravar).
- Como voltar atrás: não se aplica (nenhum código mudou).
- Sugestão (não feita, precisa de aprovação): ampliar o `.gitattributes` para `* text=auto eol=lf`, para a pasta de trabalho ficar igual ao git e o lint local não depender da cópia.

## F-050 — 10/11/2026 — L17d: migração recusada ("0007_turmas.sql foi alterada depois de aplicada")
- O que falhou: a primeira tentativa de aplicar a 0015 no banco do site (depois do backup `backups/siesal-20261110-203915.dump`) parou antes de aplicar qualquer coisa. O banco não mudou.
- Causa: a mesma da F-047 e da F-049. Com `core.autocrlf=true`, a troca de ramo deixou as migrações 0007 a 0014 com CRLF na pasta. O `migrate` calcula o hash do arquivo e compara com o hash gravado em `_migracoes` (feito com LF); CRLF muda o hash. A trava funcionou como deveria.
- Correção: as 8 migrações voltaram para LF na pasta (no git já eram LF; nenhum conteúdo mudou). Segunda tentativa: `aplicada 0015_interface.sql`. Para não repetir na troca de ramo do L19: linha `*.sql text eol=lf` no `.gitattributes`.
- Como voltar atrás: da migração, `docs/RETORNO-0015.md`. Do `.gitattributes`, apagar a linha (não recomendado: a falha volta).

## F-051 — 10/11/2026 — Ramo do L20 com ponteiro zerado depois de reinício do computador
- O que falhou: durante o commit e o push do registro A-043, o notebook do autor deu erro de memória e reiniciou (por volta de 22:15). Depois disso, o git não abria o ramo `lote-20-master`: o arquivo do ramo (`.git/refs/heads/lote-20-master`) ficou com 41 bytes zerados ("invalid sha1 pointer 0000…").
- Causa: o sistema desligou no meio da gravação do arquivo do ramo. O commit em si já estava gravado: o histórico do ramo (reflog) registrava `81379e5` (A-043), com pai `0c2de3b` (L20). O push desse commit não chegou a sair; no GitHub o ramo continuava em `0c2de3b`. O merge não tinha começado (`siesal-4` em `6a0bf10`).
- Conferido antes de consertar: cópia da pasta `.git` guardada no rascunho da sessão; os 3 commits (`81379e5`, `0c2de3b`, `6a0bf10`) íntegros; o commit `81379e5` só muda o registro de aprovações (6 linhas).
- Correção: o arquivo do ramo foi regravado com `81379e5`. `git fsck` sem nenhum erro; pasta de trabalho igual ao commit; nenhum arquivo do projeto zerado. Removida uma trava antiga e vazia (`.git/objects/maintenance.lock`, de 20:19, sem git rodando). Contêineres subiram sozinhos; banco com as migrações até a 0017; `/saude` com banco "ok"; site e `/status` respondendo 200, também pelo link externo.
- Como voltar atrás: restaurar a cópia da pasta `.git` guardada antes do conserto. Não é necessário: nada foi perdido.

## F-052 — 11/11/2026 — Reconstrução das imagens Docker falha por certificado (npm e prisma)
- O que falhou: `docker compose --profile teste run --rm --build teste` parou em `pnpm exec prisma generate`; `npm i -g pnpm` num contêiner `node:26` também falhou. Erro: `unable to verify the first certificate` (UNABLE_TO_VERIFY_LEAF_SIGNATURE).
- Causa: a rede do computador intercepta o HTTPS (certificado raiz que os contêineres não conhecem). Só afeta passos que baixam da internet; camadas já em cache não são afetadas. Não é defeito do projeto.
- Contorno usado (nada foi desligado, nenhuma verificação de certificado foi enfraquecida): testes unitários e de integração rodaram com a imagem `siesal-teste` já pronta, montando o código novo por volume; o site foi reconstruído só onde o cache bastava (imagem do `web`).
- **Não resolvida:** a imagem da API (`docker compose up -d --build api`) não pôde ser reconstruída. Por isso a 0018 e a API nova **não foram aplicadas no site** em http://localhost:18080.
- Como voltar atrás: não se aplica (nada foi alterado no site).

## F-053 — 11/11/2026 — Erro não tratado em `web/src/l19.test.tsx` (já existia)
- O que falhou: o vitest termina com "1 Unhandled Error" (`caixa.itens` indefinido em `Sinos.tsx`, linha 283) depois do teste "o menu mostra o nome da escola no lugar de SIESAL". Os 958 testes passam.
- Causa: ainda não investigada. Conferido em 11/11/2026 que acontece também no commit `c395289`, sem nenhuma mudança do L20a. Provável resposta simulada sem o campo `itens` no teste.
- **Não resolvida.** Não afeta o uso do site. Fica para um lote de manutenção.
- Como voltar atrás: não se aplica.
