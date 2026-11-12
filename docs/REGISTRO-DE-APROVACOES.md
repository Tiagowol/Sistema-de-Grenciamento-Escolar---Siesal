# Registro de aprovações (cópia no repositório)

O registro completo e anterior fica no Projeto "TW1-SaaS-SIESAL" (claude.ai). Este arquivo guarda, no repositório, as aprovações feitas a partir de 09/11/2026. Mudança de plano, escopo, ordem ou decisão só vale depois de registrada aqui e no Projeto.

## Nota de numeração (09/11/2026)
O roteiro trouxe A-027 e A-028 como numeração provisória. No repositório, A-027 já é a regra do motivo da revisão (L15/L16), A-029 são os comandos de manutenção e A-030 é a ordem dos lotes 16a a 16e. O próximo número livre é A-031. Por isso as duas decisões abaixo ficam como **A-031** e **A-032**. Em 10/11/2026 o texto do roteiro (docs/ROTEIRO-L17A-A-L20.md) foi corrigido para A-031 e A-032 (A-035). O autor deve conferir se o Projeto no claude.ai usa os mesmos números.

## A-031 — Roteiro L17a a L20 (09/11/2026)
Aprovado pelo proprietário (seção 1 do roteiro):
1. A numeração dos lotes termina no L20 (CLAUDE.md corrigido).
2. Depois do L20 é a Parte 2, lista sem número.
3. L19 e L20 são Parte 1 e entram na entrega de 10/12/2026. Pontos de controle: 20/11 e 01/12.
4. Aprovados para execução: L17a, L17b, L17c e L18. Não pedem novo "aprovo" para começar. Commit, push, merge, deploy e cada migração (com backup antes e retorno escrito) seguem com autorização separada.
5. L19 e L20: Planejados; cada um só começa com "aprovo o L19" / "aprovo o L20".
6. Prazo: se apertar, o trabalho para e o escopo é cortado por decisão do proprietário. Reavaliação em 20/11.
7. Toda alteração de plano, escopo, ordem ou decisão é registrada dos dois lados (docs/ e Projeto). Mudança sem registro não vale.

## A-032 — Menor de idade no L17c (09/11/2026)
- Trocar e-mail de aluno menor: exige aprovação do Responsável vinculado ou do Admin.
- Encerrar conta de aluno menor: confirmação do Responsável e, na falta dele, do Admin.
(No roteiro, era citada como "A-028"; corrigido em 10/11/2026.)

## A-033 — Commit e push dos L17a, L17b e L17c (09/11/2026)
O autor pediu, em chat, que o Code crie um ramo por lote (lote-17a-calendario, lote-17b-personalizacao, lote-17c-conta-suporte), faça commit de cada um e suba todos ao GitHub no fim. Vale só para commit e push desses ramos. **Merge, deploy e aplicação das migrações 0011, 0012 e 0013 no banco do site continuam com autorização separada** (backup antes e retorno escrito em docs/RETORNO-*.md). As migrações foram provadas só em banco temporário, nos testes de integração.

## Ajuste de escopo do L17a (09/11/2026)
O item "aluno vê os eventos da turma vinculada" não existe ainda: não há tabela de eventos da turma. Fica para o L19 (calendário escolar, origem calendario_escolar). No L17a o teste de permissão prova que o aluno vê só os próprios eventos. Motivo: evitar criar uma tabela que o L19 vai definir.

## Nota do L17c (09/11/2026)
No L17c, "menor de idade" = perfil aluno (o cadastro não tem data de nascimento). Sem e-mail real, a confirmação de adultos é uma segunda etapa na tela. Detalhes e limites em docs/PLANO-L17C-CONTA-E-SUPORTE.md. O autor deve confirmar essas duas escolhas.

## A-034 — Execução do L18 (09 e 10/11/2026)
- 09/11/2026, em chat: o autor pediu que o Code criasse e aplicasse o L18 completo à 01:00 de 10/11, com commit em ramo próprio, relatório em `docs/` e testes no navegador ("você está autorizado").
- 10/11/2026, em chat: a tarefa agendada não rodou (F-043). O autor escreveu: "o lote 18 foi executado? se não foi execute".
- Coberto: código do L18, migração 0014 no banco do site (com backup antes e retorno em `docs/RETORNO-0014.md`), refazer o site local, commit no ramo `lote-18-masters-fechamento`, testes no navegador.
- **Não coberto:** push, merge, deploy fora do computador, ligar o acesso público e criar senha dos Masters (o primeiro acesso é do autor).

## Decisões do Code no L18 que o autor precisa confirmar (10/11/2026)
1. A API age como Master por `SET LOCAL ROLE siesal_ops` (sem segunda conexão). Motivo e provas em `docs/PROPOSTA-L18-ARQUITETURA-MASTER.md`.
2. Primeiro acesso do Master por convite de uso único, gerado por comando manual no servidor (30 minutos). Sem códigos de recuperação: perdeu a senha ou o aplicativo, gera-se outro convite.
3. Suspender uma instituição impede o login e encerra as sessões das pessoas dela. A mensagem na tela de login é a genérica ("Credenciais inválidas ou conta temporariamente bloqueada").
4. A trilha do Master (`operator_auditoria`) já foi criada no L18, separada da escolar. As contagens agregadas continuam no L20.
5. Matriz de permissões: continua na versão 9 (a permissão do Master já existia).
6. Correções de defeito fora do item do lote, feitas por regra ("salvo defeito ou segurança"): F-044 (alvos de toque) e F-045 (tamanho do texto no celular).

## A-035 — Correção do roteiro, commit, push do L18 e ramo do L17a (10/11/2026)
Mensagem do autor em chat, em 10/11/2026, com 5 itens:
1. Corrigir em `docs/ROTEIRO-L17A-A-L20.md` as referências "A-027" para A-031 e "A-028" para A-032. **Feito.**
2. "AUTORIZO o commit", no ramo `lote-18-masters-fechamento`, de 4 arquivos listados: `docs/ROTEIRO-L17A-A-L20.md`, `docs/REGISTRO-DE-APROVACOES.md`, `CLAUDE.md` e `docs/PLANO-L17A-CALENDARIO.md`. Estado encontrado: `CLAUDE.md` e o plano do L17a não tinham alteração pendente (já estavam no commit `6442f77`, de 09/11/2026). O commit levou só os 2 arquivos alterados: o roteiro e este registro.
3. "AUTORIZO o push" do ramo `lote-18-masters-fechamento` para o `origin`. Nada no `main`. Sem merge e sem deploy.
4. Criar o ramo `lote-17a-calendario` a partir do ponto atual do L18. **Não executado.** Estado encontrado: o ramo `lote-17a-calendario` já existe desde 09/11/2026, no commit `6442f77`, e já está no GitHub (A-033). Recriá-lo no ponto do L18 trocaria o que ele aponta e exigiria envio forçado. O ramo do L18 já contém o L17a, o L17b, o L17c, a correção F-045 e o roteiro.
5. Começar o L17a pelo plano e avisar antes da migração 0011. **Não executado.** Estado encontrado: o L17a está Implementado desde 09/11/2026 e a migração 0011 foi aplicada naquele dia, com backup antes (`backups/siesal-20261109-223319.dump`) e retorno em `docs/RETORNO-0011.md`.
- **Não coberto:** merge, deploy fora do computador, envio forçado, ligar o acesso público e criar senha dos Masters.

