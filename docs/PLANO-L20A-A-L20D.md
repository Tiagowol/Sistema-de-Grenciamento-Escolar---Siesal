# PROJETO DE IMPLEMENTAÇÃO — LOTES 20a A 20d (ADEQUAÇÃO) — SIESAL 4.0

Data: 10/11/2026, 23:30. Estado: **Planejado. NÃO aprovado.** Nenhum código, banco, migração, commit ou deploy foi feito.
Origem: intervenção do professor, de Tiago Wagner e do NAPNE, trazida pelo proprietário em 10/11/2026, 22:31.
Base lida: `siesal-4` em `1d260be` (L13 a L20 Implementados, migrações 0001 a 0017, matriz v12), registros A-001 a A-045 e F-001 a F-051.

---

## 1. Resultado em 5 linhas

1. Os 9 pedidos cabem em 4 lotes, de 3 itens cada, sem quebrar o que já existe.
2. Ordem proposta: **20a** Personalizar e Acessibilidade → **20b** Disciplinas → **20c** Aluno sem instituição → **20d** Dificuldade e cards de resumo.
3. Estimativa: de 11/11 a 25/11/2026. Sobra de 26/11 a 10/12 para checagem humana, ajustes e folga.
4. O lote de maior risco é o 20c (cadastro aberto, CPF, menor de idade sem escola). Ele tem 3 decisões que só o proprietário toma (seção 9).
5. Isto muda um plano registrado: a A-036 dizia que a numeração terminava no L20. Se aprovado, o Code registra como **A-046**.

---

## 2. Os pedidos, numerados (para rastrear)

| Nº | Pedido (como foi escrito) | Lote |
| --- | --- | --- |
| P1 | Atender aluno desvinculado de instituição; no login, escolher "com instituição" ou "sem instituição"; regra de isolamento do aluno individual | 20c |
| P2 | Cadastro do aluno: data de nascimento, CPF, escolas (opcional, com regras de notas e médias) | 20c |
| P3 | Marcar as disciplinas que servem para o aluno; lista do fundamental (anos finais), médio, médio integrado e profissionalizante, com as do IFRN e nomes parecidos; cerca de 10 campos para disciplina própria; cadastrar depois em Personalizar | 20b |
| P4 | Ao criar tarefa, escolher a disciplina em lista, com busca e digitação das iniciais | 20b |
| P5 | Nota de dificuldade de 0 a 10 na disciplina e na tarefa (0 muito fácil, 10 extremamente difícil) | 20d |
| P6 | Cards com resumo de conteúdo nas tarefas, com ajuda para o aluno criar | 20d |
| P7 | "Tempo das atividades" personalizável pelo aluno | 20a |
| P8 | A cor em Personalizar não muda o tema; conferir se tudo de Personalizar e Acessibilidade funciona | 20a |
| P9 | Planejar como lote especial de adequação, 20a a 20d, logo depois do L20 | este documento |

---

## 3. O que a leitura do código mostrou (fato, com arquivo)

Estes pontos foram achados **lendo o código**. Nenhum foi testado no navegador nesta sessão. O 20a começa confirmando cada um.

