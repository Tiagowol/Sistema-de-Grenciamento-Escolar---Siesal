# Guia de teste por perfil — SIESAL 4.0 — 15/11/2026

Resultado em uma linha: este guia diz, em passos curtos, como criar uma conta de teste de cada perfil (Master, Admin, Professor, Aluno, Pedagógico/NAPNE e Responsável) e o que conferir nas telas principais, em 360, 768 e 1280 px.

Complementa o `GUIA-DE-TESTE-PARA-COLEGAS-2026-11-15.md`, que cobre os lotes L22c, L22e, L22f, L22g e os testes T1 a T4. Nenhum perfil é "Verificado" ainda; a sua checagem é o que falta.

## Antes de tudo
- **Achar um defeito não atrasa nada.** Anote o que viu e devolva para o autor. A decisão sobre o defeito é do autor.
- **Só dados fictícios.** Nomes inventados e e-mails terminados em `@teste.exemplo.invalid`. Nunca use nome, e-mail, CPF ou foto de pessoa real, nem de menor de idade.
- **Sem senhas neste guia.** Senhas provisórias aparecem uma vez na tela, na hora de criar a conta. Anote em um papel que você destrói depois. Não copie para chat, foto ou arquivo.
- O "aprovo" de cada lote é só do autor. Testar não aprova nada.
- Para testar duas pessoas ao mesmo tempo, use uma janela anônima para cada uma (os logins não se misturam).

## 1. Como abrir o site e mudar a largura
1. Abra o navegador e digite `http://localhost:18080` (no computador do autor). Para outro aparelho, só o autor liga o acesso público temporário.
2. A gestão da plataforma (Master) fica em `http://localhost:18080/gestao`.
3. A caixa de e-mails de teste (os e-mails do SIESAL caem aqui) fica em `http://127.0.0.1:18025`, só no computador do autor.
4. Para mudar a largura: tecle F12, clique no ícone de celular e tablet, e em "Dimensões" digite 360, depois 768, depois 1280.
- Terminou quando: a tela de entrada aparece e você viu a largura mudar.

## 2. O que conferir em TODA tela, nas 3 larguras
Use esta lista em cada tela dos perfis abaixo.
1. **Sem rolagem horizontal** na página (a rolagem por dentro de uma lista é aceita; a da página inteira não).
2. **Botões e links** fáceis de tocar (pelo menos 44 px de altura) e sem texto cortado.
3. **Menu lateral** sem barra de rolagem visível. Com a janela baixa, aparece uma sombra no pé quando há mais itens. Tab chega até "Ajuda" e Shift+Tab volta, com borda de foco visível.
4. **Tempo concreto:** nenhum tempo aparece só como número. Deve haver a palavra ("hoje", "amanhã", "ontem"), o dia/mês e uma forma visual (barra, blocos ou círculo). Duração em blocos (curto, médio, longo).
5. **Texto literal:** sem pressão, sem ironia, sem duplo sentido, sem metáfora. Nada em vermelho como alarme.
6. **Só leitura onde deveria ser só leitura:** nenhum botão que altera algo em telas de consulta.
7. **Privacidade:** a pessoa só vê o que o perfil dela permite (veja "Não deve aparecer" em cada perfil).

## 3. Como criar as contas de teste
Ordem recomendada: Master, depois Admin, depois os demais perfis (que o Admin cria).

### 3.1 Conta de Master
Só existem 2 vagas de Master; quem cria a vaga e o convite é o dono do servidor (o autor).
1. **Autor:** no terminal WSL, na pasta do projeto, gere o convite trocando `nome` pelo usuário do Master:
```bash
MASTER_USUARIO=nome docker compose --profile release run --rm convite-master
```
2. Abra `http://localhost:18080/gestao` e escolha "Primeiro acesso".
3. Escreva o usuário, o convite (vale 30 minutos e uma vez) e uma senha nova de 12 ou mais caracteres.
4. Na tela do segundo fator, leia o QR code com um aplicativo de autenticação (ou use o código escrito) e digite o código de 6 números.
- Terminou quando: aparece o painel "Instituições" da gestão.
- Falhou se: o convite funciona uma segunda vez; ou o painel abre sem pedir o segundo fator.