## A-036 — L17d, L19 e L20 aprovados; organização do git (10/11/2026, 15:30)
Mensagem do autor em chat, em 10/11/2026:
1. "Aprovo o L17d, aprovo o L19 e aprovo o L20." Ordem: organizar o git → L17d → L19 → L20.
2. O retorno do NAPNE e do professor chega na quinta, 12/11/2026. O trabalho segue sem esperar. **Nenhum lote vira "Verificado" antes disso.**
3. Git: merge de `lote-18-masters-fechamento` em `siesal-4` só por avanço rápido (`--ff-only`) e push de `siesal-4`. Apagar o ramo local vazio `lote-18-fechamento`. Não tocar no `main` (v3, A-003). Sem deploy, sem envio forçado, sem enviar os ramos antigos L14 a L17 um a um. **Feito em 10/11/2026:** conferido antes que `siesal-4` e `origin/siesal-4` eram ancestrais do L18 e que a correção da F-036 (`api/src/notas/rotas.ts`) estava no ramo; `siesal-4` avançou de `12dd82c` para `05f3d01` e foi enviado; `lote-18-fechamento` (`802dac8`) apagado.
4. Commit e push de cada lote (L17d, L19, L20) no ramo próprio, com os arquivos listados um a um. **Merge em `siesal-4` de cada lote novo: pedir de novo.**
5. Migração só com backup antes e retorno escrito em `docs/`; avisar o autor antes de aplicar no banco do site.
6. Não usar nem alterar as contas `@teste.com`. Nunca imprimir senha. Não tocar no TI-REX nem na v3.
- Especificação do L17d em `docs/PLANO-L17D.md`. L19 inclui o item que sobrou do L17a (aluno vê os eventos da turma vinculada, origem `calendario_escolar`). L20: a trilha `operator_auditoria` já existe desde o L18.
- Nota: os documentos atualizados neste passo (este registro, `PROXIMOS-PASSOS.md` e `README.md`) vão no primeiro commit do ramo `lote-17d-rotulos-libras`, porque o commit direto em `siesal-4` não foi autorizado. Chegam ao `siesal-4` no merge do L17d.

## A-037 — VLibras completo, mesmo com envio de texto ao servidor do governo (10/11/2026)
Mensagem do autor em chat, em 10/11/2026, depois do aviso do Code de que o VLibras envia o texto da página para `vlibras.gov.br`:
1. "Registre na documentação e faça o pacote completo do VLibras, pois hoje é uma exigência de acessibilidade."
2. Aceitas as sugestões do Code: liga/desliga em Acessibilidade; aviso literal ao ligar; o script só carrega depois que a pessoa aceita o aviso.
3. Na tela de entrada (login) o VLibras já aparece por padrão. Dentro do sistema, ícone flutuante do lado direito. No primeiro clique, aviso de que ao ativar o texto clicado vai para o servidor do governo.
4. A opção de desativar fica em Personalizar e em Acessibilidade.
5. O VLibras não traduz o que está dentro dos campos de usuário e senha.
6. "Siga e conclua."
- Como o Code atende ao "aparece por padrão" sem enviar nada antes do aviso: o ícone flutuante é do SIESAL e aparece por padrão; o script do governo só é carregado depois do "Ativar" no aviso. Antes disso nenhum dado sai do SIESAL.
- Risco aceito pelo autor (registrado, não é parecer jurídico): texto clicado, IP e navegador vão para `vlibras.gov.br`, órgão público federal. Fica como ponto para o parecer jurídico (LGPD e ECA Digital).

## A-038 — Fechamento do L17d e sequência L19 → L20 (10/11/2026, noite)
Mensagem de abertura do autor em chat, em 10/11/2026 (nova sessão, depois da pausa por créditos):
1. L17d: rodar lint, tipos e testes do zero; registrar a sobreposição dos sinos (feito: F-048). "AUTORIZO o commit" no ramo `lote-17d-rotulos-libras`, arquivos listados um a um.
2. Migração 0015 no banco do site: backup antes (`bash scripts/backup.sh`) e aviso de 1 linha ao autor antes de rodar o `migrate`.
3. "AUTORIZO o push" do ramo `lote-17d-rotulos-libras` para o `origin`. Merge em `siesal-4` só depois de "aprovo o merge do L17d".
4. L19 (ramo `lote-19-admin`) e L20 (ramo `lote-20-master`): commit e push no ramo próprio autorizados por esta mensagem; merge em `siesal-4` com autorização separada por lote. Proposta curta antes do código; nenhuma migração sem aviso prévio. L19 parte do `siesal-4` depois do merge do L17d, ou do `lote-17d-rotulos-libras` se o merge ainda não foi autorizado.
5. Sem tocar no `main` (v3), sem deploy fora do computador, sem envio forçado, sem usar as contas `@teste.com`, sem imprimir senha.
- Lembrete: nenhum lote vira "Verificado" antes do retorno do NAPNE e do professor (12/11/2026). Ajuste pedido nesse retorno entra nos lotes já feitos, salvo decisão do autor.

## A-039 — Proposta do L19 aprovada (10/11/2026)
Mensagem do autor em chat, em 10/11/2026: "Aprovo o L19", em resposta à proposta em `docs/PLANO-L19.md` (calendário escolar lido junto com os eventos do aluno, sem cópia; regras de notas versionadas citadas no lançamento; identidade visual com PNG/JPEG até 200 KB e contraste de 4,5:1; matriz v11; migração 0016).
- Ramo `lote-19-admin` a partir do `lote-17d-rotulos-libras` (`592a459`), porque o merge do L17d ainda não foi autorizado.
- Commit e push no ramo próprio: autorizados (A-038). Merge e migração no banco do site: com aviso e autorização própria, como sempre.

## A-040 — L19: média só para o aluno e o responsável; cor da escola por tema (10/11/2026)
1. Conflito encontrado pelo Code: o teste do L15 (`api/src/notas/notas.integracao.test.ts`, "nenhuma resposta traz ranking, média da turma ou posição") proíbe a palavra "média" em qualquer resposta de notas, e a proposta do L19 (A-039) mostrava a média também para quem já vê as notas. Pergunta fechada ao autor; resposta: **"Só aluno e responsável"**. A média por período e a final aparecem só para o próprio aluno e para o responsável dele. Professor, Admin e Pedagógico não recebem médias; o teste do L15 continua igual para eles e, para o aluno e o responsável, passa a proibir ranking, posição e média da turma.
2. Ajuste técnico na identidade visual, avisado na entrega: uma cor só não passa no contraste de 4,5:1 no tema claro e no escuro ao mesmo tempo (no claro a cor precisa ser escura; no escuro, clara). Em vez de "cor principal e cor de destaque", a escola escolhe **a cor da escola em duas versões**: uma para o tema claro e outra para o tema escuro. No alto contraste vale o tema do aluno, sem a cor da escola.

## A-041 — Merge do L17d e do L19 em siesal-4 (10/11/2026)
Mensagem do autor em chat, em 10/11/2026: "aprovo o merge do L17d e, depois, do L19, um de cada vez."
- Feito pelo Code só por avanço rápido (`--ff-only`), primeiro `lote-17d-rotulos-libras` e depois `lote-19-admin`. Conferido antes: `siesal-4` (`05f3d01`) é ancestral do L17d, e o L17d é ancestral do L19.
- Este registro vai no ramo `lote-19-admin` (commit e push autorizados, A-038), porque commit direto em `siesal-4` não foi autorizado. Chega ao `siesal-4` pelo merge do L19.
- **Não coberto:** push do `siesal-4` para o `origin` (pedir antes), deploy fora do computador, envio forçado. O L20 parte do `siesal-4` depois deste merge.

## A-042 — Proposta do L20 aprovada (10/11/2026)
Mensagem do autor em chat, em 10/11/2026: "Aprovo o L20", em resposta à proposta em `docs/PLANO-L20.md` (4 situações da instituição com efeito no login; módulos mensagens, calendário e apoio ao aluno, que somem do menu e são negados na API; trilha do Master no painel e contagens só numéricas por função do banco; página `/status` pública servida pelo proxy; matriz v12; migração 0017).
- Ramo `lote-20-master` a partir do `siesal-4` (`6a0bf10`). Commit e push do ramo: autorizados (A-038). Merge, push do `siesal-4` e migração no banco do site: com autorização ou aviso próprios, como sempre.

## A-043 — Merge do L20 em siesal-4 (10/11/2026)
Mensagem do autor em chat, em 10/11/2026: "Aprovo o merge", em resposta à pergunta "Aprova o merge do L20 em siesal-4?".
- Feito pelo Code só por avanço rápido (`--ff-only`) de `lote-20-master` em `siesal-4`. Conferido antes: `siesal-4` (`6a0bf10`) é ancestral do L20 (`0c2de3b`).
- Este registro vai no ramo `lote-20-master` (commit e push autorizados, A-038) e chega ao `siesal-4` pelo merge.
- **Não coberto:** push do `siesal-4` para o `origin` (continua pendente de autorização), deploy fora do computador, envio forçado.