| # | Achado | Onde |
| --- | --- | --- |
| C1 | A cor de destaque troca só a variável `--primary`. O fundo suave (`--primary-soft`), o menu lateral, o painel de boas-vindas e a marca têm cor fixa. Por isso a tela quase não muda. Esta é a causa provável do P8. | `web/src/preferencias.ts` (aplicarPreferencias), `web/src/estilos/prototipo.css` linhas 115, 136, 495, 1152 |
| C2 | Em Acessibilidade dá para ligar "Tema escuro" e "Alto contraste" juntos (o CSS tem esse tema, com fundo preto). Em Personalizar e no banco, alto contraste é sempre fundo branco. A cor é calculada para o fundo errado e o tema muda no próximo login. | `web/src/paginas/Acessibilidade.tsx`, `temaDe` em `preferencias.ts`, tabela `preferencia_usuario` |
| C3 | "Modo simples" não esconde nada: a classe `hide-on-simple` não é usada em nenhuma tela. Só muda espaçamento. | 0 usos em `web/src/**/*.tsx` |
| C4 | A tela Acessibilidade diz "os outros ajustes ficam neste aparelho". Para o aluno isso é falso: são salvos na conta. Para os outros 4 perfis é verdade, e por isso não acompanham a pessoa em outro aparelho. | `Acessibilidade.tsx`, `App.tsx` linha 173 |
| C5 | Personalizar e Acessibilidade repetem controles, mas com listas diferentes. Leitura facilitada, Modo simples, Linguagem curta e "Escolha o que fazer agora" só existem em Acessibilidade. | as 2 páginas |
| C6 | 161 cores escritas direto no CSS (128 + 33). Parte delas não acompanha o tema. | `prototipo.css`, `extra.css` |
| C7 | A disciplina da tarefa é texto livre (até 80 letras). O mesmo vale para a nota pessoal. | `tarefa.disciplina`, `nota_pessoal.disciplina` (migração 0006) |
| C8 | Os blocos de tempo são fixos no código: Curto 10, Médio 25, Longo 45 minutos (decisão do L13). | `web/src/blocos.ts` |
| C9 | Não existe cadastro feito pela própria pessoa. Toda conta é criada pelo Admin. O login exige o código da instituição. | `web/src/paginas/Login.tsx`, `api/src/auth/` |
| C10 | Toda tabela escolar depende de `instituicao_id` (chave e RLS). O isolamento entre alunos da mesma escola é feito na API, não no banco. | migrações 0001, 0006, 0012 |
| C11 | O sistema trata todo aluno como menor de idade (pedido de conta exige aprovação). Não há data de nascimento. | migração 0013 |
| C12 | O RIPD e o Modelo de Dados dizem: "Não coletamos CPF". O P2 muda isso. | `claude/lote-0/MODELO-DE-DADOS.md`, `RIPD.md` |

---

## 4. Decisões de arquitetura propostas

### 4.1 Aluno sem instituição = "espaço individual" (P1)
- **Proposta:** cada aluno sem escola recebe um espaço próprio, que no banco é uma linha de `instituicao` com `tipo = 'individual'`. As escolas ficam com `tipo = 'escola'`.
- **Motivo:** toda a proteção que já existe (RLS por `instituicao_id`, `withTenant`, auditoria, backup, encerramento de conta) passa a valer sem reescrever 20 tabelas. O isolamento entre dois alunos individuais fica **no banco**, que é mais forte do que o isolamento entre alunos da mesma escola hoje.
- **Alternativas descartadas:** (a) um único espaço "sem escola" para todos, com RLS nova por dono em cada tabela: mexe em todas as políticas e um erro expõe todos; (b) `instituicao_id` vazio: quebra todas as chaves.
- **Regras do espaço individual:**
  1. Só entram o aluno e, se for menor, o Responsável dele. Não existe Admin, Professor nem Pedagógico.
  2. Módulos desligados por tipo: turmas, notas oficiais, avisos da escola, calendário da escola, identidade visual. Ligados: Meu dia, Agenda, Calendário, Atividades, Foco, notas pessoais, Personalizar, Acessibilidade, Conta.
  3. O Master vê só a **quantidade** de espaços individuais. Nunca nome, e-mail, CPF ou conteúdo. O espaço individual não aparece na lista de escolas.
  4. Encerrar a conta do aluno encerra o espaço (mesma anonimização do L17c).
  5. Passar de "sem escola" para "com escola" levando os dados fica para a **Parte 2** (portabilidade). Na Parte 1 a pessoa escolhe um dos dois modos ao entrar.

