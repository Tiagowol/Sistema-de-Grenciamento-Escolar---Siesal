# PROPOSTA L22g — Menu lateral: sem barra de rolagem feia e itens consistentes — 14/11/2026

Estado: **Planejado (proposta escrita). Nenhum código feito.** Pedido do autor em chat, em 14/11/2026 (com uma captura de tela do menu do Admin): "corrija em um lote os menus, e tire essa barra de rolagem, muito feia e fora do padrão. Caso não tenha o lote 22g, faça ele". **O L22g não existia** (conferido nos documentos): este é ele. Ordem dos lotes: L22e (feito, falta o commit), **L22g (este)**, L22f (planejado, ainda sem proposta). Pela A-071 e pelo CLAUDE.md (seção 3), só há código depois de "aprovo" explícito; a pergunta Q1 abaixo fecha o que "corrigir os menus" inclui.

## Estado anterior (medido no navegador, 1280×720, menu do Admin, código atual)
- O menu lateral (`.sidebar`, `web/src/estilos/prototipo.css`) tem `overflow-y: auto`. O conteúdo do Admin mede **1051 px** e a janela **720 px**, então aparece a **barra de rolagem nativa** do navegador: cinza, 15 px de largura, **fora do tema escuro do menu**. É a barra da captura do autor. Aparece em todo perfil cujo menu não cabe na altura da janela, e também na gaveta do celular (mesma classe).
- O menu do Admin tem **14 itens** mais a busca, o cartão "Uma coisa de cada vez" e a versão. Só existe uma seção com nome ("NAVEGAÇÃO").
- **"Pedidos de acompanhamento"** quebra em 2 linhas (59 px); os outros itens têm 1 linha (44 px). Fica desalinhado.
- **Ícones repetidos no mesmo menu:** "Usuários" e "Pedidos de acompanhamento" usam o mesmo ícone (pessoas); "Avisos da escola" e "Auditoria" usam o mesmo ícone (arquivo); "Notas oficiais" e "Notas da turma" usam o mesmo (livro, perfis diferentes). Quem não lê bem confunde os itens.
- O Master usa o mesmo componente (`Shell`); o que mudar vale para os 6 perfis, no mesmo padrão (L22d).

## Itens do lote (3)
1. **Barra de rolagem do menu: some, a rolagem continua.**
   - A barra nativa deixa de aparecer no menu lateral (computador e gaveta do celular). O menu **continua rolando** com a roda do mouse, o toque e o teclado (o Tab leva o item focado para dentro da área visível, como hoje).
   - Como a barra deixa de avisar que há mais itens, entra uma **sombra suave no pé do menu** quando ainda há itens abaixo, que some ao chegar no fim. Sem texto, sem animação obrigatória (respeita "reduzir movimento").
   - **Não muda** o tamanho da letra, as cores, o menu recolhido do computador nem a ordem dos itens.
2. **Cada item do menu com ícone próprio** (nenhum ícone repetido dentro do menu de um mesmo perfil). Ícones novos no mesmo traço dos atuais, com `aria-hidden` (o nome do item continua sendo o texto). Só troca de desenho; os rótulos e a ordem não mudam.
3. **Item de duas linhas alinhado:** quando o rótulo é longo ("Pedidos de acompanhamento"), a altura e o espaço ficam consistentes com os outros itens (alvo de pelo menos 44 px, texto sem cortar), sem encurtar o rótulo (o texto é o mesmo da Ajuda e dos testes).

## Testes e critérios de "terminou"
1. Em 360, 768 e 1280 px (e com a janela baixa, 1280×600): nenhuma barra de rolagem visível no menu; o último item (Ajuda) é alcançável com roda, toque e **teclado** (Tab até o fim e Shift+Tab de volta).
2. A sombra do pé aparece com itens abaixo e some no fim; some também com "reduzir movimento" sem perder a informação.
3. Nenhum ícone repetido no menu de cada perfil (teste automático sobre a lista de itens, 6 perfis).
4. Alvos de 44 px, sem rolagem horizontal, foco visível, axe sem violação nos 6 perfis (teste de contrato do padrão, L22d, estendido).
5. O menu recolhido do computador continua igual. Sem mudança de texto no menu.
6. Lint, tipos e testes passando; conferência por mim nas 3 larguras. **Não torna o lote "Verificado"** (isso exige a sua checagem humana).

## Fora do lote
- Agrupar o menu em seções com nome e recolher/expandir (muda a estrutura de todos os perfis; só com decisão sua, vira L22h).
- Mudar rótulos, ordem ou quais perfis veem cada item.
- F-059 (tabela de Usuários em 360 px) e o contraste 4,42:1 do subtítulo (seguem abertos, lote de defeito à parte).
- L22f (Suporte do espaço individual).

## Riscos e custo
- **[Fato]** Só CSS, ícones e um teste; sem banco, sem API, sem migração, sem mudança de matriz.
- **[Estimativa]** Meio dia ou menos, com a conferência.
- **Risco principal:** esconder a barra faz algumas pessoas não perceberem que há mais itens. Mitigação: a sombra do pé do menu (item 1) e o fato de o Admin, que tem o menu mais longo, ver os itens mais usados no alto.

## Pergunta (1, fechada)
**Q1 — O que "corrigir os menus" inclui neste lote?**
- **A (recomendada):** os 3 itens acima (barra, ícones próprios, item de duas linhas alinhado).
- B: só a barra de rolagem (item 1).
- C: A e também agrupar os itens em seções com nome (por exemplo, "Pessoas", "Escola", "Registro"). **Não recomendo agora:** mexe na estrutura dos 6 perfis, precisa de decisão por perfil e passa de 3 itens.

## Feito, Falta, Sugestões
- **Feito:** estado anterior medido no navegador; causa da barra identificada (`overflow-y: auto` com menu mais alto que a janela); proposta escrita.
- **Falta:** resposta do autor à Q1 e "aprovo" explícito. Depois, código, testes e conferência nas 3 larguras. Merge e deploy só com autorizações separadas.
- **Sugestões:** aprovar com a A; começar o código só amanhã (15/11), por causa do ritmo do Adendo 4 (hoje já foram 2 lotes grandes), a não ser que você mande começar hoje.
