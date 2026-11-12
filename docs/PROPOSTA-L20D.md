# Proposta — Lote 20d (dificuldade, cards de resumo e grade do dia)

Passo 2 do ciclo. **Nada foi codado.** Só dados fictícios. Base: `PLANO-L20A-A-L20D.md` (seções 4.5 e 4.6), `ADENDO-1` (seção 4, grade do dia) e as decisões do autor de 12/11/2026 (A-064, A-065, A-066). Onde divergem, valem o Adendo 1 e as decisões do autor.

## 1. Finalidade da dificuldade (decisão do autor, A-066)
A nota de dificuldade (0 a 10) é um **pedido do NAPNE**. O Apoio Pedagógico acompanha o aluno e usa o número para ajudá-lo e saber onde ele tem dificuldade. Por isso o Pedagógico/NAPNE **vê a nota sem o aluno pedir** (D5 = opção 2). Continua valendo: a nota é a percepção do aluno, não é avaliação, não é diagnóstico, nunca vira ranking, média de turma nem comparação entre alunos.

## 2. Estado anterior (lido em 12/11/2026)
- `tarefa` e `disciplina_aluno` não têm coluna de dificuldade.
- Não existe tabela de cards.
- O calendário só lista os eventos do dia. A tabela `evento` já tem `dia`, `hora_inicio`, `minutos` e `tarefa_id`.
- Migrações até a 0022. Matriz em v17.
- O Pedagógico lê dados da instituição inteira em outros recursos (por exemplo notas oficiais).

## 3. O que será feito (3 itens)
1. **Dificuldade de 0 a 10**
   - Campo opcional na disciplina do aluno e na tarefa. Tela com 11 posições e palavras nas pontas e no meio (0 "muito fácil", 5 "média", 10 "extremamente difícil"). Nunca só número.
   - Regra de sugestão (sem IA): tarefa com dificuldade 7 ou mais faz o plano sugerir começar antes e usar blocos menores. O aluno aceita ou recusa.
   - **Visão da equipe:** o Pedagógico/NAPNE abre **um aluno por vez** e vê as dificuldades dele. Não existe lista com valores de vários alunos, média, ordenação por dificuldade nem comparação. Cada leitura pela equipe gera auditoria ("dificuldade.lida", sem o valor).
   - **Transparência (proposta do Code, você aprova ou recusa):** onde o aluno marca a nota, aparece em texto literal: "A equipe de apoio pedagógico vê esta nota para ajudar você. Ela não é uma nota de prova."
2. **Cards de resumo e modo Revisar**
   - Cartão com título, frente e verso, só texto (sem link, sem HTML), ligado a uma tarefa ou a uma disciplina. Limite de 20 por tarefa (e de 20 por disciplina, premissa do Code).
   - Assistente de criação em 3 passos, 4 modelos (Conceito, Passo a passo, Fórmula, Pergunta e resposta), contador de letras, sem IA.
   - Modo Revisar: um card por vez, botão "Ver o resumo", teclado, sem animação com "Reduzir movimento".
   - Só o dono vê (a equipe **não** vê os cards). Faz parte do módulo "apoio ao aluno".
3. **Grade do dia** (Adendo 1, seção 4): clicar no dia abre as horas de 06:00 a 23:00 em 3 grupos com nome e ícone (Manhã, Tarde, Noite); clicar numa hora abre o formulário com dia e hora; escolher evento novo ou tarefa existente; duração em blocos; a lista simples continua disponível. Sem migração.

## 4. Arquivos e migração
- **Migração 0023** (a 0021 e a 0022 já foram usadas): colunas `dificuldade smallint` (0 a 10, opcional) em `tarefa` e `disciplina_aluno`; tabela `cartao_resumo` com RLS forçada e limite no banco. Retorno em `docs/RETORNO-0023.md`. Backup antes, só pelo job `migrate`.
- **Matriz v18:** `dificuldade` (ler: aluno próprio e Pedagógico da instituição; administrar: só o aluno próprio) e `cartoes_resumo` (administrar e ler: só o aluno próprio). Os testes são gerados da matriz.
- API: rotas de dificuldade, de cards e a leitura por aluno para o Pedagógico, com auditoria.
- Web: seletor de 11 posições, tela de cards e Revisar, tela do Pedagógico, grade do dia, regra de sugestão no plano.
- Espaço individual: não tem Pedagógico, então a dificuldade fica só com o aluno; os cards seguem a regra do módulo.

## 5. Privacidade (antes de qualquer dado real)
Lista em `docs/MUDANCAS-PRIVACIDADE-L20D.md`. A nota passa a ser dado visto pela equipe e o aluno é menor de idade: base legal e parecer jurídico ficam pendentes.

## 6. Validação
Lint, tipos e testes no Docker. Testes novos: aluno lê e grava só a própria nota; Pedagógico lê por aluno e a leitura gera auditoria sem o valor; Professor, Admin, Responsável e outro aluno não leem; nenhuma rota devolve valores de vários alunos; card com link é recusado; limite de 20; Revisar com teclado e "Reduzir movimento"; grade passa no axe. Telas em 360, 768 e 1280 px. "Verificado" só depois da sua checagem humana.

## 7. Ordem de corte se o prazo apertar (do plano)
1º Modo Revisar e a regra de sugestão; 2º cards de resumo. A dificuldade com a visão da equipe não se corta.

## 8. Premissas a confirmar
1. O Pedagógico lê por escopo "instituição" (mesmo padrão de outros recursos dele). Só o Pedagógico: o Admin e o Professor não leem.
2. O texto de transparência do item 1.
3. O limite de 20 cards também por disciplina.