### 3.2 Conta de Admin (administração de uma escola fictícia)
1. Entre como Master. No menu, abra **Instituições** e clique em **Gerar convite de instituição**. O link/código aparece uma vez; copie.
2. Em uma janela anônima, abra o link do convite.
3. Preencha: código do convite, nome da instituição (ex.: "Escola Fictícia Teste"), seu nome (ex.: "Admin Fictício"), e-mail (`admin1@teste.exemplo.invalid`) e senha de 12 ou mais caracteres. Leia e aceite o **Termo 6** (a tela avisa que é minuta, sem parecer jurídico).
4. Na primeira entrada, configure o segundo fator (QR code e código de 6 números). Sem isso o Admin não passa da tela de configuração.
5. De volta ao Master, em **Instituições**, confira a situação da escola e deixe como **ativa** (a escola nasce "em implantação").
- Terminou quando: o Admin entra e vê o menu da administração.
- Falhou se: o Admin entra sem segundo fator; ou o aceite do Termo 6 pode ser pulado.

### 3.3 Professor, Aluno, Pedagógico/NAPNE e Responsável (criados pelo Admin)
Faça uma vez para cada perfil. Dica: crie logo os quatro, com nomes que mostram o perfil.
1. Entre como Admin e abra **Usuários**.
2. Preencha **Nome** (ex.: "Professora Fictícia"), **E-mail** (ex.: `prof1@teste.exemplo.invalid`) e **Perfil**: Professor, Aluno, Pedagógico e apoio ou Responsável.
3. Clique em **Cadastrar**. A **senha provisória** aparece uma vez: anote.
4. Em janela anônima, abra `http://localhost:18080`, escolha a instituição, entre com o e-mail e a senha provisória.
5. O site pede para **trocar a senha** antes de continuar. Troque e entre.
- Terminou quando: a pessoa entra depois de trocar a senha e vê o menu do perfil.
- Falhou se: a senha provisória continua valendo depois da troca; ou a lista mostra a senha de alguém depois.

**Vínculos (o que dá ao perfil algo para ver).** Entre como Admin e abra **Turmas e vínculos**:
1. Em "Cadastrar turma", crie uma turma (ex.: "7º A", ano letivo e turno) e, em "Cadastrar disciplina", uma disciplina (ex.: "Matemática").
2. Em "Vincular pessoas", escolha **Professor em uma turma e disciplina** e vincule o Professor à turma e à disciplina.
3. Escolha **Aluno em uma turma** e vincule o Aluno à turma.
4. Escolha **Responsável por um aluno** e vincule o Responsável ao Aluno.
5. O Pedagógico/NAPNE não precisa de vínculo de turma: ele enxerga a instituição.
- Terminou quando: "Vínculos ativos" lista os 3 vínculos.

**Outras formas de criar o Aluno e o Responsável (conta fora da escola).**
- **Aluno sem escola:** o Master abre **Convites** e gera um convite de aluno; o aluno abre o link `/cadastro/aluno#código`, escolhe "Sem instituição" e cria a conta com nome, e-mail e senha.
- **Pessoa e representante legal:** em `/pessoa`, "Criar cadastro" com e-mail de teste; confirme pelo link que cai na caixa de e-mails de teste. O representante cria o aluno menor com um convite do Master (veja T1 e T2 no guia dos colegas).

## 4. Perfil: Master (`/gestao`)
Menu: Instituições, Convites, Limite de alunos, Suporte dos espaços, Atendentes do suporte, Auditoria, a árvore (Administradores, Professores, Pedagógicos e NAPNE, Alunos, Responsáveis, Usuários sem vínculo), Suporte, Acessibilidade, Ajuda.
1. **Instituições:** a lista mostra nome, situação e números (usuários ativos por área). Mude a situação de uma escola fictícia para "suspensa" e volte para "ativa". Para encerrar, é preciso escrever o nome exato.
2. **Módulos:** ligue e desligue um módulo de uma escola fictícia. Entre como Professor ou Aluno dessa escola e confira que o item some do menu.
3. **Convites:** a lista mostra tipo e datas, **nunca o código**. Revogue um convite de teste; ele deixa de valer na hora.
4. **Limite de alunos:** aceita de 1 a 20; mude e volte para 5.
5. **Atendentes do suporte** e **Suporte dos espaços:** siga a seção 6b do guia dos colegas (indicar e retirar um Admin, ver a fila, marcar como atendido).
6. **Árvore (só leitura):** escolha uma escola e uma área; aparecem nome, e-mail, situação e "menor/maior". Não há botão que altera nada.
7. **Auditoria:** a trilha mostra as ações do Master e "A trilha está íntegra".
8. Confira a seção 2 em 360, 768 e 1280 px.
- Não deve aparecer: nota, tarefa, agenda, dificuldade, CPF, data de nascimento, senha ou código de convite.