### 4.2 Entrada (login e cadastro) (P1)
- Tela de entrada com 2 opções, uma pergunta só: **"Uso com a minha escola"** (mostra o código da instituição, como hoje) ou **"Uso sozinho, sem escola"** (pede só e-mail e senha).
- No modo "sem escola" o servidor acha o espaço pelo e-mail, por uma função do banco que devolve só o identificador. Mensagem de erro igual para "e-mail não existe" e "senha errada". O limitador de tentativas atual continua valendo.
- **Cadastro por convite na Parte 1** (recomendado): o Master gera um código de convite de uso individual; quem tem o código cria a própria conta. Motivo: o link do sistema é público (Funnel) e a Parte 1 não tem e-mail real para confirmar endereço. Cadastro aberto, com confirmação por e-mail, fica para a Parte 2.

### 4.3 Dados novos do aluno (P2)
- **Data de nascimento:** obrigatória. Usada para calcular maioridade. Com ela, o aluno maior de 18 confirma sozinho os pedidos de conta (corrige o C11). Aparece só em Minha conta e para o Admin. Nunca para professor.
- **CPF:** guardado cifrado, com índice separado (HMAC) para impedir repetição dentro do mesmo espaço. Nunca aparece inteiro em tela, log ou auditoria (só os 2 últimos dígitos). A auditoria registra "CPF alterado", sem o valor. É apagado na anonimização. Chave própria do SIESAL, em segredo do Docker, fora do git e sem relação com o TI-REX.
- **Escola(s) do aluno individual (opcional):** nome, etapa, ano ou série, turno, ano letivo. É texto do aluno, não cria vínculo com instituição real.
- **Regras de notas e médias do aluno individual:** reutiliza as regras versionadas do L19, editadas pelo próprio aluno no espaço dele. Modelos prontos para escolher (por exemplo "4 bimestres"). A média aparece só para o aluno e o Responsável (mantém a A-040). Sem ranking e sem comparação.

### 4.4 Disciplinas (P3, P4)
- **Catálogo da plataforma** (`disciplina_catalogo`): tabela global, só leitura para as escolas, sem dado pessoal, versionada por migração. Campos: nome, nome sem acento, etapa, curso, sinônimos.
- **Disciplinas do aluno** (`disciplina_aluno`): o que ele marcou do catálogo mais as que ele criou. Limite: 10 campos de disciplina própria na tela de cadastro e 30 no total (trava de abuso). Gerenciadas em Personalizar.
- **Nomes parecidos:** sinônimos apontam para uma disciplina só. Exemplos: Português = Língua Portuguesa = Língua Portuguesa e Literatura; Inglês = Língua Inglesa; POO = Programação Estruturada e Orientada a Objetos.
- **Na tarefa:** o campo de texto vira uma caixa de busca acessível (padrão WAI-ARIA combobox). Digitar as iniciais filtra; acento e maiúscula não importam; funciona por teclado e leitor de tela; alvo de 44 px. Última opção da lista: "Criar a disciplina …", que salva nas disciplinas do aluno.
- **Dados antigos:** a coluna de texto fica (histórico). A migração cria a disciplina do aluno a partir de cada texto já usado. Nada se perde, nada se apaga.
- **Aluno de escola:** as disciplinas das turmas dele entram marcadas sozinhas; ele pode marcar outras.

### 4.5 Dificuldade de 0 a 10 (P5)
- Campo opcional na disciplina do aluno e na tarefa. Tela com 11 posições e palavras nas pontas e no meio (0 "muito fácil", 5 "média", 10 "extremamente difícil"), porque o sistema não pode depender só de número (requisito de 08/11).
- É a percepção do aluno. **Não é avaliação nem dado clínico.** Fica visível só para o próprio aluno na Parte 1. Nunca vira ranking, média de turma ou comparação.
- Uso prático (1 regra, sem IA): tarefa com dificuldade 7 ou mais faz o plano sugerir começar antes e usar blocos menores. O aluno aceita ou recusa.

