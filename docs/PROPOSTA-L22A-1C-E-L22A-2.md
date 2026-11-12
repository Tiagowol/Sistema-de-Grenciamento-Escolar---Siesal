# PROPOSTA L22a-1c e L22a-2 — Conta do Responsável e acompanhamento por vínculo — 13/11/2026

Estado: **Planejado (propostas escritas). Nenhum código ou migração feito.** Base: `PROPOSTA-L22A-1.md`, `PROPOSTA-L22A-1B.md`, Adendo 1 (seções 2 e 3), A-070, A-073, A-074, A-078. Pedido do autor (12/11, noite): "comece nos lotes 1c e L22a-2 e paramos por hoje". Pela regra da A-071, cada lote precisa de proposta escrita e "ok proposta" antes do código; por isso hoje só as propostas.

## Estado anterior (conferido)
- A pessoa (cadastro próprio, login e escolha de espaço) está **no ar** (0026 aplicada). Só professor e pedagógico entram por ela; o Responsável ainda não.
- O Responsável hoje só clica num link do e-mail (20c-2) e **não tem conta**. O vínculo `responsavel_aluno` já existe e tem o tipo `legal` ou `indicado` (0025).
- Professor e pedagogo só participam de um espaço se já houver uma linha de `usuario` ligada à pessoa; **não existe como criar essa ligação** (é o L22a-2).

---

## L22a-1c — Conta do Responsável (legal e indicado)

**Itens (3):**
1. **Cadastro próprio do Responsável** (papel `responsavel`) pelo mesmo caminho do 1b: nome, e-mail confirmado, senha, aceite do termo. Entra por `/pessoa`.
2. **Aluno menor criado pelo Responsável legal:** com o convite do Master, o Responsável (já com conta) informa nome e data de nascimento do aluno, cria o **espaço individual** e a conta do aluno menor, e fica ligado como Responsável **legal**, sem passar pelo link do e-mail. A autorização do Responsável **nasce junto**, com o termo (versão, data, hora). O fluxo antigo (aluno cria a conta e o Responsável confirma por link) continua valendo até a verificação.
3. **Responsável entra no espaço do aluno** pela escolha de espaço (o perfil `responsavel` passa a entrar por `/pessoa`). Neste lote ele vê **só o essencial** (que o espaço existe e quem é o aluno). **Ver tudo, só leitura, é o L22a-3.**

**Aluno maior indica um Responsável (tipo "indicado")** fica no **L22a-2** (é um convite e aprovação, como os demais).

**Migração 0027 (prevista):** coluna do papel desejado aceitar `responsavel`; função `SECURITY DEFINER` que cria espaço individual + aluno menor + usuário Responsável + vínculo `legal` + aceite numa transação (mesmo padrão de `cadastro_aluno_criar`, 0022); `pessoa_espacos` passa a incluir `responsavel`. Backup antes; retorno em `docs/RETORNO-0027.md`.

**Perguntas fechadas (recomendação primeiro):**
- **Q1. Quem pode ser Responsável legal?** Recomendo: **qualquer pessoa adulta (18+) com e-mail confirmado**, informando data de nascimento e CPF opcional como no 20c-2; o dado fica como **declarado** (sem prova de vínculo), como já decidido. Alternativa: exigir CPF.
- **Q2. O Responsável legal pode criar mais de um aluno menor?** Recomendo: **sim, até 5 por Responsável**, cada um com o seu espaço individual.

**Testes:** só adulto cria menor; menor não cria conta sozinho por este caminho; o vínculo `legal` nasce com o aceite gravado; Responsável sem aluno ativo não vê nada; isolamento entre espaços; varredura de injeção de SQL nas rotas novas; resposta só depois do COMMIT; axe e 360/768/1280 px.

---

## L22a-2 — Acompanhamento por e-mail e por código, e "Quem pode ver meus dados"

**Regra do Adendo 1:** o pedido **sempre nasce do lado do aluno**; ninguém procura aluno; não há busca de alunos.