## A-044 — Push do siesal-4 para o origin (10/11/2026)
Mensagem do autor em chat, em 10/11/2026: "Autorizo o push", em resposta à pergunta "Autoriza o push do siesal-4 para o GitHub?".
- Feito pelo Code sem envio forçado: `origin/siesal-4` (`05f3d01`, conferido como ancestral) avançou para `628692e` (L17d, L19, L20, A-041, A-043 e F-051).
- Commit deste registro direto em `siesal-4`: autorizado pelo autor em chat, em 10/11/2026 ("Autorizo o commit"), só para este arquivo. O push desse commit não foi autorizado.

## A-045 — Push do commit da A-044 e atualização final (10/11/2026)
Mensagens do autor em chat, em 10/11/2026:
1. "Autorizo o push" (do commit `46694e2`, A-044). Feito sem envio forçado: `origin/siesal-4` de `628692e` para `46694e2`.
2. "atualize todos os commits, push e branch necessários". Entendido pelo Code como: deixar computador e GitHub iguais e os documentos de estado sem divergência, sem tocar no `main`, sem envio forçado e sem enviar os ramos antigos L14 a L17 (A-036 e F-036).
- Conferido: todos os ramos de lote que já estavam no GitHub (L17a a L20) estão iguais ao computador; L17d, L19 e L20 estão contidos no `siesal-4`. Nenhum ramo novo era necessário.
- Atualizados: `README.md` (estado), `docs/PROXIMOS-PASSOS.md` (nota nova no topo; a antiga fica como histórico) e `docs/ROTEIRO-L17A-A-L20.md` (L19 e L20 Implementados). Commit e push no `siesal-4`.

## A-046 — Lotes de adequação 20a a 20d: planejamento registrado e preparos do SUAP aprovados (10/11/2026, noite)
Mensagens do autor em chat (sessão do Projeto no claude.ai, com acesso à pasta), em 10/11/2026, de 22:31 a 22:57, depois da intervenção do professor, de Tiago Wagner e do NAPNE:
1. Pedido de um "lote especial de adequação", L20a a L20d, logo depois do L20: aluno sem instituição, cadastro com data de nascimento e CPF, disciplinas em lista com busca, dificuldade de 0 a 10, cards de resumo, tempo das atividades personalizável e correção de Personalizar e Acessibilidade. "Não gere código"; autorização para analisar e gerar documentos.
2. Pedidos de 22:44: cadastro do menor com CPF e data de nascimento do aluno e do responsável e e-mail válido para validar; autorização do responsável com declaração de veracidade; calendário por horário (06:00 a 23:00); disciplinas gerais já marcadas, 10 campos no cadastro e máximo de 20.
3. **Aprovado (22:57):** "Sim, incluir e registrar" os 3 preparos para o SUAP (`origem`, `codigo_externo` e `matricula`) nos lotes 20b e 20c. "Atualize e documente tudo. Local e git."
- Isto muda a A-036 (a numeração terminava no L20): passam a existir os lotes L20a a L20d, ainda na Parte 1.
- Documentos: `docs/PLANO-L20A-A-L20D.md`, `docs/ADENDO-1-L20A-A-L20D.md` e `docs/ADENDO-2-L20A-A-L20D.md` (cópias no Projeto, em `claude/lote-20a-d/`).
- **Não coberto:** a divisão e a ordem dos lotes ainda não receberam "aprovo"; nenhum lote pode começar; nenhum código, migração, merge ou deploy. Decisões D1, D4, D5, D7 e D8 pendentes, cada uma no seu lote. A integração com o SUAP continua na Parte 2.
- Commit deste registro e dos 3 documentos direto em `siesal-4`: pedido pelo autor ("Local e git").

## A-047 — Aprovo o L20a (11/11/2026)
Mensagem do autor em chat, em 11/11/2026: "Aprovo o L20a", depois de `docs/PLANO-L20A.md` (achados C1 a C6 confirmados no navegador).
- Escopo aprovado: os 3 itens do L20a (cor e tema; conferência de Personalizar e Acessibilidade; tempo das atividades personalizável), ramo `lote-20a-personalizar` a partir de `siesal-4`, migração 0018.
- **Não coberto:** a divisão e a ordem dos lotes 20b a 20d (seguem sem "aprovo"); merge em `siesal-4`; deploy fora do computador; aplicar a 0018 no banco do site exige backup, `docs/RETORNO-0018.md` e aviso de 1 linha antes.
- Commit e push no ramo do lote: previstos pela mensagem de abertura de 10/11/2026, 23:15, só depois deste "aprovo".

## A-048 — Ajustes de execução do L20a em relação à proposta (11/11/2026)
Decididos pelo Code dentro do escopo aprovado na A-047, para o autor conferir. Se discordar, volta-se atrás.
1. **Matriz v13 (não v12):** os 5 perfis escolares passam a guardar preferências na conta (`preferencias_acessibilidade`, ação "administrar", escopo "proprio"; antes só o aluno). A proposta previa manter a v12; era impossível cumprir "preferências na conta para os 5 perfis" sem isto. Os lotes seguintes sobem uma versão: 20b v14, 20c v15, 20d v16.
2. **Um controle, um lugar:** tema claro/escuro, alto contraste e tamanho da letra ficam só em **Acessibilidade** (única tela dos 4 perfis que não são aluno). Personalizar (só aluno) fica com apelido, cor de destaque, tela inicial, tempo das atividades e tipos, e diz onde está o resto. Antes, os mesmos controles existiam nas duas telas.
3. **Migração 0018 sem conversão de tema:** o banco antigo só guardava "alto_contraste" (claro) para quem ligava escuro e contraste juntos; não dá para saber qual era a intenção. As linhas existentes ficam como estão; o tema novo `alto_contraste_escuro` vale só dali em diante.
4. **C6 parcial:** foram para variáveis do tema o fundo suave, o menu, o item ativo do menu, o painel de boas-vindas, a marca, o realce do botão, o dia de hoje e o aviso de informação. Ficam fixas, de propósito ou por falta de lote, as demais cores escritas direto no CSS (estados de erro e sucesso, avisos, calendário, tipos de atividade). Contagem e lista na entrega.
- **Não coberto:** aplicar a 0018 e a API nova no site (bloqueado pela F-052); merge em `siesal-4`.

## A-049 — 0018 e API nova aplicadas no site (11/11/2026)
Mensagem do autor em chat, em 11/11/2026: "Aplicar a 0018 e a API nova no site [...] faça". Dependências cumpridas: F-052 contornada e backup feito.
- Backup antes: `backups/siesal-20261111-111939.dump` (com `.sha256`).
- Aplicada pelo job `migrate`: `0018_personalizar_tema_e_blocos.sql`. API e site reconstruídos e no ar (200 em 18080 e no proxy); a API nova guarda tema, cor e minutos dos blocos na conta (conferido em tela com o aparelho limpo).
- A conta de teste foi devolvida ao que estava (cor do tema, blocos 10/25/45).
- Retorno: `docs/RETORNO-0018.md` (restaurar o backup acima).
- **Não coberto:** merge em `siesal-4`; push do ramo; início do L20b (precisa de "aprovo" próprio).

## A-050 — Aprovo o L20b, com D6 = só o confirmado (11/11/2026)
Mensagem do autor em chat, em 11/11/2026: "Aprovo o L20b, D6 = confirmado", depois de `docs/PLANO-L20B.md`.
- Escopo aprovado: os 3 itens do L20b (catálogo, Minhas disciplinas, busca na tarefa e na nota pessoal), ramo `lote-20b-disciplinas`, migração 0019, matriz v14.
- **D6:** a 0019 carrega só o confirmado (componentes da BNCC e nomes confirmados do Técnico em Informática do IFRN). O que está marcado "[validar]" no Anexo A fica fora, para a versão 2 do catálogo.
- Como o L20a ainda não tem merge em `siesal-4`, o ramo do L20b sai do ramo `lote-20a-personalizar` (ele depende da matriz v13 e da 0018).
- **Não coberto:** aplicar a 0019 e a API nova no site (exige backup, `docs/RETORNO-0019.md` e aviso de 1 linha); merge; push (a mensagem de 11/11/2026 só autorizou push dos lotes já prontos).

