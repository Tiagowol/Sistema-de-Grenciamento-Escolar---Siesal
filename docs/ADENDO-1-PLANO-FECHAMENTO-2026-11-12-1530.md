# ADENDO 1 AO PLANO DE FECHAMENTO DA PARTE 1 — SIESAL 4.0 (12/11/2026, 15:30)

Complementa e corrige `PLANO-FECHAMENTO-PARTE-1-2026-11-12.md`. Estado: **Planejado** (só documento). Nenhum código, banco ou repositório foi alterado.

## 1. Decisões e correções do proprietário (chat de 12/11/2026, 15:03)

1. **Acompanhamento é requisito central.** O aluno isolado precisa poder ser acompanhado por professor e por pedagogo/NAPNE, inclusive de uma instituição. Se isso não for possível, o sistema teria de ser revisto. Pedido: solução segura (seção 2).
2. **Aluno menor isolado: quem cria a conta é o Responsável.** O menor precisa da autorização de um adulto. Pedido: forma simples de tratar a idade, ou aceite com declaração de que os dados são reais e de responsabilidade de quem cadastrou (seção 3).
3. **Árvore do Master (decide a lacuna N6).** O Master gerencia o sistema inteiro. Ele vê a árvore de toda instituição e de todo aluno isolado (aluno e Responsável quando menor; aluno quando maior). Ele não vê nota, não altera nota e não altera e-mail. Motivo: rastreio, auditoria e atendimento de suporte. O proprietário aceita o risco. Isso deve constar no aceite do contrato de abertura de conta.
4. **Chave do CPF (corrige a falha S1 do plano).** O proprietário informou que já gerou uma chave nova e gravou no `.env`, manualmente, sem mostrar a ninguém. O plano dizia que a chave exposta ainda estava em uso: estava errado, porque o último registro no repositório era a A-063. O `.env` não é visível para o Claude nem fica no git. **A conferir pelo Code:** se a API foi recriada depois da troca e se havia 0 CPFs no banco na hora da troca.
5. **Registro.** Tudo o que o Claude do chat e o Code fazem precisa ficar gravado: feito, falta, sugestões e como voltar. Hoje isso falha (plano L21–L25, A-069 e A-070 sem commit; troca da chave sem registro). Correção urgente (seção 5).
6. **Parar e formalizar antes de seguir.** Atualizar ramo, `CLAUDE.md` e documentos antes de qualquer lote.

## 2. Solução proposta: vínculo de acompanhamento

**Resultado:** não é preciso refazer o sistema. O isolamento por espaço (instituição ou aluno isolado) continua igual. Acrescenta-se uma camada acima: a **pessoa** (uma conta) que **participa** de um ou mais espaços. Isso já era o L22a.

### 2.1 Regra principal
O pedido **sempre nasce do lado do aluno**. Nenhum adulto procura, lista ou convida aluno. Não existe busca de alunos.

### 2.2 Dois caminhos para o aluno isolado
- **Caminho A — por e-mail.** O aluno (ou o Responsável) digita o e-mail do professor ou do pedagogo e escolhe o papel. A pessoa recebe um link de uso único. Se já tem conta no SIESAL, entra e aceita. Se não tem, faz o cadastro próprio (A-070) e aceita.
- **Caminho B — por código da instituição.** A instituição que quiser atender alunos de fora liga a opção "aceitar pedidos de acompanhamento" e recebe um código (exemplo: o NAPNE do IFRN Canguaretama). O aluno digita o código. O pedido cai na fila do Pedagógico daquela instituição, que aceita ou recusa. O aluno não vê lista de nomes de profissionais.

Exemplo pedido: aluno do IF usa o SIESAL como isolado; digita o código do NAPNE (ou o e-mail da pessoa do NAPNE); o NAPNE aceita; passa a ver o que o aluno liberou.

### 2.3 O que o acompanhante vê
O aluno (com o Responsável, se menor) marca o que libera, item por item. Padrão: nada marcado.
1. Tarefas e plano de estudo.
2. Nível de dificuldade (0 a 10) de tarefas e disciplinas.
3. Notas escolares (lançadas ou importadas).
4. Mensagens (enviar e receber; não é chat; sem anexo e sem link, como hoje).

### 2.4 Regras de segurança
1. Aluno menor: o vínculo só vale depois que o Responsável aprova.
2. O Responsável lê todas as mensagens entre o adulto e o menor.
3. Antes de aprovar, a tela mostra quem é a pessoa: "pertence à instituição X" (instituição criada por convite do Master) ou "sem instituição: dados declarados pela própria pessoa".
4. O aluno e o Responsável têm a tela "Quem pode ver meus dados", com botão de encerrar o vínculo a qualquer hora.
5. O vínculo tem validade (proposta: até o fim do ano letivo) e pode ser renovado.
6. Um aluno por vez; sem lista com dados de vários alunos, sem média, sem ordem, sem comparação (regra do 20d mantida).
7. Cada leitura fica na auditoria, sem o valor lido.
8. Limite de acompanhantes por aluno (proposta: 5).