### 4.6 Cards de resumo (P6)
- Cartão com título, frente e verso, só texto (sem link, sem HTML), ligado a uma tarefa ou a uma disciplina. Limite de 20 cards por tarefa.
- **Ajuda para criar, sem IA** (decisão vigente): assistente em 3 passos com 4 modelos — Conceito ("O que é? Para que serve? Um exemplo"), Passo a passo, Fórmula, Pergunta e resposta. Contador de letras e dica de frase curta.
- Modo "Revisar": um card por vez, botão "Ver o resumo". Sem animação quando "Reduzir movimento" está ligado.
- Só o aluno vê. Faz parte do módulo "apoio ao aluno" (some se o módulo estiver desligado).

### 4.7 Tempo das atividades (P7)
- O aluno define os minutos dos 3 blocos (Curto, Médio, Longo) em Personalizar, de 5 em 5, entre 5 e 120, mantendo Curto < Médio < Longo. Padrão continua 10 / 25 / 45.
- Opção "Outro tempo" ao criar plano, evento ou sessão de foco, dentro dos limites que o banco já tem.
- O tempo continua aparecendo com palavra e forma (Tempo visual), não só número.

---

## 5. Os 4 lotes

Regras iguais em todos: ramo próprio a partir do `siesal-4`; proposta curta antes do código; migração só com backup e `docs/RETORNO-00NN.md`; matriz de permissões nova gera os testes; axe sem violações; medição em 360, 768 e 1280 px nos 3 temas; entrega em Feito, Falta e Sugestões; merge e push com autorização separada.

### L20a — Personalizar e Acessibilidade (tamanho M) — ramo `lote-20a-personalizar`
Vai primeiro porque é **defeito** (prioridade 1 do projeto).
1. **Cor e tema (P8):** a cor de destaque passa a mudar também o fundo suave, o menu, o painel de boas-vindas e a marca; alto contraste claro e alto contraste escuro viram temas distintos nas 2 telas e no banco; cores fixas do CSS trocadas por variáveis do tema (C1, C2, C6).
2. **Conferência de todos os controles (P8):** tabela de teste com cada controle × 3 temas × "continua depois de sair e entrar". Corrige Modo simples (C3), o texto errado (C4) e a divisão entre as 2 telas (C5). Preferências salvas na conta para os 5 perfis.
3. **Tempo das atividades personalizável (P7).**
- Migração **0018**: tema com 4 valores e minutos dos 3 blocos em `preferencia_usuario`.
- Terminou quando: os 15 controles passam na tabela de teste nos 4 temas; a cor escolhida muda menu, botões e fundos, sempre com contraste de 4,5:1; blocos próprios valem em Atividades, Agenda, Calendário e Foco.

### L20b — Disciplinas (tamanho M) — ramo `lote-20b-disciplinas`
1. **Catálogo de disciplinas** com sinônimos (P3). Lista inicial no Anexo A.
2. **Minhas disciplinas** em Personalizar: marcar do catálogo, criar própria, desativar (P3).
3. **Busca de disciplina na tarefa e na nota pessoal** (P4), com conversão dos textos antigos.
- Migração **0019**. Matriz **v13** (recursos `catalogo_disciplinas` e `disciplinas_aluno`).
- Terminou quando: digitar "port" acha "Língua Portuguesa"; digitar "poo" acha a disciplina certa; tudo funciona só com teclado; toda tarefa antiga continua mostrando a disciplina que tinha; um aluno não vê disciplina própria de outro (teste de integração).

### L20c — Aluno sem instituição (tamanho G) — ramo `lote-20c-aluno-individual`
1. **Espaço individual e isolamento** (P1): tipo de instituição, módulos por tipo, Master só com contagem, teste de isolamento entre 2 alunos individuais e entre individual e escola.
2. **Entrada** (P1): tela com as 2 opções, login sem código, cadastro por convite.
3. **Cadastro do aluno** (P2): data de nascimento, CPF protegido, escola(s) e regras de notas próprias, e a marcação de disciplinas do 20b.
- Migração **0020**. Matriz **v14**. Documentos que mudam **antes** do código: RIPD, Política de Privacidade, Modelo de Dados, Mapa de Riscos (C12).
- Terminou quando: os testes de isolamento passam; o CPF não aparece em nenhuma resposta da API, log ou linha de auditoria (teste automático que procura o valor); menor de 18 não conclui cadastro sozinho; a tela de entrada passa no leitor de tela e no teclado.
- **Ponto de controle em 20/11:** se o 20c não estiver Implementado até 21/11, para-se e decide-se cortar (seção 8).