## A-051 — Ajustes de execução do L20b em relação à proposta (11/11/2026)
Decididos pelo Code dentro do escopo aprovado na A-050, para o autor conferir. Se discordar, volta-se atrás.
1. Rotas `/minhas-disciplinas` (o `/disciplinas` já é do cadastro de turmas do L14).
2. As disciplinas da escola entram por um botão, com origem "escola", e não contam no limite de 20. A proposta dizia "entram marcadas sozinhas"; preferi o botão para o aluno decidir.
3. A etapa do aluno fica em `preferencia_usuario.etapa_disciplinas` (coluna nova da 0019).
4. Corrigir o nome de uma disciplina própria atualiza as tarefas e notas ligadas a ela.
5. Catálogo v1 (D6): 14 componentes da BNCC e da LDB e 12 do Técnico em Informática do IFRN. Ficam fora o que o Anexo A marca "[validar]", Literatura, Redação, Espanhol, Projeto de Vida e Eletiva.
6. Matriz v14. O L20c passa para a v15 e o L20d para a v16.
7. Commit e push no ramo do lote: previstos pela mensagem de abertura de 10/11/2026, 23:15, depois do "aprovo" (a A-050 dizia que o push não estava coberto; a mensagem de abertura o cobre).
- **Não coberto:** aplicar a 0019 e a API no site (backup, `docs/RETORNO-0019.md`, aviso de 1 linha e o procedimento da F-052); merge.

## A-052 — 0019 e API do L20b aplicadas no site (11/11/2026)
Mensagem do autor em chat, em 11/11/2026: "Sim, aplicar" (à pergunta "Aplico a 0019 e a API nova no site (com backup)?").
- Backup antes: `backups/siesal-20261111-120905.dump`. Imagem da API construída com o contorno da F-052 (nada mudou no repositório).
- Aplicada pelo job `migrate`: `0019_disciplinas.sql`. Catálogo com 26 disciplinas; o site não tinha disciplinas em texto para converter.
- Conferido em tela com a API real: etapa "Ensino Fundamental" marcou as 8 gerais; busca "port", "poo" e "teatro"; sem rolagem horizontal em 360 px; alvos de 44 px.
- A conta de teste foi devolvida: as 8 disciplinas foram tiradas da lista (desativadas, não apagadas). Fica gravada a etapa "fundamental" na preferência dela.
- Retorno: `docs/RETORNO-0019.md` (restaurar o backup acima).
- **Não coberto:** merge em `siesal-4`; L20c (precisa de "aprovo" próprio e das decisões D1, D4, D7 e D8).

## A-053 — Aprovo o 20c-1, com D1 = espaço individual (11/11/2026)
Mensagem do autor em chat, em 11/11/2026: "Aprovo 20c-1, D1 sim", depois de `docs/PLANO-L20C.md`.
- Escopo aprovado: itens 1 e 2 do 20c-1 (espaço individual e isolamento; tela de entrada com as 2 opções e login sem código), ramo `lote-20c1-espaco-individual` (a partir de `lote-20b-disciplinas`), migração 0020, matriz v15.
- **D1:** cada aluno sem instituição tem uma instituição do tipo "individual", só dele.
- **Item 3 (cadastro por convite) fica parado** até a resposta da D4 (convite ou cadastro aberto). Não será implementado antes.
- **Não coberto:** 20c-2 (CPF, data de nascimento, responsável); aplicar a 0020 e a API no site (backup, `docs/RETORNO-0020.md`, aviso de 1 linha, F-052); merge.

## A-054 — Ajustes de execução do 20c-1 em relação à proposta (11/11/2026)
Decididos pelo Code dentro do escopo aprovado na A-053, para o autor conferir. Se discordar, volta-se atrás.
1. **Correção da A-052:** a verificação do L20b dizia que o site não tinha textos de disciplina para converter. Havia (19 tarefas e 1 nota); a conversão da 0019 não rodou por causa da RLS (F-054). O texto da A-052 não foi apagado; esta é a correção. A conversão agora é feita pela API (0020 + código).
2. **Índice de e-mails** (`espaco_individual`): é como a entrada "Sem instituição" acha o espaço sem ler dado de ninguém. Nenhum papel da aplicação lê a tabela; só a função `espaco_individual_achar` devolve o identificador. O mesmo e-mail não pode estar em dois espaços individuais.
3. **Deny by default no espaço individual:** só existem as rotas de aluno (tarefas, agenda, foco, notas pessoais, disciplinas, preferências, notificações, conta). Turmas, avisos, caixa, calendário e identidade da escola, pedido de ajuda e suporte respondem 403.
4. **Nome do espaço** é sempre "Espaço individual" (nunca o nome da pessoa), e o Master vê só a quantidade de espaços com alguém ativo.
5. **Encerrar a conta** tira o e-mail do índice e o espaço deixa de ser contado; a instituição individual não muda de situação (o papel da aplicação não escreve em `instituicao`).
6. **Criar espaço individual:** nesta etapa só por script ou teste (administrador do banco). A criação pela pessoa depende do item 3 (cadastro por convite), parado até a D4.
7. Matriz **v15**: recurso `espacos_individuais` (ler: só o Master, escopo "plataforma", só a quantidade).
- **Não coberto:** item 3 do 20c-1 (convite) e o botão "Criar conta" da tela de entrada, até a D4; aplicar a 0020 e a API no site; merge.

## A-055 — D4: cadastro individual por convite (11/11/2026)
Mensagem do autor em chat, em 11/11/2026: "Sim, por convite" (à pergunta "D4: o cadastro individual é por convite do Master?"). Libera o item 3 do 20c-1.
- Implementado: o Master gera um código de uso único (16 letras e números, 7 dias, guardado só como hash); quem tem o código cria a própria conta (nome, e-mail e senha), já entra no espaço individual. Botão "Criar conta" só no modo "Sem instituição".
- Decisões de execução: a criação do espaço, do aluno e da senha é uma função do banco (uma transação só; o convite só é gasto se tudo der certo); o dono da função só pode criar instituição do tipo individual; mensagem igual para convite inválido, vencido, usado ou e-mail repetido.
- Por enquanto o convite não pergunta idade. Menor de 18 anos, CPF e autorização do responsável são do 20c-2 (e precisam de decisões D2b, D7 e D8). Na Parte 1 só há dados fictícios.
- Matriz v15 ganhou `convites_individuais` (administrar: só o Master).
- **Não coberto:** aplicar a 0020 e a API no site; merge.

## A-056 — 0020 aplicada no site, acesso do Master e nota sobre o responsável na demonstração (11/11/2026)
Mensagem do autor em chat, em 11/11/2026 (resposta à pergunta "Aplico a 0020 e a API nova no site (com backup)?", pedindo também o acesso ao painel do Master para enviar convites e sugestão de acesso externo).
1. **Aplicado:** backup antes `backups/siesal-20261111-124702.dump`; migração `0020_espaco_individual.sql` pelo job `migrate`; API e site reconstruídos (contorno da F-052). Site local, proxy e link externo respondem 200. Retorno: `docs/RETORNO-0020.md`.
2. **F-054:** o código que converte as disciplinas já usadas está no site. A conversão acontece quando cada aluno abre "Minhas disciplinas" (a conta de teste aberta no navegador não tem tarefas próprias, então nada foi convertido nela; as 19 tarefas do banco são de outras contas).
3. **Acesso do Master:** o Master não tem senha provisória: entra por convite de uso único (30 minutos) em `/operacao`, "Primeiro acesso", e a própria pessoa escolhe a senha e liga o TOTP. Foi emitido um convite para a conta de Master já existente `w1lopes` (que estava pendente), entregue só pelo arquivo `backups/convite-master-w1lopes.txt` (fora do git). O nome de usuário do Master é só letras minúsculas, números e "_"; o e-mail do autor não é usado como nome de entrada.
4. **Acesso externo:** o Funnel do Tailscale já está ligado: `https://siesal.tail378cb5.ts.net` (conferido: site, `/api/config` e `/api/operacao/eu` respondem como esperado; sem sessão o Master recebe 401). O túnel temporário da Cloudflare não foi usado. O painel do Master fica exposto ao público enquanto o Funnel estiver ligado; a proteção é convite de uso único, senha de 12 caracteres ou mais, TOTP obrigatório e o limite de tentativas.
5. **Nota para o 20c-2 (autor, mesma data):** "como é demonstração, não precisa validar o e-mail do responsável quando o aluno for menor". Fica registrado como a D8 do 20c-2: na demonstração, **sem e-mail de validação** para o responsável. Continuam pendentes D2b (CPF do maior de 18) e D7 (foto de documento, recomendado: não), e a atualização do RIPD, da Política e do Mapa de Riscos. Sem validação por e-mail, o sistema não tem como provar quem é o responsável; isso vale só enquanto os dados forem fictícios e precisa ir ao parecer jurídico antes de qualquer dado real (ECA Digital e LGPD).
- **Não coberto:** 20c-2; merge em `siesal-4`.

