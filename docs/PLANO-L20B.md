# PROPOSTA CURTA — LOTE L20b (Disciplinas) — SIESAL 4.0

Data: 11/11/2026. Estado: **Planejado. NÃO aprovado.** Nenhum ramo, código, migração ou commit do L20b.
Base: `lote-20a-personalizar` em `007b8e4` (0018 aplicada no site). Complementa `PLANO-L20A-A-L20D.md` (seção 4.4 e Anexo A), `ADENDO-1` (seção 5) e `ADENDO-2` (seção 4). Onde divergirem, vale o mais novo.
Ramo previsto: `lote-20b-disciplinas`, a partir do ramo do L20a (ou de `siesal-4`, se o L20a já tiver merge). Migração prevista: **0019**. Matriz: **v14** (o L20a usou a v13, A-048).

## 1. Resultado em 3 linhas
1. O aluno passa a escolher a disciplina em uma lista com busca (digitar "port" acha "Língua Portuguesa"), na tarefa e na nota pessoal.
2. Cada aluno tem as suas disciplinas (marcadas do catálogo, mais até 20 próprias), gerenciadas em Personalizar.
3. Tarefas e notas antigas mantêm o texto que tinham. Nada se apaga.

## 2. Fatos lidos no código (11/11/2026)
| # | Fato | Onde |
| --- | --- | --- |
| F1 | A disciplina da tarefa e da nota pessoal é texto livre, até 80 letras | `tarefa.disciplina`, `nota_pessoal.disciplina`, `api/src/nucleo/rotas.ts` |
| F2 | Já existe uma tabela `disciplina` das turmas da escola (L14). **Não é a mesma coisa**; os nomes novos evitam o conflito | `api/migracoes/0007_turmas.sql` |
| F3 | O campo é digitado em `Atividades.tsx` (criar tarefa) e `Notas.tsx` (nota pessoal) | `web/src/paginas/` |
| F4 | Na tela de cadastro do aluno (10 campos para disciplinas próprias) ainda não existe: o cadastro é do L20c. No L20b os 10 campos ficam em Personalizar | Adendo 1, seção 5 |

## 3. Itens do lote

### Item 1 — Catálogo de disciplinas
- Tabela global `disciplina_catalogo`: nome, nome sem acento (para busca), etapa (fundamental final, médio, técnico integrado), curso, sinônimos, `origem` e `codigo_externo` (preparo do SUAP, vazios).
- Só leitura para o sistema, sem dado pessoal, versionada por migração (versão 1 = Anexo A).
- Sinônimos apontam para uma disciplina só (Português = Língua Portuguesa; POO = Programação Estruturada e Orientada a Objetos).
- As gerais já vêm **marcadas** conforme a etapa do aluno (Adendo 1, seção 5): Língua Portuguesa, Matemática, História, Geografia, Ciências (ou Física, Química e Biologia), Língua Inglesa, Arte, Educação Física. O aluno desmarca.
- **Etapa do aluno:** hoje o sistema não guarda a etapa (isso entra no cadastro, 20c). No L20b o aluno escolhe a etapa em Minhas disciplinas, com uma pergunta e 3 opções. Aluno de escola: as disciplinas das turmas dele entram marcadas sozinhas (4.4 do plano).

### Item 2 — Minhas disciplinas (em Personalizar)
- Tabela `disciplina_aluno` (dono, nome, `catalogo_id` opcional, `origem` = catalogo | propria | suap, `codigo_externo`, `desativado_em`). RLS por instituição; filtro por dono na API; teste de isolamento entre alunos.
- **10 campos** para disciplina própria e **máximo de 20 próprias** por aluno; as marcadas do catálogo não contam (leitura adotada do Adendo 1; me avise se o limite de 20 for para o total). O limite fica no **banco** (gatilho) e na API, não só na tela.
- O aluno corrige o nome das próprias, desativa e acrescenta. Nome repetido (sem diferença de maiúscula e acento) é recusado com mensagem literal.
- Texto sem link e sem e-mail (mesma regra do apelido).

