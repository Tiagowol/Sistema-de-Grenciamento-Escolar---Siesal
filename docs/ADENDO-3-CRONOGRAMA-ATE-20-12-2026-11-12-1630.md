# ADENDO 3 — CRONOGRAMA COMPLETO ATÉ 20/12/2026 — SIESAL 4.0 (12/11/2026, 16:30)

Complementa o plano de fechamento e os Adendos 1 e 2. **Substitui a seção 5 do plano (ordem e datas).** Estado: **Planejado**. O Adendo 4 junta alguns lotes e manda o Norton para o fim.

## 1. Decisões do proprietário (chat de 12/11/2026, 15:26)

1. **Entra tudo:** os 5 lotes do núcleo de apoio (L27a a L27e) e todos os lotes do plano.
2. **Entrega em 20/12/2026.** Antes era 10/12. Registrado como o proprietário escreveu. Se a data com o professor continua 10/12, o cronograma muda.
3. **SIGEduc fica por último**, só se sobrar tempo. Vira o lote L26d. O L26b passa a ser só o SUAP.

## 2. Lista de lotes

| Lote | Conteúdo |
| --- | --- |
| G0 | Registro: documentos no GitHub, diário, `CLAUDE.md` (aprovado) |
| L21a | HSTS, teste de injeção de SQL, causa do F-056 |
| L21c | Restauração de backup em banco limpo, convites fora de `backups/` |
| L21b | Calendário: grade e lista, escolha do aluno |
| L22a-1 | Pessoa, participação em vários espaços, conta do Responsável |
| L22a-2 | Acompanhamento por e-mail e por código; tela "Quem pode ver meus dados" |
| L26a | Base das integrações: conexões, chaves de ligar, conector fictício |
| L22b | Árvore cadastral do Master, menu, indicador teste/produção |
| L22c | Admin cria e desativa; revogar convite; manual por destinatário |
| L27a | Guias de atividade (fichamento, redação, estudar para prova e outros) |
| L27b | Cards com pergunta, revisão espaçada, "transformar em cards" |
| L27c | Plano "quando… então…", "só o primeiro passo", fechamento do dia |
| L27d | Rotina de estudo e checagem de foco |
| L23a | Autenticação por papel e código por e-mail como 2º fator |
| L27e | Encontro de acompanhamento e resumo semanal do Responsável |
| L26b | Conector SUAP (desligado até o IFRN cadastrar a aplicação) |
| L26c | Conectores Google Agenda e Sala de Aula (desligados; teste com a conta de demonstração) |
| L25 | RIPD, Política, Mapa de Riscos e texto do aceite de abertura de conta |
| L23b | Modo demonstração |
| L24 | Verificação humana, em 4 sessões |
| L26d | SIGEduc e Norton: só se sobrar tempo |
| Fechamento | Restauração final, relatório de evidências do TCC, merge final |

## 3. Cronograma (estimativa, não medida)

| Semana | Lotes | O que depende do proprietário |
| --- | --- | --- |
| 1 — 12/11 a 15/11 | G0, L21a, L21c, L21b | — |
| 2 — 16/11 a 22/11 | L22a-1, L22a-2 | Decisões do L22a; **1ª checagem humana até 20/11** (L16 a L20d) |
| **20/11** | **Ponto de controle** | |
| 3 — 23/11 a 29/11 | L26a, L22b, L22c, L27a | Professor e NAPNE revisarem os textos dos guias |
| 4 — 30/11 a 06/12 | L27b, L27c, L27d, L23a | **2ª checagem até 01/12** (L21 e L22); pedir ao IFRN o cadastro no SUAP |
| **01/12** | **Ponto de controle** | |
| 5 — 07/12 a 13/12 | L27e, L26b, L26c, L25 | **3ª checagem até 10/12** (L26a, L27a a L27d, L23a) |
| **10/12** | **Ponto de controle: decide se o L23b entra** | |
| 6 — 14/12 a 20/12 | L23b; L26d se sobrar; fechamento de 18/12 a 20/12 | **4ª checagem até 17/12**; autorizar o merge final |

**Código novo só até 16/12.** De 17/12 a 20/12: só correção, checagem e fechamento.

## 4. O que limita o prazo

- **[fato]** O ritmo recente do Code foi de 1 a 2 lotes por dia (20c-2 e 20d em 12/11).
- **[estimativa]** O limite não é o código. São 3 coisas que dependem de pessoas: a aprovação de cada lote, as 4 checagens humanas e a revisão dos textos pelo professor e pelo NAPNE.
- **[fato]** O L22a-1 muda a base de quem é quem no sistema. Se ele atrasar, atrasam L22a-2, L26a, L22b, L22c e L27e.

## 5. Ordem de corte, se atrasar (cada passo só com decisão do proprietário)

1. L26d (SIGEduc e Norton).
2. L23b (demonstração).
3. L26c (Google).
4. L26b (SUAP).
5. Segundo item do L23a (código por e-mail).

**Nunca cortar:** L21a, L21c, L22a-1, L22a-2, L27a, L27b, L24, L25 e o fechamento.

## 6. Regras que continuam valendo

- Um lote por vez, de 1 a 3 itens, com proposta e aprovação próprias.
- Migração só pelo job `migrate`, com backup antes e retorno escrito.
- Só dados fictícios. Conectores desligados até haver autorização de terceiros.
- Toda sessão termina com diário em `docs/diario/` e cópia no Projeto.
- Nenhum lote vira "Verificado" sem a checagem humana.

## 7. Feito, Falta, Sugestões

**Feito:** decisões registradas; lista de lotes; cronograma em 6 semanas com 4 checagens e 3 pontos de controle; ordem de corte.
**Falta:** confirmar que 20/12 vale também para o professor; reservar as 4 datas de checagem (20/11, 01/12, 10/12, 17/12).
**Sugestões:** pedir ao IFRN, nesta semana, o cadastro da aplicação no SUAP; entregar ao NAPNE as propostas do Adendo 2 até 20/11.