## A-057 — Endereço /gestao, QR code do segundo fator e links de cadastro (11/11/2026)
Pedido do autor em chat, em 11/11/2026: o endereço do Master passa a ser `/gestao` (antes `/operacao`); mostrar o QR code além da chave do segundo fator; links de cadastro com o código embutido (aluno, Master e instituição). O autor confirmou que conseguiu entrar no painel do Master.
- **Feito:** `/gestao` é o endereço da gestão; `/operacao` continua e leva para `/gestao` (links antigos não quebram). A rota da API continua `/api/operacao/...` (interna, sem efeito para quem usa). O texto na tela é "Gestão da plataforma".
- **QR code** do segundo fator nas duas telas (Master e Admin da escola), desenhado como SVG no próprio site, com a chave em texto como alternativa. Dependência nova: `qrcode-generator` 1.4.4 (versão exata, sem outras dependências).
- **Links de cadastro:** `/cadastro/aluno#CODIGO` abre "Sem instituição" > Criar conta com o código preenchido; `/cadastro/master#USUARIO.CODIGO` abre o Primeiro acesso do Master. O Master vê e copia o link ao gerar o convite do aluno.
- **Decisão de execução (discordância registrada):** o código vai **depois do "#"**, e não no caminho do endereço como o autor escreveu (`/cadastroaluno<codigo>`). Motivo: o que fica depois do "#" nunca vai ao servidor, então não aparece nos registros do nginx, no Proxy do Funnel nem no Referer; o código sai da barra de endereço assim que é lido. A decisão final é do autor; mudar para o caminho é simples, mas o código passaria a ficar nos registros.
- **Não feito:** o link `cadastro/instituicao`. Hoje o primeiro Admin da escola é criado pelo Master (com senha provisória); não existe convite de instituição. Criar esse fluxo é um lote próprio (convite de instituição, conta do Admin, segundo fator). Fica como sugestão.
- Passou de "Entrar na operação" para "Entrar na gestão" (texto) e o convite do Master impresso pelo script passa a mostrar também o link.

## A-058 — 20c-3: convite de instituição (11/11/2026)
Mensagem do autor em chat, em 11/11/2026: "quero tudo agora, faça o lote, aplique, suba, faça o commit, e o branch... agora", em resposta à proposta de criar o convite de instituição (link `cadastro/instituicao`). Entendido pelo Code como aprovação do lote (nome: 20c-3), com aplicação no site, commit e ramo próprio. **Não** inclui o 20c-2 (CPF, data de nascimento, responsável), que segue sem D2b e D7.
- Ramo: `lote-20c3-convite-instituicao` (a partir de `lote-20c1-espaco-individual`). Migração **0021**. Matriz **v16** (recurso `convites_instituicao`). O 20c-2 passa a usar a 0022 e a v17.
- **Fluxo:** o Master gera o convite em `/gestao` (código de uso único, 7 dias, só o hash no banco, link `/cadastro/instituicao#CODIGO`). Quem o recebe informa o nome da instituição, o próprio nome, e-mail e senha. O sistema cria a instituição **em implantação** (só o Admin entra) e a conta de Admin com a senha escolhida, e o Admin entra só para ativar o segundo fator (obrigatório, com QR code). O Master depois muda a situação para "Ativa" no painel.
- **Decisões de execução:** (1) cada convite só serve para o seu tipo (aluno ou instituição); (2) a criação é uma função do banco numa transação só, e o convite só é gasto se tudo der certo; (3) o dono da função só pode criar instituição do tipo escola e "em implantação"; (4) mensagem igual para convite inventado, vencido ou usado; (5) o Admin não usa o sistema antes de ligar o segundo fator.
- **Não coberto:** módulos e identidade visual da instituição nova (o Master liga pelo painel, como antes); e-mail de aviso ao Master (não há e-mail real na Parte 1); 20c-2; merge em `siesal-4`.
- **Aplicado no site em 11/11/2026 (A-058):** backup antes `backups/siesal-20261111-134839.dump`; migração `0021_convite_instituicao.sql` pelo job `migrate`; API e site reconstruídos (contorno da F-052). Conferido: site, `/gestao`, `/cadastro/instituicao` e `/cadastro/aluno` respondem 200 no endereço externo; convite inventado recebe a recusa padrão; os 2 convites de aluno já emitidos continuam como "individual". Retorno: `docs/RETORNO-0021.md`.

## A-059 — Convite do Master tw1lopes com validade de 24 horas (11/11/2026)
Pedido do autor em chat, em 11/11/2026: "poderia ativar o link de tw1lopes para 24 horas de duração". Feito por ajuste direto de `operator_account.convite_expira_em` do `tw1lopes` (agora + 24 horas, até 12/11/2026 14:50, horário de Brasília), só para este convite; a regra geral continua 30 minutos (`VALIDADE_CONVITE_MINUTOS`). O convite segue de uso único e entregue só por arquivo em `backups/` (fora do git). O código do convite não foi alterado.

## A-060 — Convite do tw1lopes reemitido (11/11/2026)
O autor colou a tela de "Primeiro acesso" do `tw1lopes` com "Dados incorretos ou conta temporariamente bloqueada". Conferido no banco (só metadados): a conta já tinha senha definida, o convite anterior já estava gasto e o segundo fator não tinha sido ligado (conta "pendente", 4 falhas seguidas); ou seja, o primeiro acesso já havia sido feito e não foi concluído, e a segunda tentativa usou um convite já gasto. Reemitido um convite novo para o `tw1lopes` (zera as falhas e substitui o anterior), com validade de 24 horas (até 12/11/2026 18:50, horário de Brasília), entregue só por arquivo em `backups/` (fora do git). Hipótese para o segundo fator não concluído: o navegador ainda mostrava a versão antiga da tela, sem o QR code; não confirmada.

