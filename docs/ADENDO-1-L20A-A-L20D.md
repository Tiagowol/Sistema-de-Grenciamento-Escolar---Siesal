# ADENDO 1 AO PROJETO DOS LOTES 20a A 20d — SIESAL 4.0

Data: 10/11/2026, 23:55. Estado: **Planejado. NÃO aprovado.** Nenhum código, banco ou commit.
Origem: mensagem do proprietário de 10/11/2026, 22:44. Complementa `PLANO-L20A-A-L20D.md` (no Projeto: `claude/lote-20a-d/PROJETO-LOTES-20A-A-20D.md`). Onde os dois divergirem, vale este adendo.

## 1. O que mudou

| Nº | Pedido novo | Efeito no projeto |
| --- | --- | --- |
| P10 | Aluno menor de 18: CPF dele, CPF do responsável, data de nascimento dos dois e um e-mail válido para validar | Resolve as decisões D2 e D3 do projeto. Entra no 20c |
| P11 | Autorização do responsável com nome e CPF, e declaração de que os dados são verdadeiros. Foto de documento: em dúvida | Entra no 20c. Foto de documento: **não recomendada** (seção 3) |
| P12 | Calendário: clicar no dia e ver os horários, de 06:00 a 23:00, para colocar tarefas | Item novo no 20d |
| P13 | Disciplinas: as gerais já vêm no cadastro; 10 campos para disciplinas próprias; em Personalizar o aluno corrige e acrescenta; máximo de 20 | Ajusta o 20b: o limite passa de 30 para **20** |

## 2. Cadastro do aluno menor de 18 (P10, P11) — como resolver

### 2.1 Fluxo proposto (5 passos)
1. O aluno informa a data de nascimento. O sistema calcula a idade. Com 18 ou mais, segue o cadastro comum.
2. Com menos de 18, a tela pede: nome e CPF do aluno; nome, CPF, data de nascimento e e-mail do responsável.
3. O sistema confere o que consegue conferir: os dígitos dos 2 CPFs, os 2 CPFs diferentes entre si, o responsável com 18 anos ou mais, o formato do e-mail.
4. A conta do aluno fica no estado **"aguardando o responsável"**. Ela não entra no sistema e não guarda nenhum dado escolar.
5. O responsável recebe um e-mail com um link de uso único, válido por 7 dias. Ele abre, lê o termo, marca a declaração e confirma. Só então a conta é liberada. Sem confirmação em 7 dias, o pedido expira e os dados do pedido são apagados.

### 2.2 O termo que o responsável confirma
Texto literal, com 3 caixas de marcar separadas:
1. "Sou o responsável legal por [nome do aluno]."
2. "Autorizo o uso do SIESAL por ele e o tratamento dos dados descritos na Política de Privacidade."
3. "Declaro que os dados informados são verdadeiros."

O sistema guarda como prova: a versão do termo, a data e a hora, e o identificador do pedido. Vai para a auditoria, sem o CPF.

### 2.3 Limites que precisam ficar claros (fato)
- **O sistema não tem como provar que o CPF é do responsável nem que ele é de fato o responsável.** Ele confere só os dígitos. O que existe é declaração mais confirmação por e-mail. Isso deve estar escrito no RIPD e na Política.
- **A Parte 1 não tem envio de e-mail real** (está na Parte 2). Proposta: o fluxo completo é feito agora, e o e-mail é entregue em uma caixa de teste dentro do Docker do SIESAL (contêiner próprio, sem relação com o TI-REX). Na Parte 2 troca-se só o endereço do servidor de e-mail. Motivo: a Parte 1 só tem dado fictício.
- "Pai" vira **"responsável"** nas telas: pode ser mãe, pai ou tutor.
- Os 2 CPFs seguem a proteção do projeto: cifrados, mascarados em tela, fora de log e de auditoria.

## 3. Foto de documento (P11) — recomendação: não fazer

1. **Não resolve o problema.** O sistema não sabe dizer se a foto é verdadeira nem se a pessoa da foto é quem está cadastrando. Uma pessoa teria de olhar cada foto.
2. **Cria o maior risco do sistema.** Foto de RG ou CPF de adulto e de menor é o dado mais sensível que o SIESAL teria. Um vazamento permitiria fraude com a identidade de famílias.
3. **Contraria a regra de coletar o mínimo** (LGPD) e aumenta o custo: armazenamento cifrado, prazo de guarda, descarte, quem pode ver.
4. **Alternativa para a Parte 2:** entrar com a conta gov.br. O governo confirma a identidade e o SIESAL não guarda documento nenhum.

Resumo: na Parte 1, declaração do responsável + confirmação por e-mail + registro de auditoria. Este ponto vai para o parecer jurídico (ECA Digital e LGPD). Eu não sou advogado.

## 4. Calendário por horário (P12)

