# VERIFICAÇÃO DO L20b — Disciplinas (11/11/2026)

Estado do lote: **Implementado**, não "Verificado". A migração 0019 e a API nova foram aplicadas no site em 11/11/2026 (A-052) e as telas foram vistas no navegador contra a API real.

## 1. O que foi conferido por máquina
| Verificação | Resultado |
| --- | --- |
| Lint (biome) | 0 erros, 1 aviso antigo (`api/src/conta/rotas.ts:386`) |
| Tipos (api, web, shared) | sem erro |
| Testes unitários | 999 passando (inclui axe na caixa de busca e em Minhas disciplinas) |
| Testes de integração (banco temporário, com a 0019) | 258 passando, 17 novos de disciplinas |
| Erro não tratado do vitest | o mesmo da F-053, já existia |

## 2. Critérios de "terminou quando" (A-050 e `PLANO-L20B.md`)
| # | Critério | Como foi conferido |
| --- | --- | --- |
| 1 | "port" acha "Língua Portuguesa"; "poo" acha a disciplina certa | teste de tela (caixa de busca) e regra `casa()` |
| 2 | só com teclado e axe | teste: setas, Enter, Esc; axe sem violações. **Falta** leitor de tela real |
| 3 | tarefa e nota antigas mantêm a disciplina | a 0019 não altera o texto; teste de integração: texto livre continua aceito e as tarefas mostram o nome mesmo com a disciplina desativada. **A conversão dos dados antigos só foi exercida em banco vazio** |
| 4 | aluno não vê nem altera a de outro | teste de integração (404 ao alterar, lista própria, RLS direto no banco) |
| 5 | o banco recusa a 21ª própria | teste de integração com `INSERT` direto |
| 6 | 360, 768 e 1280 px, 4 temas, alvos de 44 px | medido em tela em 360 e 1280 px, tema escuro: sem rolagem horizontal (360 de 360), opções, campos e botões com 44 px. **Não medido:** 768 px e os outros 3 temas |
| 7 | catálogo só com o confirmado (D6) | teste de integração: "Banco de Dados" e "Desenho Técnico" não estão no catálogo |

## 3. Decisões de execução (A-051)
1. As rotas se chamam `/minhas-disciplinas` (o `/disciplinas` já é do cadastro de turmas, L14).
2. Disciplinas da escola entram por um botão ("Trazer as disciplinas da minha turma"), com origem "escola". Não entram sozinhas, para o aluno decidir. Não contam no limite de 20.
3. A etapa do aluno fica em `preferencia_usuario.etapa_disciplinas`.
4. Corrigir o nome de uma disciplina própria atualiza as tarefas e notas ligadas a ela.
5. Catálogo v1: 14 componentes da BNCC e da LDB e 12 do Técnico em Informática (IFRN), com sinônimos Português, Inglês, Artes, FLA, POO, Redes e SO. Fora: o que o Anexo A marca "[validar]", Literatura, Redação, Espanhol, Projeto de Vida e Eletiva.
6. Matriz **v14**: `catalogo_disciplinas` (ler) e `disciplinas_aluno` (administrar), só aluno.

## 4. O que NÃO foi feito
1. Medir 768 px e os temas claro e alto contraste em tela.
2. A conversão dos dados antigos continua só exercida em banco vazio (o site não tinha disciplina em texto).
3. Os 10 campos no cadastro do aluno (é do L20c; no L20b ficam em Personalizar).
4. Leitor de tela, teclado completo e NAPNE.
5. Catálogo versão 2 (itens "[validar]" e cursos de Eletromecânica e Eventos): depende do professor.

## 5. Como voltar atrás
- Código: o ramo `lote-20b-disciplinas` não altera `lote-20a-personalizar` nem `siesal-4`.
- Banco: a 0019 não está no site. Depois de aplicada, `docs/RETORNO-0019.md`.

## Feito, Falta, Sugestões
**Feito:** os 3 itens do L20b no código; 17 testes de integração e 10 de tela novos; registros A-050 e A-051.
**Falta:** medir 768 px e os outros temas; checagem humana; "aprovo" para merge.
**Sugestões:** levar o Anexo A ao professor em 12/11/2026 para a versão 2 do catálogo.
