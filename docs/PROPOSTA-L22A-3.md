# PROPOSTA L22a-3 — Representante vê tudo, só leitura — 13/11/2026

Estado: **Planejado (proposta escrita). Nenhum código nem migração feito.** Base: A-074 (N2), A-080, A-081, A-090, `PROPOSTA-L22A-1C-E-L22A-2.md`. Pela A-071, só há código depois de "aprovo" explícito.

## Estado anterior (conferido no código e no banco, 13/11)
- Último commit: `53ee61e` (ramo `lote-21-22-fechamento`). Migrações até a **0029** aplicadas. Sem merge em `siesal-4`.
- O **representante legal** (pessoa com `papel_desejado = responsavel`) cria o aluno menor (0027), tem uma linha `usuario` de perfil `responsavel` no espaço individual e o vínculo `responsavel_aluno` tipo `legal`. Ao entrar no espaço ele vê **só o essencial** (menu: Início, Notas oficiais, Avisos da escola, "Quem pode ver meus dados"). **Nenhuma rota lê tarefas, agenda, notas pessoais, mensagens ou disciplinas do aluno para ele.** As rotas do aluno (`/tarefas`, `/eventos`, `/notas-pessoais`, `/minhas-disciplinas`) são só do perfil aluno.
- O **representante indicado** (aluno maior indica; 0028) aceita pelo link e **não vira `usuario`** no espaço. Ele lê pela tela "Alunos que você acompanha", só nas 4 caixas (tarefas e plano; nível de dificuldade; notas; mensagens), por `acompanhando_ler`. **Agenda e disciplinas não estão em nenhuma caixa.**
- A matriz (v20) já tem `responsavel` com leitura `vinculo` em `tarefas`, `plano_regressivo` e `comentarios_aluno`, mas sem rota que use isso.
- A seção "Aluno menor de idade" aparece para **qualquer pessoa adulta com conta**, porque `/auth/pessoa/eu` devolve `representante` sempre (e a rota de criar aluno aceita qualquer pessoa adulta). Decisão do autor (A-090): só para quem se cadastrou como representante legal.

## Aluno menor de idade: ajuste à parte ou junto?
**Entra junto, como item 3 deste lote.** É pequeno (1 trecho da API, 1 da tela, testes), **não muda o banco** e é do mesmo assunto (quem é representante legal). Fazer separado gastaria um dia de lote para quase nada.

## Itens do lote (3)

1. **Tela "Meu aluno" do representante legal (aluno menor): ver tudo, só leitura.**
   Novo item de menu (só `responsavel`, só espaço individual). Um aluno por vez, um item por vez: **Tarefas e plano**, **Agenda**, **Notas**, **Mensagens** (pedidos de ajuda e respostas), **Disciplinas**, **Nível de dificuldade**. Rotas novas **só GET** (`/representado/:item`), que acham o aluno pelo vínculo `legal` ativo do próprio usuário; nenhuma recebe id de aluno. Sem lista com valores de vários alunos, sem média, sem ordem por dificuldade, sem comparação. Cada leitura vai para a auditoria **sem o valor**. Nenhuma rota de escrita para o perfil `responsavel` é criada. **Sem migração** (as tabelas já são lidas pelo banco por instituição; a leitura usa o `withTenant` do espaço).

2. **Representante indicado, e representante legal de aluno que completou 18 anos: só o que o aluno liberou.**
   Mesma tela, mas filtrada pelas **caixas** de "Quem pode ver meus dados" (as do L22a-2): caixa desmarcada = item some e a rota nega. Para caber nas 4 caixas existentes, **Agenda e Disciplinas entram na caixa "Tarefas e plano"** (o rótulo passa a "Tarefas, plano e agenda"). **Migração 0030** (`CREATE OR REPLACE` de `acompanhando_ler`, `acompanhamento_instituicao_ler` e da leitura do representante; sem tabela nova, sem coluna nova) e `itens_alterados_em = now()` nos vínculos ativos com essa caixa marcada, para o acompanhante ver o aviso de novo e o aluno ver o novo rótulo. Aos 18 anos o representante legal passa a esse regime **sozinho** (calculado pela data de nascimento, como `menor` já é calculado); a tela avisa em palavra e data, 30 dias antes.

3. **Seção "Aluno menor de idade" só para quem se cadastrou como representante legal (A-090).**
   `/auth/pessoa/eu` só devolve `representante` se a pessoa for `responsavel`; a rota de criar aluno menor nega (403, com auditoria) para os demais; a tela não mostra a seção. Atualiza o T6 do guia de testes (hoje descreve o contrário). Sem banco.