Fato lido no código: clicar em um dia hoje só mostra a lista de eventos daquele dia. Não há grade de horários. O formulário de evento já aceita hora.

Proposta ("Grade do dia"):
1. Clicar em um dia abre a visão Dia com as horas de **06:00 a 23:00**, uma linha por hora.
2. As horas ficam em 3 grupos com nome e ícone: Manhã (06 a 11), Tarde (12 a 17), Noite (18 a 23). Isto segue a regra de tempo concreto do projeto: parte do dia primeiro, hora exata como detalhe.
3. Clicar em uma hora abre o formulário já com o dia e a hora preenchidos. O aluno escolhe: **evento novo** ou **uma tarefa que já existe** (a tarefa aparece naquele horário, ligada ao evento).
4. A duração continua em blocos (curto, médio, longo). O item ocupa a altura correspondente na grade.
5. A lista simples do dia continua disponível, para quem prefere e para o leitor de tela.
6. Sem migração: as colunas `dia`, `hora_inicio`, `minutos` e `tarefa_id` já existem na tabela `evento`. A importação do Google (Parte 2) encaixa na mesma grade.

Terminou quando: clicar no dia mostra as 18 horas; criar item por clique na hora funciona com mouse, toque e teclado; funciona em 360, 768 e 1280 px sem rolagem para os lados; axe sem violações.

## 5. Disciplinas (P13) — regra final

1. No cadastro, as disciplinas gerais já aparecem **marcadas**, conforme a etapa do aluno (fundamental ou médio): Língua Portuguesa, Matemática, História, Geografia, Ciências (ou Física, Química e Biologia), Língua Inglesa, Arte, Educação Física. O aluno desmarca as que não tem.
2. Abaixo, **10 campos** para disciplinas próprias.
3. Em Personalizar, o aluno corrige o nome das que criou, desativa e acrescenta outras.
4. **Limite: 20 disciplinas próprias por aluno.** As disciplinas marcadas do catálogo não contam nesse limite. (Leitura adotada do pedido; se o limite de 20 for para o total, marcadas mais próprias, avise.)
5. O limite fica no banco e na API, não só na tela.

## 6. Lotes depois do adendo

| Lote | Itens |
| --- | --- |
| 20a | 1) cor e tema; 2) conferência de Personalizar e Acessibilidade; 3) tempo das atividades personalizável |
| 20b | 1) catálogo com as gerais marcadas; 2) Minhas disciplinas (10 no cadastro, 20 no máximo); 3) busca de disciplina na tarefa |
| 20c | 1) espaço individual e isolamento; 2) entrada com as 2 opções e cadastro por convite; 3) cadastro do aluno, com o fluxo do menor e a autorização do responsável por e-mail |
| 20d | 1) dificuldade de 0 a 10, com a regra de sugestão; 2) cards de resumo, com o modo Revisar; 3) calendário por horário |

O 20c ficou maior. Estimativa nova: 16/11 a 22/11 (antes: até 21/11). O 20d passa para 23/11 a 26/11. A checagem humana começa em 27/11. O prazo de 10/12 continua com folga.

## 7. Decisões — situação

| # | Decisão | Situação |
| --- | --- | --- |
| D2 | CPF | **Respondida pelo proprietário:** CPF do aluno e do responsável são pedidos no cadastro do menor. Falta confirmar se o aluno maior de 18 também informa CPF |
| D3 | Menor de 18 | **Respondida:** entra com autorização do responsável (seção 2) |
| D6 | Lista de disciplinas | **Respondida em parte:** gerais marcadas, 10 campos, máximo de 20 |
| D7 (nova) | Foto de documento | Recomendado: não. Aguardando resposta |
| D8 (nova) | E-mail de validação na Parte 1 | Recomendado: caixa de teste no Docker. Outra opção: trazer o envio real de e-mail da Parte 2 para a Parte 1 |
| D1, D4, D5 | Sem mudança | Aguardando, cada uma no seu lote |

## 8. Ajuste por causa do CLAUDE.md do repositório
A regra de tempo concreto diz: "o aluno escolhe o bloco; não digita minutos". Por isso a opção "Outro tempo", que estava no item 4.7 do projeto, **sai**. O tempo personalizável fica só em Personalizar, com botões de mais e menos de 5 em 5 minutos para cada bloco.

## Feito, Falta, Sugestões
**Feito:** análise dos 4 pedidos novos; fluxo do menor com autorização por e-mail; parecer técnico sobre foto de documento; projeto da grade do dia; regra final das disciplinas; lotes e datas refeitos.
**Falta:** aprovação da divisão; respostas D7 e D8; a parte final da mensagem do proprietário, que chegou cortada ("uma coisa que você falou e que me deixou um pouco preocupado").
**Sugestões:** levar a seção 3 (foto de documento) ao professor e ao NAPNE em 12/11/2026.