## A-061 — 20c-2: cadastro com CPF e responsável (12/11/2026)
Mensagens do autor em chat, em 12/11/2026: "Aprovo o 20c-2" com D2b = 1 (CPF do maior de 18 opcional), D7 = 1 (sem foto de documento), D8 = caixa de teste de e-mail no Docker agora e envio real na Parte 2; "Mailpit" (caixa de teste); "Ok proposta" (inclui a premissa de que o link do responsável só ativa a conta do aluno e o apagamento de verdade do pedido vencido). D10 e D11 ficaram fora do escopo (só IDs de teste do L16). Esta decisão de D8 **substitui** a nota anterior ("sem e-mail de validação" na demonstração). Proposta: `docs/PROPOSTA-L20C2.md`.
- **Estado: Implementado** (não aplicado no site, sem commit). Migração **0022**, matriz **v17** (recurso `dados_cadastro`), retorno em `docs/RETORNO-0022.md`.
- **Feito:** data de nascimento obrigatória no cadastro por convite; CPF opcional, cifrado (AES-256-GCM, chave própria `CPF_CHAVE`), com índice HMAC, mascarado em tela e fora de log, resposta e auditoria; matrícula e escolas opcionais; menor de 18 anos fica "aguardando o responsável" e só entra depois do link (uso único, 7 dias, só o hash no banco); termo literal com 3 caixas e prova (versão, data e hora, sem CPF); pedido vencido apagado (pedido e dados do aluno; conta fica inativa); e-mail do link para a caixa de teste (Mailpit, `caixa-teste` no compose, `127.0.0.1:18025`).
- **Decisões de execução:** (1) o CPF do **aluno menor** também é opcional (o plano falava em conferir "os 2 CPFs"; segui a minimização; se houver CPF do aluno, ele precisa ser diferente do do responsável); (2) o e-mail de teste usa um **cliente SMTP próprio de ~80 linhas**, sem nodemailer, para não criar dependência nova nem mexer no `pnpm-lock.yaml`; (3) o e-mail do responsável precisa ser diferente do e-mail do aluno; (4) a data de nascimento passou a ser obrigatória também para maiores (a idade decide se pede responsável).
- **Verificação (automática):** 299 testes de integração (11 novos) e 1087 testes unitários e de tela (inclui axe das telas novas), tipos sem erro e lint sem erro novo. Resta 1 aviso antigo em `api/src/conta/rotas.ts:386`, que não é deste lote. Defeito meu achado pelos testes e corrigido antes de entregar: a função nova aceitava convite de instituição (ver F-055).
- **Não coberto:** conta de Responsável (a confirmação só ativa o aluno); alterar o CPF depois do cadastro (e a auditoria "CPF alterado"); recifragem se a chave mudar; prova de que o CPF é do responsável (só confere os dígitos; vai ao parecer jurídico); envio real de e-mail (Parte 2); teste contra o Mailpit de verdade (a imagem não foi baixada; o cliente foi testado contra um servidor SMTP falso); conferir em 360, 768 e 1280 px e a checagem humana (leitor de tela, teclado, NAPNE); aplicar no site; merge. **Antes de qualquer dado real:** RIPD, Política e Mapa de Riscos (`docs/MUDANCAS-PRIVACIDADE-L20C2.md`) e parecer jurídico.

## A-062 — 20c-2 aplicado no site (12/11/2026)
Pedido do autor em chat, em 12/11/2026: "Aplicar agora".
- Feito: `CPF_CHAVE` gerada no `.env` (fora do git, valor não exibido); backup antes `backups/siesal-20261112-115456.dump`; migração `0022_cadastro_cpf.sql` pelo job `migrate`; API, site e `caixa-teste` (Mailpit v1.27.0) subiram saudáveis.
- Conferido: `/api/config`, `/confirmar/responsavel` e `/cadastro/aluno` respondem 200; link inventado recebe 404 com a mensagem padrão; dados do cadastro sem sessão recebem 401; a API entregou uma mensagem de teste (fictícia) na caixa de teste, apagada em seguida. Nenhum erro nos registros da API.
- Não conferido: cadastro de menor de ponta a ponta no site (precisa de um convite do Master) e a checagem humana.
- A chave gerada pelo autor no terminal e colada no chat **não foi usada** (aparecer no chat a expõe). Ainda não há nenhum CPF no banco, então trocar a chave agora é seguro; depois do primeiro CPF cifrado, trocar exige recifragem (não existe).
- Retorno: `docs/RETORNO-0022.md`.

## A-063 — Chave do CPF trocada pela do autor (12/11/2026)
Pedido do autor em chat, em 12/11/2026: "Trocar pela minha". Conferido antes: 0 CPFs cifrados e 0 pedidos de responsável no banco, então a troca não deixou nada ilegível. `CPF_CHAVE` no `.env` passou a ser a chave que o autor gerou; a API foi recriada e carregou a chave. Aviso registrado: essa chave foi colada no chat, o que a expõe; o autor decidiu mantê-la. Se mudar de ideia, troque **antes** do primeiro CPF cadastrado (depois exige recifragem, que não existe).

## A-064 — Decisão D5 do 20d: quem vê a dificuldade (12/11/2026)
Resposta do autor em chat, em 12/11/2026: opção 2, "Aluno e Pedagógico/NAPNE. A equipe passa a ver o número sem o aluno pedir, mas isso expõe um dado sensível a mais pessoas." Registrada depois de o autor avisar que já tinha respondido e que a decisão não estava documentada.
- **Pendência de redação:** `docs/PLANO-L20A-A-L20D.md` (linha 186) descreve a opção alternativa como "Aluno e Pedagógico, **se o aluno autorizar**". A frase do autor diz "**sem o aluno pedir**". O Code não sabe qual vale para o código. Perguntar ao autor antes de implementar.
- **Efeito:** a dificuldade (0 a 10) deixa de ser só do aluno. Isso muda o RIPD, a Política e o Mapa de Riscos (dado sensível visto pela equipe) e a matriz de permissões do 20d. Continua valendo: sem diagnóstico, sem ranking e sem comparação entre alunos.
- **Estado:** decisão registrada. "Aprovo o L20d" **ainda não foi dado**; nenhum código do 20d foi feito.

## A-065 — D5 esclarecida: sem o aluno pedir (12/11/2026)
Resposta do autor em chat, em 12/11/2026, à dúvida de redação do A-064: **"Sem o aluno pedir"**. Vale para o 20d: Pedagógico/NAPNE veem a dificuldade (0 a 10) do aluno sem que o aluno precise pedir ou autorizar. A redação "se o aluno autorizar" do `docs/PLANO-L20A-A-L20D.md` (linha 186) **não vale**.
- **Para o 20d fazer:** o aluno deve saber, em texto literal na tela, que a equipe vê esse número (transparência, já que não há consentimento por registro). Isso é uma proposta do Code, não uma decisão do autor; entra na proposta do 20d para o autor aprovar ou recusar.
- **Para os documentos de privacidade:** o RIPD, a Política e o Mapa de Riscos precisam dizer que a dificuldade é vista pela equipe pedagógica, com base legal a confirmar no parecer jurídico (aluno menor de idade).
- **Estado:** decisão registrada. "Aprovo o L20d" ainda não foi dado; nenhum código do 20d foi feito.

## A-066 — 20d: finalidade da dificuldade e "faça tudo" (12/11/2026)
Mensagem do autor em chat, em 12/11/2026: "faça tudo, a função do apoio pedagógico é acompanhar o aluno, essa nota de dificuldade é um pedido do NAPNE para ele poder ajudar o aluno e saber sua dificuldade".
- **Finalidade registrada:** a nota de dificuldade (0 a 10) é pedido do NAPNE; o Apoio Pedagógico a vê, sem o aluno pedir, para acompanhar e ajudar o aluno (A-064, A-065). Entra no RIPD e na Política (`docs/MUDANCAS-PRIVACIDADE-L20D.md`).
- **Como o Code entendeu "faça tudo":** aprovação do L20d com os 3 itens do Adendo 1 (dificuldade com a regra de sugestão e a visão da equipe; cards de resumo com Revisar; grade do dia). **Não** inclui commit, merge nem deploy, que exigem autorizações separadas. Por prudência, o Code apresentou a proposta (`docs/PROPOSTA-L20D.md`) antes de codar, porque a visão da equipe muda a regra antiga do plano ("só o aluno vê") e trata dado sensível de menor.
- **Estado:** Planejado, com proposta. Nenhum código do 20d foi feito. Migração prevista **0023**, matriz **v18**.

