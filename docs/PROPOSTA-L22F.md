# PROPOSTA L22f — Suporte do espaço individual atendido pelo Master ou por um Admin indicado — 14/11/2026

Estado: **Planejado (proposta escrita). Nenhum código nem migração feito.** Origem: decisão do autor em 14/11/2026 (A-111): o Suporte do espaço individual é atendido "pelo Master ou por um Admin que o Master indicar"; a mensagem das 20:05 de hoje pediu esta proposta. Pela A-071 e pelo CLAUDE.md (seção 3), só há código depois de "aprovo" explícito, dado separadamente.

## Estado anterior (conferido no código)
- **Como o suporte funciona hoje (L17c):** a pessoa abre "Pedir suporte" em Minha conta (assunto da lista fixa e texto de até 500 letras, sem link); o pedido vai para `pedido_suporte`, na instituição **dela**. Quem atende é o **Admin ou o Pedagógico da mesma instituição** (`podeAtenderSuporte`), que vê o pedido no sino Mensagens e marca "atendido". Não há resposta escrita pelo sistema, e a pessoa não vê o estado do próprio pedido (não existe `GET` do pedido na rota).
- **No espaço individual** (aluno sem escola, e o representante legal com o aluno menor; cada espaço é uma "instituição" do tipo `individual`, só deles) **não existe Admin nem Pedagógico**. O pedido é gravado e **ninguém o atende**. É a lacuna que este lote fecha.
- **O Master hoje não lê esses pedidos.** A tela Suporte do Master diz isso ("O Master não lê esses pedidos"), em linha com as A-074 e A-097 (Master sem dado escolar além da árvore). **A decisão do A-111 muda essa regra para os espaços individuais**; este lote precisa trocar esse texto.
- **Como o Master acessa o que é de outra instituição:** só por funções do banco de leitura (`arvore_*`, migração 0031), com o papel `siesal_ops` sem acesso direto às tabelas da escola. O Admin de uma escola só enxerga a própria instituição (RLS). **Para um Admin atender o espaço de outra pessoa é preciso uma função de banco própria; hoje não existe.**
- **Matriz de permissões** (v23): escopos `proprio`, `vinculo`, `instituicao`, `plataforma`. Não há escopo para "Admin indicado".

## Itens do lote (3)
1. **Indicar e retirar o Admin atendente (Master).** Nova tela no console do Master, "Atendentes do suporte": lista dos Admins **ativos**, de escolas **ativas**, com botão "Indicar" e, nos indicados, "Retirar"; cada ação pede confirmação em texto e grava na trilha do Master (`suporte_atendente.indicado` e `.retirado`). Nada é apagado (a indicação ganha `retirado_em`). Se o Admin for desativado ou a escola deixar de estar ativa, a indicação **para de valer sozinha** (conferido a cada leitura). Sem limite de pessoas, mas a tela mostra quantas há.
2. **Fila e atendimento dos pedidos dos espaços individuais.** Nova tela "Suporte dos espaços individuais", para o **Master** (no console) e para o **Admin indicado** (item de menu que só ele vê). Lista os pedidos **abertos**, do mais antigo para o mais novo, com: assunto em palavra, o texto, o nome e o e-mail de quem pediu (para responder fora do sistema; ver Q1), o dia/mês (e "há quantos dias") e o botão "Marcar como atendido" com confirmação. Só dá para ler e marcar; **nenhum outro dado do espaço** (tarefas, notas, dificuldade) fica visível. Cada abertura da fila e cada atendimento vai para a auditoria: na trilha do Master (se foi o Master) ou na cadeia da escola do Admin (se foi o Admin indicado), e o atendimento também fica na cadeia do espaço da pessoa (`suporte.atendido`, sem nome do atendente, só "equipe da plataforma").
3. **Aviso de que há pedido esperando.** O sino da plataforma do Master e o sino Mensagens do Admin indicado ganham um item "Há N pedidos de suporte de espaços individuais esperando", em palavra e número, sem vermelho e sem pressão. Quando não há pedido, nada aparece.

## Migração
**Sim, precisa: migração `0033`** (job `migrate`, **com backup antes**, e `docs/RETORNO-0033.md` com o passo de volta, como nas anteriores). Conteúdo previsto:
- Tabela `atendente_suporte` (usuário Admin indicado, quem indicou, `criado_em`, `retirado_em`), **fora da RLS de escola** e escrita só pelo papel do Master.
- Três funções `SECURITY DEFINER`: listar pedidos abertos de espaços **do tipo `individual`** (só esse tipo; nunca de escola), marcar atendido e contar abertos. A função confere quem chamou (Master ou Admin indicado ativo) e **só devolve as colunas listadas acima**.
- `GRANT EXECUTE` só aos papéis certos; o aplicativo continua sem `SELECT` direto nas tabelas de outro espaço.
- Matriz **v24**: recurso novo `suporte_individual` (atender) e escopo novo para "Admin indicado"; o teste gerado pela matriz cobre os 5 perfis.