## 5. Perfil: Admin
Menu: Início, Pedidos de acompanhamento, Notas oficiais, Avisos da escola, Usuários, Auditoria, (Suporte dos espaços, só se o Master indicou), Turmas e vínculos, Calendário da escola, Regras de notas, Identidade da escola, Suporte, Acessibilidade, Minha conta, Ajuda.
1. **Início:** aparece o cartão "Primeiros passos"; "Entendi" fecha e não volta neste aparelho.
2. **Usuários:** cadastre, gere nova senha provisória, **desative** e **reative** uma conta (confirmação em texto). Tente desativar a si mesmo: deve ser recusado. Em 360 px, a página **não** deve alargar (F-059 corrigida).
3. **Turmas e vínculos:** cadastre turma, disciplina e vínculo; desative e reative um vínculo.
4. **Calendário da escola, Regras de notas e Identidade da escola:** salve uma alteração fictícia em cada uma e confira que ela aparece depois de recarregar a página.
5. **Avisos da escola:** publique um aviso curto para a instituição e outro para uma turma; confira que o Aluno da turma o recebe.
6. **Auditoria:** lista em frases, "Cadeia íntegra: sim", sem nada de aluno (siga a seção 5 do guia dos colegas).
7. **Minha conta e Suporte:** abra um pedido de suporte fictício e veja que ele chega ao sino Mensagens do Admin e do Pedagógico.
8. Confira a seção 2 em 360, 768 e 1280 px.
- Não deve aparecer: tarefas, notas pessoais, dificuldade ou planos de aluno; usuários de outra escola.

## 6. Perfil: Professor
Menu: Início, Notas da turma, Calendário da escola, Suporte, Acessibilidade, Minha conta, Ajuda.
1. **Início:** mostra só as turmas e disciplinas em que o professor tem vínculo.
2. **Notas da turma:** lance uma nota fictícia para o aluno da turma, em uma disciplina do professor. Corrija a nota e veja o histórico de versões.
3. Responda um **pedido de revisão** de nota feito pelo Aluno (veja a seção 7).
4. Responda um **pedido de ajuda** do Aluno, se ele fizer um (aparece no sino).
5. **Calendário da escola:** só leitura.
6. Tente abrir "Usuários" ou "Auditoria" digitando o endereço: não deve abrir.
7. Confira a seção 2 em 360, 768 e 1280 px (a lista de notas não pode alargar a página).
- Não deve aparecer: alunos de turmas sem vínculo; tarefas e notas pessoais do aluno.

## 7. Perfil: Aluno
Menu: Meu dia, Atividades, Agenda, Calendário, Personalizar, Modo foco, Cards de resumo, Notas, Notas oficiais, Avisos, Quem pode ver meus dados, Suporte, Acessibilidade, Minha conta, Ajuda.
1. **Meu dia:** mostra "hoje", a data (dia/mês) e a parte do dia com nome e ícone (manhã, tarde, noite). A hora exata é só detalhe.
2. **Atividades:** crie uma atividade com prazo. A duração é escolhida em **blocos** (curto, médio, longo), sem digitar minutos. Divida em etapas e marque uma como feita.
3. **Agenda e Calendário:** crie um evento; troque entre grade e lista no Calendário e confira que a escolha fica salva.
4. **Modo foco:** inicie uma atividade. A forma **diminui**; não há contagem em números por padrão; o som começa desligado; "Parar por agora" encerra sem punição.
5. **Personalizar e Acessibilidade:** troque cor de destaque, tema (claro, escuro, alto contraste) e tamanho do texto. Confira que o texto continua legível nos 3 temas.
6. **Notas:** são notas pessoais do aluno. **Notas oficiais:** só leitura; peça uma **revisão** de nota (o Professor responde).
7. **Quem pode ver meus dados:** o Aluno liga e desliga quem acompanha; confira que desligar vale na hora.
8. **Pedir ajuda** (no sino ou na atividade): envia para o professor ou para a equipe pedagógica.
9. Confira a seção 2 em 360, 768 e 1280 px (celular é o uso mais comum do aluno: cuide da largura 360).
- Não deve aparecer: dados de outro aluno; ranking ou comparação entre alunos.