## A-067 — 20d implementado (12/11/2026)
Mensagem do autor em chat, em 12/11/2026: "Ok proposta" (sobre `docs/PROPOSTA-L20D.md`, com as 3 premissas: Pedagógico lê com escopo "instituição" e só ele; texto de transparência; limite de 20 cards também por disciplina).
- **Estado: Implementado** (não aplicado no site, sem commit). Migração **0023**, matriz **v18** (recursos `dificuldade` e `cartoes_resumo`), retorno em `docs/RETORNO-0023.md`.
- **Dificuldade (0 a 10):** na tarefa e na disciplina do aluno; 11 posições com palavras (nas pontas e no meio, e uma palavra por faixa) e barra de blocos; aviso literal "A equipe de apoio pedagógico vê esta nota para ajudar você. Ela não é uma nota de prova." (só aparece quando a equipe de fato vê: escola com o módulo "apoio ao aluno" ligado). Regra de sugestão sem IA: nota 7 ou mais sugere começar antes e usar blocos curtos; o aluno aceita ou recusa (aceitar deixa o plano com blocos curtos e mais blocos).
- **Visão da equipe:** tela "Acompanhamento" só para o Pedagógico, **um aluno por vez**. A API não tem lista com notas de vários alunos, média, ordem por dificuldade nem comparação (teste automático). Cada leitura fica na auditoria (`dificuldade.lida`), sem o valor. Professor, Admin, Responsável, outro aluno e Master recebem 403, e a tentativa é auditada.
- **Cards de resumo:** título, frente e verso, só texto (sem link, e-mail nem HTML, na tela, na API e no banco); 4 modelos; assistente em 3 passos com contador de letras; limite de 20 por tarefa e por disciplina (API e banco); só o dono vê; desativar em vez de apagar; auditoria sem o conteúdo. **Modo Revisar:** um card por vez, "Ver o resumo", teclado, sem animação com "Reduzir movimento", "Parar por agora" sem punição.
- **Grade do dia:** visão Dia com 06:00 a 23:00 em Manhã, Tarde e Noite (ícone e nome; a hora exata é detalhe); clicar numa hora oferece evento novo (formulário já com a hora) ou uma atividade que já existe (o evento fica ligado à atividade); duração em blocos; a lista simples continua; no mês, botão "Ver as horas do dia". Sem migração.
- **Decisão de execução:** no mês, clicar num dia continua mostrando a lista, e um botão leva à grade (o plano dizia "clicar no dia abre a visão Dia"; mantive o comportamento atual para não quebrar o hábito do aluno). Diga se prefere que o clique abra a grade direto.
- **Verificação (automática):** 317 testes de integração (18 novos do 20d) e 1161 unitários e de tela (inclui axe das telas novas), tipos sem erro, lint sem erro novo (resta 1 aviso antigo em `api/src/conta/rotas.ts:386`). Achado durante o trabalho: F-056.
- **Não coberto:** conferência em 360, 768 e 1280 px num navegador de verdade e a checagem humana (leitor de tela, teclado, contraste, NAPNE); aplicar no site (backup, 0023, reconstruir); RIPD, Política e Mapa de Riscos (`docs/MUDANCAS-PRIVACIDADE-L20D.md`) e parecer jurídico antes de dado real; merge.

## A-068 — 20d aplicado no site (12/11/2026)
Pedido do autor em chat, em 12/11/2026: "Aplicar agora".
- Feito: backup antes `backups/siesal-20261112-125157.dump`; migração `0023_dificuldade_cartoes.sql` pelo job `migrate`; API e site reconstruídos e saudáveis; a caixa de teste (Mailpit) segue no ar.
- Conferido: `/api/config`, `/` e `/confirmar/responsavel` respondem 200; `/api/cartoes-resumo`, `/api/apoio/alunos` e `/api/conta/dados-cadastro` sem sessão respondem 401; as 2 colunas `dificuldade` e a tabela `cartao_resumo` existem; nenhum erro nos registros da API.
- Não conferido: uso real das telas novas no navegador (Cards, Acompanhamento, grade do dia, seletor de dificuldade), 360/768/1280 px e a checagem humana.
- Retorno: `docs/RETORNO-0023.md`.

## A-069 — Decisões do plano L21 a L25 (12/11/2026)
Respostas do autor em chat, em 12/11/2026, ao plano `docs/PLANO-L21-A-L25.md`.
- Calendário: o aluno escolhe entre grade e lista (as duas ficam). Código de e-mail é 2º fator adicional. Master e Admin começam com e-mail, autenticador e senha; os demais só senha; o Master pode habilitar 2 fatores.
- D1 a D4 decididas (ver o plano). Ordem dos lotes escolhida pelo Code.
- Commit e push de `93ec6d0` (20c-2 e L20d) autorizados pelo autor na abertura da sessão; feitos no branch `claude/f053-l20-verification-itcpd9`, sem PR.
- Estado: Planejado. **Nenhum lote foi aprovado para execução ainda.**

## A-070 — Professor e pedagogo de aluno isolado (12/11/2026)
Autor em chat, em 12/11/2026: professor e pedagogo de vínculo isolado não são obrigados a ter vínculo com instituição, mas precisam de **cadastro próprio** quando não vêm de uma instituição. Entra no L22a (proposta define como o cadastro nasce). Estado: Planejado.

## A-071 — Plano de fechamento da Parte 1 até 20/12, regra de registro e decisões de 12/11/2026 (tarde)
Mensagens do autor ao Claude do chat (Projeto no claude.ai), em 12/11/2026, de 14:38 a 15:37. Registro feito pelo Claude do chat, a pedido do autor ("atualize tudo no git e no meu pc"). Documentos: `docs/PLANO-FECHAMENTO-PARTE-1-2026-11-12.md`, `docs/ADENDO-1` a `ADENDO-4` de 12/11 e `docs/TERMOS-DE-ACEITE-MINUTA-v0.1-2026-11-12.md`.
1. **Entrega da Parte 1 em 20/12/2026** (antes 10/12). Pontos de controle: 20/11, 01/12 e 10/12. Código novo só até 16/12. Isto muda a A-031 e a A-046: a numeração passa do L20 (L21 a L27).
2. **G0 aprovado:** levar ao GitHub o plano, os adendos, A-069, A-070 e o relatório; corrigir o `CLAUDE.md`. Não inclui merge em `siesal-4`.
3. **Regra de registro aprovada:** diário de sessão em `docs/diario/AAAA-MM-DD-HHMM.md` (Feito, Falta, Sugestões, como voltar) e **autorização permanente de commit e push só para `docs/` e `CLAUDE.md`**. Código, migração, merge e deploy continuam com autorização separada.
4. **Aprovada a execução do L21a, do L21c (sem o Norton) e do L21b.** Do L22a-1 em diante: proposta escrita antes do código; basta "ok proposta". (Leitura do Claude para "aprovo tudo, menos o norton"; ver Adendo 4.)
5. **Entram todos os lotes**, inclusive L27a a L27e (núcleo de apoio ao aluno, Adendo 2). **SIGEduc e Norton (F-052)** ficam para o último lote (L26d), se sobrar tempo.
6. **Integrações (SUAP, Google) entram na Parte 1 só como preparação desligada**, com dados fictícios. A tela informa que o SUAP não é a única integração pretendida, sem prometer data (texto no Adendo 4).
7. **Nome "Nível de dificuldade"** no lugar de "nota de dificuldade". "Nota" fica só para nota escolar.
8. **Acompanhamento do aluno isolado** por professor e por pedagógico/NAPNE, pelos dois caminhos: e-mail e código da instituição. O pedido sempre nasce do lado do aluno (Adendo 1).
9. **Árvore do Master:** o Master vê os dados cadastrais (nome, papel, situação, vínculos) de instituições e de alunos isolados, para suporte, rastreio e auditoria. Não vê nem altera notas, nível de dificuldade, tarefas ou mensagens; não altera e-mail. O autor aceita o risco; deve constar no aceite de abertura de conta. A confirmar no parecer jurídico.
10. **Responsável:** no aluno isolado menor, o Responsável cria a conta. Aluno maior pode indicar um Responsável (tipo "indicado"; o aluno pode retirar). Aceite com declaração de que os dados são verdadeiros e de responsabilidade de quem cadastrou.
11. **L22a dividido** em L22a-1 e L22a-2. Lotes juntados pelo Claude: L21c com L21b; SUAP com Google (L26b). Total: 17 lotes.
12. **`CPF_CHAVE`:** o autor informou que gerou uma chave nova e gravou no `.env`, à mão, depois da A-063, sem mostrar a ninguém. Substitui o aviso da A-063. **A conferir pelo Code:** se a API foi recriada depois da troca e quantos CPFs havia no banco.
- **Estado:** Planejado. Nenhum código, migração, merge ou deploy foi feito neste registro.
- **Pendente:** o que o Responsável indicado vê por padrão (pergunta aberta); confirmação de que 20/12 vale também para o professor; parecer jurídico dos termos.