### 2.5 Como fica no banco (resumo para a proposta do L22a)
- `pessoa`: identidade única de login, acima dos espaços.
- `participacao`: pessoa, espaço, papel, itens liberados, validade, situação. Fica fora dos dados escolares (só identificadores).
- O acompanhante trabalha **dentro do espaço do aluno**, com papel professor ou pedagógico e escopo "vínculo". A RLS e a matriz atuais continuam valendo; nenhuma consulta cruza espaços.
- Migração de dados existentes: pela API ou com contexto por instituição (lição da F-054), com teste em banco com dados.

### 2.6 Nome para a "nota de dificuldade"
**"Nível de dificuldade"** (0 a 10). A palavra "nota" fica só para nota escolar. Trocar em telas, textos de transparência, matriz e documentos. Confirmado pelo proprietário em 12/11/2026, 15:20 (Adendo 2).

## 3. Solução proposta: idade e Responsável

**Fato:** não existe forma simples de provar idade pela internet sem documento. Declaração pode ser falsa. A proposta reduz o dano de uma declaração falsa, em camadas.

1. **O adulto cria a conta.** No aluno isolado menor, o cadastro começa pelo Responsável: ele cria a própria conta e, dentro dela, o perfil do aluno. Hoje o código faz o contrário (o aluno se cadastra e o Responsável só clica num link; A-061). O L22a passa a seguir a regra do proprietário.
2. **Aceite com declaração** (a sugestão do proprietário): "os dados são verdadeiros e são de minha responsabilidade", com versão do termo, data e hora gravadas. O mesmo aceite informa que o Master vê a árvore cadastral (decisão 3).
3. **E-mail do adulto confirmado** e diferente do e-mail do aluno (já existe).
4. **Data de nascimento decide o fluxo** e não pode ser alterada pelo próprio aluno depois; só por pedido de suporte, com auditoria.
5. **Selo "confirmado pela instituição"**: quando uma instituição ou o NAPNE aceita o vínculo, ela confirma que conhece o aluno. É a prova mais forte disponível sem documento.
6. **Parte 2 (a conferir a viabilidade):** entrada do Responsável pelo gov.br.

O que sobra de risco: um menor que declara ser maior fica sem Responsável. O dano é limitado pelas regras 2.1 e 2.4 (ninguém o procura; mensagens não são chat). Vai ao parecer jurídico; o Claude não é advogado.

## 4. Árvore do Master: como registrar a decisão 3

Separar dois tipos de dado:
- **Dado cadastral** (o Master vê): quem existe em cada espaço, nome, papel, situação, vínculos e convites.
- **Dado escolar e pedagógico** (o Master nunca vê nem altera): notas, nível de dificuldade, tarefas, plano, cards, mensagens. Também não altera e-mail.

Consequências: recurso novo na matriz (árvore cadastral, leitura, Master, escopo plataforma); toda consulta na auditoria do Master; texto no aceite de abertura de conta; atualizar o papel do projeto ("sem acesso a dados escolares" continua verdadeiro); RIPD, Política e Mapa de Riscos (L25). O pedido de suporte do aluno isolado passa a ser atendido pelo Master, sem dado escolar. A afirmação "não quebra a LGPD" fica registrada como decisão e risco aceito pelo proprietário, a confirmar no parecer jurídico.

## 5. Correção do registro (urgente)

Causa provável da falha: a regra do projeto exige autorização para cada commit. Sem autorização, o Code deixa os documentos só na sessão.

Regra fixa (aprovada em 12/11/2026, 15:20):
1. Toda sessão (chat ou Code) termina com um **diário de sessão**: `docs/diario/AAAA-MM-DD-HHMM.md`, com Feito, Falta, Sugestões e como voltar.
2. **Autorização permanente só para documentos:** commit e push de arquivos de `docs/` ao fim de cada sessão, sem pedir de novo. Código, migração, merge e deploy continuam com autorização separada.
3. Ação manual do proprietário (exemplo: troca de chave) vira 1 linha no diário da sessão seguinte, sem o segredo.
4. O Claude do chat grava o mesmo no Projeto.

## 6. O que muda no plano

- **S1 (chave do CPF):** deixa de ser falha aberta.
- **N3:** a frase "o Responsável não tem conta" descreve o código de hoje, não a regra do proprietário. Vira item do L22a.
- **N6:** decidida (seção 4). O L22b pode ser proposto.
- **L22a** dividido em L22a-1 (pessoa, participação, Responsável) e L22a-2 (acompanhamento e tela "Quem pode ver meus dados").
- **G0** ganha a regra da seção 5 e continua sendo o primeiro passo.

## 7. Feito, Falta, Sugestões

**Feito:** decisões de 12/11 (15:03) registradas; solução de acompanhamento, de idade e de árvore do Master escritas; plano corrigido (S1, N3, N6).
**Falta:** o Code conferir a troca da chave; propostas do L22a-1 e do L22a-2.
**Sugestões:** nenhuma nova.