## 8. Perfil: Pedagógico e apoio (NAPNE)
Menu: Início, Acompanhamento, Pedidos de acompanhamento, Notas oficiais, Avisos da escola, Calendário da escola, Suporte, Acessibilidade, Minha conta, Ajuda.
1. **Acompanhamento:** só mostra os alunos que **aceitaram** ser acompanhados e o que eles liberaram. Peça acompanhamento de um Aluno de teste (pelo código ou pelo pedido) e aceite pelo lado do Aluno.
2. **Pedidos de acompanhamento:** veja os pedidos da instituição e o estado de cada um.
3. **Notas oficiais:** só leitura, da instituição.
4. **Avisos da escola:** publique um aviso; confira que ele chega ao Aluno.
5. **Sino Mensagens:** chegam pedidos de ajuda da equipe pedagógica e pedidos de suporte da escola; marque um pedido de suporte como atendido.
6. Confira que a tela mostra **nível de dificuldade** (0 a 10), nunca "nota de dificuldade", e que não há diagnóstico, ranking nem comparação entre alunos.
7. Confira a seção 2 em 360, 768 e 1280 px.
- Não deve aparecer: aluno que não aceitou o acompanhamento; conteúdo que o Aluno desligou.

## 9. Perfil: Responsável
Menu: Início, Meu aluno, Quem pode ver meus dados, Notas oficiais, Calendário da escola, Suporte, Acessibilidade, Minha conta, Ajuda.
1. **Meu aluno:** mostra, **só em leitura**, o que o vínculo legal permite (tarefas, agenda, notas oficiais). Nenhum botão altera algo.
2. Tente achar um botão de escrever ou apagar no espaço do aluno: não deve existir. **Se achar, é falha de segurança: anote e avise o autor na hora.**
3. **Quem pode ver meus dados:** o Responsável vê e decide sobre os próprios dados.
4. **Notas oficiais:** só as do aluno vinculado; peça uma revisão de nota.
5. **Aluno menor (representante legal, conta de pessoa):** siga T2 do guia dos colegas (criar a conta do aluno menor com convite, com a caixa de declaração).
6. Confira a seção 2 em 360, 768 e 1280 px.
- Não deve aparecer: qualquer dado de aluno sem vínculo com este Responsável.

## 10. Tabela para copiar
Escreva **OK** ou **FALHOU**. Se FALHOU, uma frase: o que viu, em qual largura e em qual navegador.

| Teste | Largura | Navegador | Resultado (OK ou FALHOU) | O que viu (se FALHOU) |
|---|---|---|---|---|
| 3.1 Criar Master | | | | |
| 3.2 Criar Admin (com Termo 6 e segundo fator) | | | | |
| 3.3 Criar Professor, Aluno, Pedagógico e Responsável | | | | |
| 3.3 Vínculos (turma, disciplina, aluno, responsável) | | | | |
| 4 Master: telas principais | 360 / 768 / 1280 | | | |
| 5 Admin: telas principais | 360 / 768 / 1280 | | | |
| 6 Professor: telas principais | 360 / 768 / 1280 | | | |
| 7 Aluno: telas principais | 360 / 768 / 1280 | | | |
| 8 Pedagógico/NAPNE: telas principais | 360 / 768 / 1280 | | | |
| 9 Responsável: telas principais | 360 / 768 / 1280 | | | |
| Seção 2 (lista de toda tela) | 360 / 768 / 1280 | | | |
| Leitor de tela (NVDA ou VoiceOver) | | | | |
| Firefox | | | | |
| Safari | | | | |

Quem testou e quando (dia/mês): ______________________

## Ao terminar
Entregue a tabela ao autor. Defeito achado entra antes de qualquer lote novo, mas **não atrasa a entrega**: é só anotar e devolver.