## A-072 — L21a e L21b aplicados no site (12/11/2026)
Pedidos do autor em chat, em 12/11/2026: "autorizar aplicar no site agora" (L21a) e "migração 0024 no site (backup, migrate, reconstruir): sim" (L21b). Commits de código autorizados: `aed8301` (L21a) e `6e9a2f6` (L21b).
- Feito (L21a): API e site reconstruídos, sem migração; HSTS continua desligado de propósito.
- Feito (L21b): backup antes `backups/siesal-20261112-161511.dump`; migração `0024_calendario_forma_dia.sql` pelo job `migrate`; API e site reconstruídos e saudáveis. Conferido: coluna `forma_dia` (padrão 'grade'), 24 migrações, 2 linhas de preferência em 'grade', `/api/preferencias` sem sessão responde 401.
- Não conferido: uso real da escolha no navegador, 360/768/1280 px e a checagem humana.
- Retorno: `docs/RETORNO-0024.md`. Estado: Implementado e aplicado (não Verificado).

## A-073 — Responsável indicado vê o mesmo que o Responsável do menor (12/11/2026)
Resposta do autor em chat, em 12/11/2026, à pergunta aberta da A-071: "o responsável vê a mesma coisa, mesma coisa do aluno menor". Vale para o Responsável **indicado** (aluno maior): vê o mesmo que o Responsável legal vê do aluno menor. O aluno maior pode retirar o indicado (Adendo 4).
- Pedido do autor na mesma mensagem: "prepare e aplique a proposta". Como o Code entendeu: **escrever a proposta do L22a-1** (`docs/PROPOSTA-L22A-1.md`). **Código e migração não foram feitos**: a proposta tem 3 perguntas fechadas (N2, N4, N5) que são decisão do autor, e a regra da A-071 pede "ok proposta" antes do código.
- Estado: Planejado (proposta escrita).

## A-074 — N2 e N4 decididas; mensagens push entram no projeto (12/11/2026)
Mensagem do autor em chat, em 12/11/2026: "n4 o aluno convida, o responsável aprova"; "n2 o próprio aluno pede suporte, o responsável vê tudo que acontece, tanto do aluno menor como do maior, tudo (tarefas, agendas, notas, mensagens, disciplinas e etc), mas não altera nada"; "coloque as mensagens push no projeto"; "corrija e siga com a proposta".
- **N4:** o aluno convida o professor ou pedagogo; o Responsável aprova (aluno menor).
- **N2:** o aluno pede suporte; o Responsável vê tudo (menor e maior), somente leitura.
- **N5:** "siga com a proposta" lido como aceite da recomendação (dois espaços separados, dados não migram). Avisado na proposta; o autor pode corrigir.
- **Escopo (aviso com motivo):** "Responsável vê tudo" vira o lote **L22a-3**; **mensagens push** viram o lote **L27f**. Ver `docs/PROPOSTA-L22A-1.md`, seção 3a.
- **"Siga com a proposta"** lido como o "ok proposta" da A-071 para o L22a-1 (pessoa, participação, Responsável com conta). Estado: Planejado; código ainda não iniciado neste registro.

## A-075 — L22a-1 dividido em 1a e 1b; 1a implementado (12/11/2026)
Decisão do Code, avisada com motivo (CLAUDE.md, seção 6), sob o "siga com a proposta" do autor (A-074): **L22a-1a** = base de dados (migração 0025: pessoa, pessoa_id em usuario, tipo do Responsável); **L22a-1b** = login por pessoa, escolha de espaço, cadastro próprio, conta do Responsável. Motivo: o login atual (676 linhas) mexe em senha e TOTP; tudo junto passa do limite de risco. A tabela `participacao` da proposta foi dispensada: a participação é a linha de `usuario` ligada à pessoa.
- **Estado do 1a: Implementado**, não aplicado no site, código sem commit. 327 testes de integração passam; ensaio em cópia dos dados reais ok. Retorno: `docs/RETORNO-0025.md`.
- **Pendente:** autorização do commit do código e de aplicar no site; "ok" para o 1b.

## A-076 — Migração 0025 aplicada no site (12/11/2026)
Pedido do autor em chat, em 12/11/2026: "sim aplicar, concordo com a sugestão". Commit de código autorizado antes: `03a4db0`.
- Feito: backup antes `backups/siesal-20261112-164955.dump`; migração `0025_pessoa.sql` pelo job `migrate`; API reconstruída e saudável (o site não mudou). Conferido no banco do site: 25 migrações, 40 usuários, 40 pessoas, 0 usuários sem pessoa, 6 vínculos de responsável todos "legal"; site 200 e `/api/saude` ok.
- Não conferido: login real de cada perfil depois da migração (o login não foi alterado e os testes de integração passam); checagem humana.
- Retorno: `docs/RETORNO-0025.md`. Estado do L22a-1a: Implementado e aplicado (não Verificado). L22a-1b aguarda "ok".

## A-077 — L22a-1b: início e divisão (12/11/2026)
Resposta do autor em chat, em 12/11/2026: "Começar agora" (L22a-1b, com proposta curta antes). Proposta: `docs/PROPOSTA-L22A-1B.md`. Achado: pessoa sem vínculo não tem `usuario`, então precisa de senha e sessão próprias. Divisão avisada: **1b** (cadastro próprio, login da pessoa, escolha de espaço), **1c** (conta do Responsável), L22a-2 (convites). Estado: Planejado; implementação iniciada.

## A-078 — L22a-1b implementado (12/11/2026)
Sob o "Começar agora" do autor (A-077). **Estado: Implementado**, não aplicado no site, código sem commit.
- Feito: migração `0026_pessoa_login.sql` (credencial, sessão e confirmação de e-mail da pessoa; índice pessoa->espaço); API `/auth/pessoa/*` (cadastro, confirmar e-mail, login, eu, entrar, logout); telas `/pessoa` e `/confirmar/email`; `entrarPorPessoa` abre a sessão normal do espaço (só professor e pedagógico; Admin só pelo login antigo).
- Segurança conferida: resposta igual para e-mail novo e existente; 5 falhas bloqueiam 15 min; só e-mail confirmado entra; a aplicação não lê as tabelas da pessoa; o cookie da pessoa não vale como sessão de espaço; espaço suspenso não recebe ninguém.
- Falha minha achada pelos testes e corrigida antes de qualquer aplicação: uma política ampla do dono em `usuario` inflava a contagem do painel do Master; trocada por um índice `pessoa_espaco` (lição: política ampla do dono afeta funções que dependem da RLS).
- Verificação: 336 testes de integração (9 novos de pessoa/login); 1169 testes de unidade e de tela pela raiz, 0 falhas (6 novos de tela, com axe); tipos da API e da tela sem erro; lint sem erro novo. Ensaio da 0026 em cópia dos dados reais ok (40/40). Retorno: `docs/RETORNO-0026.md`.
- Não feito / não conferido: matriz v19 (as rotas novas ficam antes da sessão, como `/auth/login`; nada a gerar); conferência em 360, 768 e 1280 px em navegador real; envio de e-mail real (Parte 2); conta do Responsável (L22a-1c); convites (L22a-2).

## A-079 — 0026 aplicada no site; propostas do 1c e do L22a-2 (13/11/2026)
Pedido do autor em chat, em 12/11/2026 (noite): "Sim, aplicar agora. aceito as sugestões, e comece nos lotes 1c e L22a-2 e paramos por hoje". Commit de código autorizado antes: `16c844f` (L22a-1b).
- Feito (0026): backup antes `backups/siesal-20261112-171344.dump`; migração `0026_pessoa_login.sql` pelo job `migrate`; API e site reconstruídos e saudáveis. Conferido no banco do site: 26 migrações, 40 usuários, 40 em `pessoa_espaco`. Teste de ponta a ponta no site, com a caixa de teste: cadastro 202, login antes de confirmar 401, confirmar 200, login 200, `/auth/pessoa/eu` com lista de espaços vazia. **Ficou no banco do site 1 pessoa fictícia de teste: `teste-pessoa-l22@exemplo.invalid`** (cadastro de teste; pode ser desativada depois).
- Não conferido: 360, 768 e 1280 px em navegador real; checagem humana.
- **Propostas escritas** (`docs/PROPOSTA-L22A-1C-E-L22A-2.md`). Como o Code entendeu "comece nos lotes": **escrever as propostas**, porque a A-071 pede "ok proposta" antes do código e há 5 perguntas fechadas (Q1 a Q5) que são decisão do autor. **Nenhum código ou migração dos dois lotes foi feito.** Estado: Planejado.