## O que muda no banco
- **Itens 1 e 3: nada.**
- **Item 2: uma migração (0030)**, só funções (substitui 3 já existentes) e um `UPDATE` em `acompanhamento` (data de alteração das caixas). **Backup antes** (`bash scripts/backup.sh`), aplicação pelo job `migrate`. **Retorno** escrito em `docs/RETORNO-0030.md` (restaurar o backup; ou recriar as 3 funções com o texto da 0028 e da 0029). Pode ser reduzida a "sem migração" se a decisão Q2 for outra (ver abaixo).
- Matriz de permissões **v21**: novo recurso `representado` (ler: `responsavel` = `vinculo`), com teste gerado; nenhum `administrar`.

## Decisão que depende do autor (uma pergunta fechada)
**Q1. Quando o aluno faz 18 anos, o representante legal continua vendo tudo?**
- **A (recomendada):** **não.** Aluno menor: o representante legal vê tudo. Aluno maior: o representante (legal ou indicado) vê **só as caixas que o aluno liberar**. Motivo: é o que você pediu agora ("respeitando as caixas"), combina com a Q4 da 0028 (aluno maior, só o aluno controla) e é o mais protetor para a LGPD.
- **B:** sim, sempre tudo, menor ou maior (como a A-074/N2 foi escrita em 12/11). Vira regra mais simples, mas o aluno maior perde o controle sobre quem vê o quê.

> Se você responder só "aprovo", **vale a A**. A resposta B muda o item 2 (o representante legal nunca cai no regime das caixas).

## Padrões que valem sem nova pergunta (vetáveis no "aprovo")
- **Tempo concreto:** prazo em palavra e data ("amanhã (14/11)"); agenda com parte do dia (manhã, tarde, noite) e ícone, hora exata só como detalhe; duração em blocos. Sem número solto.
- **Texto literal e sem pressão.** Aviso fixo na tela: "Você está só lendo. O aluno controla o que é liberado" (maior) ou "Você vê como representante legal. Não é diagnóstico." (menor).
- **Mensagens do aluno (pedidos de ajuda):** o representante legal **de aluno menor** as vê; é o texto que o aluno mandou à escola. Risco anotado abaixo.
- **Responsividade:** 360, 768 e 1280 px, alvos de 44 px, sem rolagem horizontal, mesmo padrão visual de "Alunos que você acompanha".

## Testes (previstos)
- O representante legal lê os 6 itens do **próprio** aluno e de **nenhum outro** (isolamento entre espaços e entre alunos do mesmo representante).
- Nenhuma escrita: toda rota nova só aceita GET; POST, PATCH e DELETE do perfil `responsavel` em tarefas, eventos, notas, disciplinas e ajuda continuam negados.
- Aluno maior: caixa desmarcada = item negado; encerrar o vínculo corta na hora; vencido não lê (indicado).
- Passagem aos 18 anos muda o regime sem ação manual (teste com data de nascimento no limite).
- Seção do aluno menor: pessoa professor ou pedagógico recebe 403 ao tentar criar aluno; representante legal continua criando.
- Auditoria de cada leitura sem o valor; varredura de injeção de SQL nas rotas novas; resposta só depois do COMMIT (F-056); matriz v21 gera os testes; axe sem violação; conferência em 360/768/1280 px.
- Lint, tipos e testes de integração e de tela passando antes de entregar.

## Riscos
- **Alto:** adulto lendo dados de menor. A condição de representante legal é **declarada e não verificável** (A-080). Só dados fictícios na Parte 1; parecer jurídico (RIPD, política e mapa de riscos) no L25 antes de qualquer dado real. O sistema diz "projetado para atender", nunca "em conformidade".
- **Médio:** mensagens de pedido de ajuda podem ter assunto íntimo que o aluno menor não quer que a família veja. Mitigação possível, fora deste lote: o aluno marcar um pedido como "só a escola". Se você quiser isso agora, vira pedido novo para o próximo lote.
- **Médio:** mudar o rótulo da caixa "Tarefas e plano" amplia o que acompanhantes atuais veem (agenda e disciplinas). Mitigação: aviso de novo ao acompanhante e ao aluno (item 2).
- **Baixo:** a passagem aos 18 anos depende da data de nascimento declarada.
- **Ritmo (Adendo 4):** este é **lote grande** (leitura nova em várias tabelas). **Hoje (13/11) já houve lote grande** (L22a-2 e L22a-2b); portanto o código **só pode começar em 14/11 ou depois**. A proposta pode ser aprovada hoje.

## Retorno
Backup antes da 0030; `docs/RETORNO-0030.md`; `git revert` do commit do lote.

## Feito, Falta, Sugestões
- **Feito:** proposta escrita; estado anterior conferido; decisão do "Aluno menor" encaixada como item 3.
- **Falta:** sua resposta à Q1 e o "aprovo" explícito; depois código, testes, e as autorizações separadas (aplicar no site, commit de código). Continuam por sua conta: T1 a T4 do guia e a checagem humana; a tela "Pedidos de acompanhamento" ainda não foi vista no navegador.
- **Sugestões:** aprovar com a A; começar o código em 14/11 (ou depois) e, em outro dia, conferir a tela "Pedidos de acompanhamento" com um Admin de teste.
