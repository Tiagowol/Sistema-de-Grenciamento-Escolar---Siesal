# VERIFICAÇÃO DO 20c-1 — Espaço individual e entrada (11/11/2026)

Estado do lote: **Implementado em parte** (itens 1 e 2). O item 3 (cadastro por convite) está parado até a resposta da D4. A 0020 e a API nova **não** foram aplicadas no site.

## 1. O que foi conferido por máquina
| Verificação | Resultado |
| --- | --- |
| Lint (biome) | 0 erros, 1 aviso antigo |
| Tipos (api, web, shared) | sem erro |
| Testes unitários | 1018 passando (inclui axe na tela de entrada) |
| Testes de integração (banco temporário, com a 0020) | 276 passando, 18 novos |
| Erro não tratado do vitest | o mesmo da F-053, já existia |

## 2. Critérios de "terminou quando" (`PLANO-L20C.md`, 20c-1)
| Critério | Como foi conferido |
| --- | --- |
| Isolamento nos 3 sentidos (individual A x B; individual x escola; escola x individual) | teste de integração, na API e direto no banco com `withTenant`: usuários, tarefas e a própria instituição |
| O Master não vê nome, e-mail nem conteúdo | teste: o painel não traz id, nome, e-mail nem "Espaço individual"; só o número; o Master recebe 404 ao mudar situação ou módulo de espaço individual |
| Mensagem de erro igual | teste: e-mail desconhecido e senha errada dão o mesmo status e o mesmo corpo. **Não foi medido o tempo de resposta** (a API gasta uma verificação de senha falsa nos dois casos) |
| Tela de entrada no axe | teste de tela, sem violações |
| Tela de entrada no leitor de tela, no teclado e em 360, 768 e 1280 px | **não conferido** (a 0020 não está no site) |
| E-mail único entre contas individuais | teste: segunda conta com o mesmo e-mail (mesmo em maiúsculas) é recusada pelo banco; trocar o e-mail e inativar a conta atualizam o índice |
| Encerrar a conta encerra o espaço | teste: conta inativa sai do índice, não entra mais e a contagem do Master diminui |

## 3. Correção de defeito no caminho (F-054)
A conversão de disciplinas da 0019 não rodou no site (RLS). Passou a ser feita pela API; teste de integração com texto antigo e limite de 20. **Isto só vale no site depois de aplicar a 0020 e a API.** Texto completo em `docs/REGISTRO-DE-FALHAS.md`.

## 4. O que NÃO foi feito
1. Item 3: cadastro por convite e botão "Criar conta" (D4 pendente).
2. Aplicar a 0020 e a API no site; ver a tela de entrada e o menu do espaço individual no navegador; medir em 360, 768 e 1280 px.
3. Criar um espaço individual pela própria pessoa. Hoje só por script ou teste.
4. Leitor de tela, teclado completo, NAPNE e parecer jurídico.

## 5. Como voltar atrás
- Código: o ramo `lote-20c1-espaco-individual` não altera os anteriores.
- Banco: a 0020 não está no site. Depois de aplicada, `docs/RETORNO-0020.md`.

## Feito, Falta, Sugestões
**Feito:** itens 1 e 2 do 20c-1 no código; 18 testes de integração e 6 de tela novos; correção da conversão de disciplinas; registros A-053, A-054 e F-054.
**Falta:** D4 e o item 3; aplicar a 0020 e a API (backup, aviso, F-052); conferir as telas; checagem humana.
**Sugestões:** aplicar a 0020 logo, porque corrige a F-054 no site.
