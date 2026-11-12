# PROPOSTA CURTA — LOTE L20c (Aluno sem instituição) — SIESAL 4.0

Data: 11/11/2026. Estado: **Planejado. NÃO aprovado.** Nenhum ramo, código, migração ou commit do L20c.
Base: `lote-20b-disciplinas` em `0af5153` (0018 e 0019 aplicadas no site; matriz v14). Complementa `PLANO-L20A-A-L20D.md` (4.1 a 4.3), `ADENDO-1` (seções 2 e 3) e `ADENDO-2` (seções 2 a 4). Onde divergirem, vale o mais novo.
Migrações previstas: **0020** (20c-1) e **0022** (20c-2; a 0021 foi do 20c-3). Matriz: **v15** e **v17** (v16 foi do 20c-3). O 20d passa a usar a 0023 e a v18.

## 1. Resultado em 4 linhas
1. O L20c é o lote de maior risco do projeto (cadastro novo, CPF, menor de idade sem escola). **Proponho dividi-lo em dois**: **20c-1** (espaço individual, entrada e isolamento) e **20c-2** (cadastro com CPF, data de nascimento, menor com responsável e e-mail). Cada um com 3 itens e "aprovo" próprio.
2. O 20c-1 não coleta dado pessoal novo. O 20c-2 coleta CPF e data de nascimento, e por isso depende de documentos (RIPD, Política, Mapa de Riscos) e de parecer jurídico para sair do ambiente de teste.
3. Quatro decisões suas pendentes (seção 7), uma por vez: **D1** e **D4** no 20c-1; **D2b** (CPF do maior de 18) e **D8** (e-mail) no 20c-2. A D7 (foto de documento) está com recomendação "não".
4. Prazo (estimativa, não promessa): 20c-1 em 12/11 e 13/11; 20c-2 de 14/11 a 18/11; 20d depois. O ponto de controle do plano (20/11) se mantém.

## 2. Fatos lidos no código (11/11/2026)
| # | Fato | Onde |
| --- | --- | --- |
| F1 | Toda conta é criada pelo Admin (ou pelo Master, para o primeiro Admin). Não existe cadastro feito pela própria pessoa | `api/src/auth/cadastro.integracao.test.ts`, `Login.tsx` |
| F2 | O login pede o código da instituição, e-mail e senha. Existe um limitador de tentativas | `api/src/auth/limitador.ts`, `web/src/paginas/Login.tsx` |
| F3 | Toda tabela escolar tem `instituicao_id` e RLS. Há um teste que exige RLS ativa e forçada em **toda** tabela do esquema | `api/src/banco/isolamento.integracao.test.ts` |
| F4 | O sistema trata todo aluno como menor: pedido de encerramento ou troca de e-mail exige o Responsável ou o Admin | migração 0013 |
| F5 | `usuario` não tem data de nascimento, CPF nem matrícula | `api/migracoes/0001_base.sql` |
| F6 | O RIPD, a Política de Privacidade e o Modelo de Dados **não estão neste repositório**: ficam no Projeto do claude.ai. Eu não os leio nem os altero | `CLAUDE.md`, seção 10 |

## 3. Divisão proposta

### 20c-1 — Espaço individual e entrada (tamanho M) — ramo `lote-20c1-espaco-individual`
1. **Espaço individual e isolamento:** `instituicao.tipo` (escola ou individual). Cada aluno sem instituição tem um espaço só dele. Módulos ligados por tipo (sem turmas, notas oficiais, avisos da escola, calendário da escola, identidade visual). O Master vê **só a quantidade**. O espaço individual não aparece na lista de escolas. Encerrar a conta encerra o espaço.
2. **Entrada:** tela inicial com uma pergunta e duas opções, na redação do Adendo 2: "Vinculado a uma instituição" (código, e-mail e senha, como hoje) e "Sem instituição" (e-mail e senha; botão "Criar conta"). Função do banco que acha o espaço pelo e-mail e devolve só o identificador; mensagem de erro igual para "e-mail não existe" e "senha errada"; o limitador atual continua.
3. **Cadastro por convite** (se a D4 for "convite"): o Master gera um código de uso único; quem tem o código cria a própria conta com nome, e-mail e senha. Sem dado novo além disso.
- **Terminou quando:** teste de isolamento nos 3 sentidos (aluno A não lê o aluno B; individual não lê escola; escola não lê individual); o Master não vê nome, e-mail nem conteúdo; a tela de entrada passa no axe, no teclado e em 360, 768 e 1280 px; a mensagem de erro é igual nos dois casos.
- Migração **0020**; matriz **v15**; retorno em `docs/RETORNO-0020.md`.