### Item 3 — Busca de disciplina na tarefa e na nota pessoal
- O campo de texto vira caixa de busca acessível (padrão WAI-ARIA combobox): digitar as iniciais filtra; acento e maiúscula não importam; teclado e leitor de tela; alvo de 44 px.
- Última opção da lista: "Criar a disciplina …", que salva em Minhas disciplinas.
- **Dados antigos:** a coluna de texto fica. A 0019 cria uma disciplina do aluno para cada texto já usado (origem "propria", sem passar do limite de 20: se passar, os textos extras continuam só como texto) e liga `disciplina_aluno_id` (nulo permitido) em `tarefa` e `nota_pessoal`. Tarefa antiga continua mostrando o que tinha.
- A média por disciplina das notas pessoais continua agrupando pelo texto/disciplina, sem comparação entre alunos.

## 4. Banco e permissões
- **Migração 0019** (só pelo job `migrate`, com backup antes e aviso de 1 linha): cria `disciplina_catalogo` e `disciplina_aluno`, acrescenta `disciplina_aluno_id` em `tarefa` e `nota_pessoal`, carrega o catálogo v1.
- **Retorno:** `docs/RETORNO-0019.md`, escrito antes de aplicar.
- **Matriz v14:** recursos `catalogo_disciplinas` (ler: aluno) e `disciplinas_aluno` (administrar: aluno, escopo "proprio"); gera testes e entra na coerência com a política da API.
- **Reconstrução da API:** exige o procedimento da F-052 (certificado do Norton).

## 5. CIDA + Rastreabilidade
| Confidencialidade | Integridade | Disponibilidade | Autenticidade | Rastreabilidade |
| --- | --- | --- | --- | --- |
| Disciplina própria só o dono vê; catálogo não tem dado pessoal | Catálogo versionado por migração; texto antigo preservado; limite de 20 no banco | Busca local, sem serviço externo | Só o dono cria, corrige e desativa | Auditoria de criar, corrigir e desativar disciplina |

## 6. Terminou quando
1. Digitar "port" acha "Língua Portuguesa" e "poo" acha a disciplina certa.
2. Tudo funciona só com teclado e passa no axe.
3. Toda tarefa e nota antiga continua mostrando a disciplina que tinha.
4. Um aluno não vê nem altera a disciplina de outro (teste de integração).
5. O banco recusa a 21ª disciplina própria.
6. Lint, tipos e testes passam; medido em 360, 768 e 1280 px, sem rolagem horizontal, alvos de 44 px, nos 4 temas.
7. Estado ao entregar: **Implementado**, nunca "Verificado" sem a checagem humana.

## 7. Fora do lote
Cadastro do aluno com etapa e escola (20c); dificuldade de 0 a 10 (20d); importar disciplinas do SUAP (Parte 2); disciplinas dos 30+ cursos técnicos do IFRN além dos 3 de Canguaretama.

## 8. Decisão pendente (D6)
O Anexo A marca o que está confirmado e o que foi escrito de memória. **Qual lista entra na 0019?**
1. **Recomendado:** só o confirmado (BNCC e nomes confirmados de Informática do IFRN). O resto entra na versão 2 do catálogo, por migração, depois que o professor indicar os PPCs. O aluno cria o que faltar como disciplina própria.
2. Tudo do Anexo A, incluindo o "[validar]", com a marcação de que o nome ainda precisa de conferência.

## 9. Pedido de aprovação
Para começar: **"aprovo o L20b"** e a resposta da D6. Sem isso, nenhum ramo e nenhum código.

## Feito, Falta, Sugestões
**Feito:** leitura do código; proposta dos 3 itens; plano de banco, matriz, retorno e testes.
**Falta:** "aprovo o L20b"; resposta da D6; "aprovo" da divisão dos lotes 20a a 20d (A-046 ainda pede); validar o Anexo A com o professor.
**Sugestões:** levar o Anexo A ao professor e ao NAPNE em 12/11/2026.