### L20d — Dificuldade e cards de resumo (tamanho M) — ramo `lote-20d-dificuldade-cards`
1. **Dificuldade de 0 a 10** na disciplina e na tarefa (P5).
2. **Cards de resumo** com o assistente de criação (P6).
3. **Modo Revisar** e a regra de sugestão do plano (P5, P6).
- Migração **0021**. Matriz **v15** (recurso `cartoes_resumo`).
- Terminou quando: dificuldade salva e lida só pelo dono; card criado pelos 4 modelos; texto com link é recusado; Revisar funciona com teclado e com "Reduzir movimento".

---

## 6. CIDA + Rastreabilidade por lote

| Lote | Confidencialidade | Integridade | Disponibilidade | Autenticidade | Rastreabilidade |
| --- | --- | --- | --- | --- | --- |
| 20a | Preferência é do usuário, ninguém mais lê | Contraste mínimo validado na API e na tela | Se o banco falhar, vale o aparelho | Só o dono altera | Auditoria de mudança de preferência (já existe) |
| 20b | Disciplina própria só o dono vê; catálogo não tem dado pessoal | Catálogo versionado por migração; texto antigo preservado | Busca local na lista do aluno, sem serviço externo | Só o dono cria e desativa | Auditoria de criar e desativar |
| 20c | RLS separa cada espaço; CPF cifrado e mascarado; Master só vê números | Validação do CPF e da data; e-mail único entre contas individuais | Backup cobre os espaços individuais; chave do CPF com cópia segura | Convite de uso único; limitador de tentativas; mensagem de erro igual | Auditoria de cadastro, convite usado, aceite dos termos, alteração de CPF (sem o valor) |
| 20d | Dificuldade e cards só para o dono | Só texto; limites de tamanho e de quantidade | Sem serviço externo, sem IA | Só o dono cria e edita | Auditoria de criar, editar e desativar card |

---

## 7. LGPD, ECA Digital e acessibilidade (não é parecer jurídico)

1. **CPF e data de nascimento são dados pessoais novos.** O RIPD de hoje diz que o CPF não é coletado. O RIPD, a Política e o Mapa de Riscos precisam mudar antes do código do 20c.
2. **Aluno sem escola e menor de idade:** sem a escola, não há instituição respondendo pelo tratamento dos dados; a responsabilidade fica com quem opera o SIESAL. O ECA Digital (Lei 15.211/2025) está em vigor desde 17/03/2026 e trata de aferição de idade e de consentimento dos responsáveis. Por isso a proposta é: menor de 18 só tem conta individual com o Responsável no mesmo espaço. Este ponto vai para o parecer jurídico.
3. **Parte 1 continua só com dados fictícios.** CPF de teste é gerado, nunca o de uma pessoa real.
4. **Dificuldade de 0 a 10** não é diagnóstico e não gera comparação entre alunos (regra do projeto).
5. Texto a usar: "projetado para atender" LGPD, ECA Digital, WCAG 2.2 AA e eMAG.

---

## 8. Calendário (estimativa, não promessa)

| Etapa | Datas | Quem |
| --- | --- | --- |
| L20a | 11/11 e 12/11 | Code |
| L20b | 13/11 a 15/11 | Code |
| L20c | 16/11 a 21/11 (ponto de controle: 20/11) | Code, com as decisões do proprietário |
| L20d | 22/11 a 25/11 | Code |
| Checagem humana de L16 a L20d e ajustes do NAPNE | 26/11 a 01/12 (ponto de controle: 01/12) | Proprietário e Code |
| Folga para correções | 01/12 a 10/12 | — |