**Itens (3):**
1. **Caminho A, por e-mail:** o aluno (ou o Responsável legal, se menor) digita o e-mail da pessoa e escolhe o papel (professor ou pedagógico). A pessoa recebe um link de uso único; se já tem conta entra e aceita, se não tem faz o cadastro próprio (1b) e aceita. Aluno menor: **o vínculo só vale depois que o Responsável aprova** (N4: "o aluno convida, o Responsável aprova").
2. **Caminho B, por código da instituição:** a instituição liga "aceitar pedidos de acompanhamento" e recebe um código; o aluno digita; o pedido cai na fila do Pedagógico da instituição, que aceita ou recusa. O aluno não vê lista de profissionais.
3. **Tela "Quem pode ver meus dados"** (aluno e Responsável): lista de acompanhantes com o que cada um vê (4 caixas: tarefas e plano; nível de dificuldade; notas; mensagens), botão **encerrar a qualquer hora**, validade (até o fim do ano letivo; pode renovar), limite de **5** acompanhantes. Padrão: **nada marcado**. **Aluno maior** pode também **indicar um Responsável** (tipo `indicado`) por e-mail, com aceite da pessoa, e **retirar** quando quiser.

**Migração 0028 (prevista):** tabela `acompanhamento` (aluno, acompanhante, itens liberados, validade, situação, aprovação do Responsável), `convite_acompanhamento` (link de uso único, só o hash), código de aceitar pedidos por instituição; funções `SECURITY DEFINER` para criar, aceitar, recusar, aprovar e encerrar; participação do acompanhante **dentro do espaço do aluno** (linha de `usuario` ligada à pessoa) com papel professor ou pedagógico e escopo "vínculo". RLS e matriz atuais continuam; **nenhuma consulta cruza espaços**. Matriz v19 (`acompanhamento`, `convite_acompanhamento`; deny by default; teste gerado). Leitura **um aluno por vez**, sem lista com valores, média, ordem nem comparação. Cada leitura na auditoria, sem o valor. Backup antes; retorno em `docs/RETORNO-0028.md`.

**Perguntas fechadas (recomendação primeiro):**
- **Q3. Validade do vínculo:** recomendo **até o fim do ano letivo** (renovável pelo aluno ou Responsável). Alternativa: sem validade (não recomendo: dado de menor sem fim).
- **Q4. O Responsável pode encerrar um vínculo sem o aluno pedir?** Recomendo: **sim, no aluno menor; no aluno maior, só o aluno encerra** (o Responsável indicado só vê).
- **Q5. O acompanhante vê o aviso de que o aluno controla o acesso?** Recomendo: **sim**, em texto literal, na primeira vez e sempre que a lista de itens mudar.

**Testes:** pedido nunca nasce do adulto; menor sem aprovação do Responsável não libera nada; item não marcado não aparece; encerrar corta o acesso na hora; vencido não lê; limite de 5; código de instituição só chega ao Pedagógico dela; um aluno por vez (sem lista); auditoria sem valores; injeção de SQL; F-056; axe e 360/768/1280 px.

---

## Riscos
- **Alto (L22a-2):** dados sensíveis de menores com adultos de fora; depende de parecer jurídico (RIPD, Política e Mapa de Riscos no L25) antes de qualquer dado real. Só dados fictícios na Parte 1.
- **Ordem:** 1c antes do L22a-2, porque o Responsável precisa existir para aprovar. L22a-3 (Responsável vê tudo) vem depois. **1 lote grande por dia.**
- **Retorno:** backup antes de cada migração; SQL nos `RETORNO-0027/0028`; `git revert` do commit.

## Feito, Falta, Sugestões
- **Feito:** as duas propostas escritas.
- **Falta:** "ok proposta" para o 1c (e respostas Q1 e Q2) e depois para o L22a-2 (Q3 a Q5); só então código, teste, commit e aplicação, cada um com autorização.
- **Sugestões:** aceitar as recomendações, executar o 1c amanhã (13/11) e o L22a-2 em outro dia.