### 20c-2 — Cadastro com CPF e responsável (tamanho G) — ramo `lote-20c2-cadastro`
1. **Dados do aluno:** data de nascimento, CPF cifrado (índice separado por HMAC, mascarado em tela, fora de log e de auditoria), `matricula` opcional (preparo do SUAP), escola(s) em texto opcional e a etapa (já existe, L20b).
2. **Menor de 18 anos:** conta fica "aguardando o responsável" e não guarda dado escolar. Pede nome, CPF, data de nascimento e e-mail do responsável; confere os dígitos dos 2 CPFs, que sejam diferentes, e responsável com 18 anos ou mais. Link de uso único válido por 7 dias; sem confirmação, o pedido expira e os dados são apagados.
3. **Autorização do responsável:** termo literal com 3 caixas ("Sou o responsável legal por [nome]"; "Autorizo o uso do SIESAL por ele e o tratamento dos dados descritos na Política de Privacidade"; "Declaro que os dados informados são verdadeiros"). Prova guardada: versão do termo, data e hora, identificador do pedido (sem CPF). E-mail entregue na caixa de teste dentro do Docker (D8).
- **Terminou quando:** nenhum teste automático acha o valor do CPF em resposta de API, log ou auditoria; menor de 18 não conclui o cadastro sozinho; pedido expirado some; os termos e o fluxo passam no axe e no teclado.
- Migração **0022** (a 0021 foi usada pelo 20c-3); matriz **v17**; retorno em `docs/RETORNO-0022.md`; chave do CPF em segredo do Docker, fora do git, sem relação com o TI-REX.
- **Antes do código:** o RIPD, a Política e o Mapa de Riscos precisam mudar no Projeto ("não coletamos CPF" deixa de ser verdade). Eu entrego a lista exata de mudanças; quem as aplica é você.

## 4. Regras do espaço individual (4.1 do plano, sem mudança)
Só entram o aluno e, se for menor, o Responsável dele. Não existe Admin, Professor nem Pedagógico. Passar de "sem instituição" para "vinculado", levando os dados, fica para a Parte 2.

## 5. CIDA + Rastreabilidade
| Lote | Confidencialidade | Integridade | Disponibilidade | Autenticidade | Rastreabilidade |
| --- | --- | --- | --- | --- | --- |
| 20c-1 | RLS separa cada espaço; o Master vê só números | tipo da instituição validado no banco | backup cobre os espaços individuais | convite de uso único; limitador; erro igual | auditoria de convite criado e usado, conta criada |
| 20c-2 | CPF cifrado e mascarado | validação do CPF e da data; CPFs diferentes | chave do CPF com cópia segura | link de uso único de 7 dias; declaração do responsável | auditoria do aceite e de "CPF alterado", sem o valor |

## 6. O que a Parte 1 não faz
- Prova de que o CPF é do responsável: o sistema confere só os dígitos. Isto precisa estar escrito no RIPD e na Política. Vai para o parecer jurídico (LGPD e ECA Digital).
- Foto de documento (D7, recomendado: não). Alternativa na Parte 2: conta gov.br.
- Cadastro aberto com e-mail real, migrar dados entre "sem instituição" e "com instituição", importar do SUAP.

## 7. Decisões pendentes (uma por vez)
| # | Decisão | Recomendada | Outra | Lote |
| --- | --- | --- | --- | --- |
| D1 | Como guardar o aluno sem escola | Espaço individual (uma instituição do tipo individual por aluno) | Espaço único com RLS nova por dono em cada tabela | 20c-1 |
| D4 | Cadastro individual | Por convite gerado pelo Master | Aberto a qualquer pessoa | 20c-1 |
| D2b | CPF do aluno maior de 18 anos | Opcional | Obrigatório | 20c-2 |
| D8 | E-mail de validação | Caixa de teste no Docker | Envio real de e-mail trazido da Parte 2 | 20c-2 |
| D7 | Foto de documento | Não | Sim | 20c-2 |

## 8. Pedido de aprovação
Para começar o 20c-1: **"aprovo o 20c-1"** e a resposta da D1 (depois a D4, na mensagem seguinte). Para o 20c-2: aprovação própria, depois das respostas D2b, D7 e D8 e da mudança dos documentos de privacidade no Projeto. Sem isso, nenhum ramo e nenhum código.

## Feito, Falta, Sugestões
**Feito:** leitura do código; divisão do 20c em dois lotes de 3 itens; plano de banco, matriz, retorno e testes; lista de decisões.
**Falta:** "aprovo o 20c-1" e D1 e D4; D2b, D7 e D8 para o 20c-2; atualização do RIPD, da Política e do Mapa de Riscos no Projeto; "aprovo" da divisão dos lotes 20a a 20d (A-046 ainda pede); parecer jurídico antes de qualquer dado real.
**Sugestões:** levar a divisão do 20c e as decisões D2b e D7 ao professor e ao NAPNE em 12/11/2026.