**Se o prazo apertar, a ordem de corte é:** 1º Modo Revisar e a regra de sugestão (20d, item 3); 2º cards de resumo (20d, item 2); 3º regras de notas próprias do aluno individual (parte do 20c, item 3). O 20a e o 20b não se cortam.

---

## 9. Decisões que dependem do proprietário (uma por vez, na proposta curta de cada lote)

| # | Decisão | Opção recomendada | Outra opção | Lote |
| --- | --- | --- | --- | --- |
| D1 | Como guardar o aluno sem escola | Espaço individual (uma "instituição" do tipo individual por aluno) | Espaço único para todos, com RLS nova por dono | 20c |
| D2 | CPF | Campo existe, validado e cifrado, **opcional** na Parte 1 e só com CPF de teste; vira obrigatório quando houver escola real e parecer jurídico | Obrigatório já na Parte 1 | 20c |
| D3 | Menor de 18 sem escola | Conta só com o Responsável no mesmo espaço (o convite vai para o Responsável) | Bloquear menor de 18 no modo individual até a Parte 2 | 20c |
| D4 | Cadastro individual | Por convite gerado pelo Master, na Parte 1 | Cadastro aberto a qualquer pessoa | 20c |
| D5 | Quem vê a dificuldade | Só o aluno | Aluno e Pedagógico, se o aluno autorizar | 20d |
| D6 | Lista do IFRN | Começar com formação geral e os 3 cursos integrados de Canguaretama; completar com os PPCs oficiais que o professor indicar | Esperar a lista completa antes do 20b | 20b |

**Discordância registrada (D2):** exigir CPF agora contraria o RIPD atual e o princípio de coletar o mínimo, e a Parte 1 só tem dado fictício. Alternativa: deixar o campo pronto e protegido, mas opcional. A decisão final é do proprietário.

---

## 10. O que NÃO entra nestes lotes
- IA para gerar cards ou resumos (decisão vigente: sem IA integrada).
- Migrar dados de "sem escola" para uma escola, e o contrário (Parte 2).
- Cadastro aberto com confirmação por e-mail real (Parte 2).
- Importar disciplinas do SUAP (Parte 2).
- Compartilhar cards entre alunos.

---

## Anexo A — Catálogo inicial de disciplinas (versão 1, a validar)

Legenda: **[BNCC]** componente da Base Nacional; **[IFRN-conf]** nome confirmado em página de docente do IFRN em 10/11/2026; **[validar]** nome escrito de memória, precisa ser conferido no PPC oficial antes de entrar na migração.

**A.1 Ensino Fundamental, anos finais (6º ao 9º) [BNCC]**
Língua Portuguesa · Arte · Educação Física · Língua Inglesa · Matemática · Ciências · Geografia · História · Ensino Religioso.
Comuns nas redes [validar]: Língua Espanhola · Redação · Projeto de Vida · Computação.

**A.2 Ensino Médio, formação geral**
Língua Portuguesa · Literatura · Redação · Língua Inglesa · Língua Espanhola · Arte · Educação Física · Matemática · Física · Química · Biologia · História · Geografia · Filosofia · Sociologia · Projeto de Vida · Eletiva / Itinerário formativo.

**A.3 IFRN, técnico integrado — núcleo comum [validar]**
Língua Portuguesa e Literatura · Inglês · Espanhol · Arte · Educação Física · Geografia · História · Filosofia · Sociologia · Matemática · Física · Química · Biologia · Informática [IFRN-conf] · Filosofia, Ciência e Tecnologia · Sociologia do Trabalho · Qualidade de Vida e Trabalho · Gestão Organizacional · Projeto Integrador · Prática Profissional.

**A.4 IFRN, Técnico em Informática [IFRN-conf, exceto onde marcado]**
Fundamentos de Lógica e Algoritmos · Programação Estruturada e Orientada a Objetos · Programação com Acesso a Banco de Dados · Autoria Web · Programação para Internet · Projeto de Desenvolvimento de Software · Arquitetura de Redes de Computadores e Tecnologia de Implementação de Redes · Fundamentos de Sistemas Operacionais e Sistemas Operacionais de Redes · Eletricidade Instrumental · Eletrônica Analógica e Digital · Organização e Manutenção de Computadores · Banco de Dados [validar].