## Testes e critérios de "terminou"
1. Só o Master e o Admin **indicado e ativo** leem a fila; Admin não indicado, Pedagógico, Professor, Aluno e Responsável recebem 403; sem sessão, 401.
2. A fila **nunca** traz pedido de espaço do tipo `escola` (um pedido de escola não aparece, e a escola A não vê o pedido da escola B por este caminho).
3. A resposta só tem os campos do item 2; nenhum dado do espaço da pessoa além deles.
4. Retirar a indicação, desativar o Admin ou suspender a escola cortam o acesso **na hora**.
5. Cada abertura e cada atendimento deixam registro (trilha do Master ou cadeia da escola, mais a cadeia do espaço); nada é apagado.
6. Telas em 360, 768 e 1280 px, em cartões (sem tabela larga), alvos de 44 px, texto sem pressão, tempo em palavra e dia/mês, axe sem violação, teclado com foco mantido depois de "Marcar como atendido".
7. Lint, tipos, testes de integração e de tela passando; conferência por mim. **Não torna o lote "Verificado"** (isso é a checagem humana).

## Fora do lote
- Resposta escrita pelo sistema ao pedido (hoje também não existe; ver Q1).
- A pessoa ver o estado do próprio pedido ("esperando" ou "atendido") em Minha conta.
- Atender pedidos de **escola** pelo Master (esses seguem com o Admin e o Pedagógico da escola).
- F-059 e o contraste 4,42:1.

## Riscos
- **Privacidade (o maior):** o texto do pedido pode conter dado pessoal de um **menor** e vai ser lido por quem está **fora** do espaço dele. Mitigações do lote: só campos mínimos, sem link, auditoria de toda leitura, indicação que o Master retira na hora, só Admin ativo com segundo fator, só espaços `individual`. Mesmo assim, o Termo e o aviso de privacidade do espaço individual devem dizer que a equipe da plataforma pode ler o pedido de suporte (texto a revisar no L25, com parecer jurídico; aqui só "projetado para atender").
- **Muda uma regra anterior:** "o Master não lê esses pedidos" (Suporte do Master, A-074, A-097) deixa de valer para espaços individuais; o texto da tela e o registro precisam refletir isso.
- **Migração em banco com dados:** funções `SECURITY DEFINER` mal escritas poderiam vazar dado de outro espaço; por isso o teste 2 e o teste 3 e a revisão da função.
- **Sem resposta pelo sistema:** o atendente responde por e-mail, fora do SIESAL; o lote não controla isso.
- **[Estimativa]** Um dia de trabalho (migração, 3 funções, 2 telas, testes de integração e de tela). É o maior lote desta semana.

## Pergunta (1, fechada)
**Q1 — O que o atendente vê de quem pediu o suporte?**
- **A (recomendada):** o **nome e o e-mail** da pessoa, para responder por e-mail fora do sistema. O Master já vê nome e e-mail na árvore; para o Admin indicado, é dado novo, mas necessário para atender.
- B: só o **nome** (sem e-mail); a resposta fica para um lote futuro de resposta pelo sistema. Atender passa a ser só "marcar atendido", sem como falar com a pessoa.
- C: o nome e o e-mail **só para o Master**; o Admin indicado vê só o assunto e o texto e marca atendido. Mais restritivo, mas o Admin não consegue responder.

## Ritmo do Adendo 4 (resposta à sua pergunta)
**Sim, recomendo esperar até 15/11 para o código, mesmo que você leia e aprove a proposta hoje.** Motivos: (1) hoje já foram 3 lotes de código (L22c, L22e e L22g), e o Adendo 4 recomenda 1 lote grande por dia; (2) o L22f é o **maior** da semana (migração com funções `SECURITY DEFINER`, matriz v24 e dado de menores), o tipo de lote em que pressa e cansaço aumentam o risco; (3) o L22c, o L22e e o L22g ainda não passaram pela sua checagem humana, e é melhor achar um defeito neles **antes** de empilhar outro lote. Pode aprovar hoje; o "aprovo" fica registrado e eu começo amanhã.

## Feito, Falta, Sugestões
- **Feito:** estado anterior conferido no código e no banco; migração, riscos, testes e ritmo descritos; proposta escrita.
- **Falta:** a sua leitura, a resposta à Q1 e o "aprovo" explícito (dado separadamente). Depois, código, backup, migração, testes e conferência nas 3 larguras. Merge e deploy só com autorizações separadas.
- **Sugestões:** aprovar com a A, começar o código em 15/11 depois da checagem humana dos lotes de hoje; se a checagem achar defeito grave nos lotes de hoje, ele vem antes do L22f (CLAUDE.md: defeito antes de melhoria).
