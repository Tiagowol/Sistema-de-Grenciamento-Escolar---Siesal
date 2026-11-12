# ADENDO 4 — APROVAÇÕES, JUNÇÃO DE LOTES E RITMO — SIESAL 4.0 (12/11/2026, 17:00)

Complementa o plano de fechamento e os Adendos 1 a 3. Estado: **Planejado**.

## 1. Decisões do proprietário (chat de 12/11/2026, 15:32 e 15:33)

1. **"Aprovo tudo, menos o Norton."** Como o Claude entendeu:
   - Aprovado o cronograma do Adendo 3.
   - Aprovada a execução do L21a, do L21c (sem o item do Norton) e do L21b.
   - Os lotes seguintes continuam com proposta escrita antes do código; basta um "ok proposta" para cada um. Motivo: mexem em banco e em dados de menores.
   - Commit de código, merge e deploy continuam com autorização separada.
2. **Norton (F-052)** vai para o fim, junto com o SIGEduc. Até lá o contorno manual continua.
3. **Texto na tela de integração do SUAP:** informar que o SUAP não é a única integração e que não vamos parar nele, sem prometer data nem resultado (seção 3).
4. **Juntar lotes pequenos** fica a critério do Claude (seção 2).
5. **Termos de aceite** para cada pessoa envolvida: `TERMOS-DE-ACEITE-MINUTA-v0.1-2026-11-12.md`.
6. **Regra nova: aluno maior pode indicar um Responsável.** Mesmo com 18 anos ou mais, o aluno pode deixar uma pessoa como Responsável. O proprietário considera isso importante. Entra no L22a-1. O perfil Responsável passa a ter 2 tipos: **legal** (aluno menor) e **indicado** (aluno maior; o aluno pode retirar).

## 2. Junção de lotes

| Junção | Itens | Motivo |
| --- | --- | --- |
| L21c + L21b, executados juntos | restauração de backup; convites fora de `backups/`; calendário grade/lista | L21c ficou com 2 itens sem o Norton |
| L26b + L26c, num lote só (L26b) | SUAP; Google Agenda; Google Sala de Aula | 3 conectores sobre a mesma base |
| L26d (final, se sobrar tempo) | SIGEduc; Norton | decisão do proprietário |

Não foram juntados L22a-1, L22a-2, L26a, L23a nem L23b: mexem em banco e em regra de acesso. L27c e L27d não foram juntados: somariam 4 itens (a regra é de 1 a 3).

**Total: 17 lotes**, mais o G0, as 4 checagens e o fechamento.

## 3. Texto para a tela de integrações (proposta)

Título: **Integrações**

"Hoje o SIESAL está preparado para se ligar ao SUAP do IFRN. O SUAP não é a única integração que queremos: vamos tentar outras. Ainda não há data e não há garantia de quais vão funcionar, porque dependem da autorização de cada sistema."

## 4. Quantos lotes por dia

**Resposta: 3 por dia não é necessário e não é recomendado.**

- **[fato]** São 17 lotes em 38 dias. A média necessária é menos de 1 lote a cada 2 dias.
- **Recomendação:** no máximo **2 por dia** nos lotes pequenos e **1 por dia** nos lotes grandes (L22a-1, L22a-2, L26a, L23a, L23b). Em dia de lote grande, nenhum outro.
- **Motivo:** cada lote precisa de conferência depois de aplicado. Com 3 por dia, a conferência acumula e um defeito do primeiro lote só aparece depois de outros 2 construídos em cima dele.
- **[estimativa]** Nesse ritmo, o código termina por volta de 05/12 e sobram cerca de 10 dias de folga antes de 16/12.

O que cada lote exige do proprietário, em ordem:
1. Ler a proposta e responder "ok proposta" (ou pedir mudança).
2. Autorizar "aplicar no site" depois dos testes.
3. Abrir o site e conferir os pontos listados na entrega.
4. Autorizar o commit de código.
- Terminou quando: os 4 passos têm resposta registrada no diário.

## 5. Feito, Falta, Sugestões

**Feito:** aprovações registradas; lotes juntados (17); texto da tela de integrações; ritmo recomendado; minuta dos 6 termos de aceite.
**Falta:** decidir o que o Responsável indicado vê por padrão; parecer jurídico dos termos.
**Sugestões:** mostrar o Termo 3 (aluno menor) ao NAPNE para revisão de linguagem.