**A.5 IFRN, Técnico em Eletromecânica [validar tudo]**
Desenho Técnico · Desenho Assistido por Computador · Eletricidade Básica · Circuitos Elétricos · Eletrônica · Instalações Elétricas · Máquinas Elétricas · Comandos Elétricos · Metrologia · Materiais e Tecnologia Mecânica · Elementos de Máquinas · Processos de Fabricação · Soldagem · Hidráulica e Pneumática · Automação Industrial · Manutenção Industrial · Higiene e Segurança do Trabalho.

**A.6 IFRN, Técnico em Eventos [validar tudo]**
Fundamentos do Turismo e da Hospitalidade · Planejamento e Organização de Eventos · Cerimonial, Protocolo e Etiqueta · Marketing · Alimentos e Bebidas · Recreação e Lazer · Captação de Recursos · Gestão de Pessoas · Empreendedorismo · Projeto de Eventos.

**A.7 Sinônimos iniciais**
Português → Língua Portuguesa · Inglês → Língua Inglesa · Espanhol → Língua Espanhola · Artes → Arte · Ed. Física → Educação Física · FLA → Fundamentos de Lógica e Algoritmos · POO → Programação Estruturada e Orientada a Objetos · Redes → Arquitetura de Redes de Computadores e Tecnologia de Implementação de Redes · SO → Fundamentos de Sistemas Operacionais e Sistemas Operacionais de Redes.

**Limite do Anexo A:** o IFRN tem mais de 30 cursos técnicos integrados. "Todas as disciplinas do IFRN" só é possível com os PPCs oficiais de cada curso. A versão 1 cobre a formação geral e os 3 cursos integrados do campus Canguaretama (Informática, Eletromecânica e Eventos). Outros cursos entram como versão 2 do catálogo, por migração, sem mexer no que o aluno já marcou.

---

## Fontes consultadas em 10/11/2026
- Cursos do campus Canguaretama: https://www.escol.as/273205-ifrn-campus-canguaretama e https://portal.ifrn.edu.br/documents/17195/Chamada_08_2024_atividade_em_cada_campus.pdf
- Disciplinas do Técnico Integrado em Informática do IFRN: https://docentes.ifrn.edu.br/andrealmeida/disciplinas/2012.2/cursos-fic-introducao-a-programacao/aula-01-informatica-e-a-programacao e https://docentes.ifrn.edu.br/thiagomedeiros/disciplinas/informatica-basica/ementa
- Componentes da BNCC no Ensino Fundamental: https://www.recantodasletras.com.br/ensaios/7430299
- ECA Digital, vigência e regulamentação: https://agenciagov.ebc.com.br/noticias/202608/eca-digital-conheca-as-regras-de-protecao-de-criancas-e-adolescentes-no-ambiente-online e https://www.bmalaw.com.br/conteudo/direito-digital-protecao-de-dados-e-cybersecurity/informativos-e-newsletters/eca-digital-e-sua-regulamentacao-entram-em-vigor/pdf

---

## Feito, Falta, Sugestões
**Feito:** leitura do git, das 17 migrações, das telas de Personalizar, Acessibilidade, Login e Atividades, da matriz v12 e dos registros; 12 achados (seção 3); projeto dos 4 lotes; catálogo inicial.
**Falta:** aprovação do proprietário; registro A-046 pelo Code; confirmar os achados C1 a C6 no navegador (primeiro passo do 20a); validar o Anexo A com o professor; respostas D1 a D6, cada uma no seu lote.
**Sugestões:** levar o Anexo A e a decisão D2 (CPF) ao professor e ao NAPNE em 12/11/2026; começar pelo 20a, que não depende de nenhuma decisão pendente.
