# VERIFICAÇÃO DO L22g — Menu lateral (14/11/2026)

Estado do lote: **Implementado (código no computador, sem commit de código), não aplicado no site, não Verificado.** Falta a checagem humana do autor (leitor de tela, teclado, contraste, NAPNE). Só CSS, ícones, um efeito do `Shell` e testes: **sem API, sem banco, sem migração, sem mudança de matriz**. Origem: A-121 (pedido e proposta), A-123 (Q1 = A) e o "Aprovo" do autor em 14/11/2026.

## 1. O que foi feito (os 3 itens da proposta)
1. **Barra de rolagem some, a rolagem continua.** `.sidebar` ganha `scrollbar-width: none` e `::-webkit-scrollbar { display: none }` (`web/src/estilos/extra.css`). O `overflow-y: auto` fica: roda do mouse, toque e Tab continuam rolando o menu. Uma **sombra suave no pé** (`.sidebar.mais-abaixo::after`, sem animação, sem pegar o clique) aparece quando ainda há itens abaixo e some no fim. A classe é calculada no `Shell` (rolagem, redimensionamento, busca e menu aberto/recolhido). Vale para o computador e para a gaveta do celular, nos 6 perfis (inclui o Master).
2. **Ícone próprio por item.** 8 ícones novos no mesmo traço (`agenda`, `pedidos`, `lupa`, `megafone`, `olho`, `ajuste`, `envelope`, `pessoa`). Trocas: Agenda, Quem pode ver meus dados, Pedidos de acompanhamento, Avisos da escola, Auditoria; no Master: Convites, Limite de alunos, Auditoria, Pedagógicos e NAPNE (agora coração) e Usuários sem vínculo. **Rótulos, ordem e quem vê cada item não mudaram.**
3. **Item de duas linhas alinhado.** Entrelinha 1,25, ícone centralizado e texto que quebra sem cortar. "Pedidos de acompanhamento" passou de 59 para 52 px quando quebra (e cabe em 1 linha na gaveta de 264 px). O rótulo não foi encurtado.

## 2. Verificação por máquina
| Verificação | Resultado |
| --- | --- |
| Testes de tela e shared | **1433 de 1433**, 43 arquivos (15 testes novos em `web/src/l22g.test.tsx`) |
| Tipos (api, web, shared) | sem erro |
| Lint dos 5 arquivos do lote | 0 erros; o mesmo aviso antigo de CSS (especificidade) que já existia |
| Integração da API | não foi refeita: a API não mudou |

Testes novos: **nenhum ícone repetido** no menu de aluno (escola e individual), professor, pedagógico, Admin, responsável (escola e individual) e Master; ícones com `aria-hidden` e nome do item continua sendo o texto; o CSS esconde a barra nos dois motores e **não** troca `overflow` por `hidden`; a sombra não anima e não pega clique; a classe da sombra aparece com itens abaixo, some no fim e volta no alto; com o menu todo à vista não há sombra; axe nos 6 perfis.

## 3. Conferência na tela (código real, API simulada, como no L22c e no L22e)
Servidor temporário (porta 5174, removido) com o código real e API simulada com dados fictícios; o site no ar e o banco não foram tocados.

| Situação | Barra visível | Sombra no pé | Alvos de 44 px | Ícones repetidos | Rolagem horizontal |
| --- | --- | --- | --- | --- | --- |
| 1280×720, Admin (14 itens) | não (0 px; antes 15 px) | sim | sim (44; 52 no item de duas linhas) | 0 | não |
| 768×700, gaveta do Admin | não | sim | sim | 0 | não |
| 360×640, gaveta do Admin | não | sim | sim (14 itens de 44 px) | 0 | não |
| 1280×720, Master (13 itens) | não | sim | sim | 0 | não |

- **Teclado (Tab de verdade):** do primeiro item até **Ajuda** (14º) o menu rola sozinho (324 px), o foco fica com anel visível de 2,4 px e dentro da tela, e **a sombra some ao chegar no fim**.
- Rolagem do mouse e do toque seguem funcionando (a rolagem não foi desligada).

## 4. O que NÃO foi conferido
- Leitor de tela, contraste a olho, NAPNE (checagem humana do autor).
- Shift+Tab de volta e a roda do mouse em um computador real (a rolagem é a nativa do navegador e não foi alterada).
- Navegadores além do Chromium do aplicativo: `scrollbar-width` e `::-webkit-scrollbar` cobrem Chrome, Edge, Firefox e Safari recentes; **não** testei Firefox nem Safari.
- Nenhum envio ao site no ar: o `web` do site ainda **não** tem o L22g (precisa de `docker compose up -d --build` e `docker compose restart proxy`, que fica com a sua autorização).

## 5. Riscos conhecidos
- Sem a barra, quem usa só o mouse sem roda pode não perceber que há mais itens; a sombra no pé mitiga e o Tab sempre alcança tudo.
- A sombra usa a cor `--menu-b`; se o tema do menu mudar, a cor do degradê precisa acompanhar.

## 6. Arquivos do lote (para o seu commit; sem `git add .`)
`web/src/componentes/Shell.tsx`, `web/src/estilos/extra.css`, `web/src/icones.tsx`, `web/src/paginas/Operacao.tsx` (só trocas de ícone e `export` de `ITENS_MASTER`), `web/src/l22g.test.tsx`.

## Feito, Falta, Sugestões
**Feito:** barra some com sombra no pé, ícones próprios, item de duas linhas alinhado, 15 testes novos, conferência em 360, 768 e 1280 px e pelo teclado.
**Falta:** seu commit de código; sua autorização para reconstruir o site; checagem humana; Firefox e Safari.
**Sugestões:** commit separado do L22e; reconstruir o site para ver o menu; depois, a proposta do L22f e a decisão sobre F-059 e contraste.

## Como voltar
- Código sem commit: `git checkout -- <arquivo>` nos 4 alterados e apagar `web/src/l22g.test.tsx`. Depois do commit: `git revert <commit>`; reconstruir com `docker compose up -d --build` e `docker compose restart proxy`.
- Banco: nada (sem migração).
