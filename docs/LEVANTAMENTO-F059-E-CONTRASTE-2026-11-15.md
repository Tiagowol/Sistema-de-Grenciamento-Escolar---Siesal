# Levantamento — F-059 e contraste 4,42:1 — 15/11/2026

Resultado em uma linha: as duas causas estão achadas e medidas; há 1 ou 2 formas de corrigir cada uma. **Nenhuma foi escolhida nem aplicada:** a decisão é do autor.

## F-059 — página "Usuários" alarga em 360 px
- **Medido (Chromium, site local, Admin fictício, 360 px):** a largura da página inteira passa a 606 px. A tabela está dentro de `.table-wrap` (`overflow-x: auto`), que mede 288 px e rola por dentro: **a tabela em si não é o problema**.
- **Causa real (corrige a hipótese anterior, "tabela de 704 px"):** cada botão "Nova senha provisória" tem um texto escondido para leitor de tela (`<span class="sr-only">`, `position: absolute`, em `Usuarios.tsx:167`). `.table-wrap` não é `position: relative`, então esses textos ficam posicionados em relação a um ancestral mais largo e **vazam para fora da área rolável**, na borda direita da tabela (606 px), e alargam o documento.
- **Prova:** com `.table-wrap { position: relative }` injetado no navegador, a largura da página volta a 360 px.
- **Forma A (menor):** acrescentar `position: relative` a `.table-wrap` em `web/src/estilos/prototipo.css` (1 linha). Vale para toda tabela que usa `.table-wrap`. Risco baixo; precisa de teste em 360, 768 e 1280 px.
- **Forma B (maior):** em telas estreitas, trocar a tabela por cartões, como a tela de Auditoria (L22e). Melhor para leitura em celular, mas muda a estrutura da tela e pede teste novo.
- Recomendação do Code, a decidir pelo autor: A agora (é defeito e é 1 linha); B só se o autor quiser a lista em cartões.
- Outras telas com `.table-wrap` e texto `sr-only` na tabela podem ter o mesmo vazamento: conferir na mesma correção.

## Contraste 4,42:1 (pedido: 4,5:1)
- **Causa:** a cor `--muted: #64748b` (`prototipo.css:15`) sobre o fundo `--bg: #f4f7fb` dá **4,43:1** na minha conta (o registro anterior diz 4,42). Sobre branco dá 4,76:1 (passa). A variável é usada em 25 regras; só falha sobre o fundo cinza-azulado.
- **Forma A (global):** escurecer `--muted` para `#5d6b80`: 5,04:1 sobre `--bg`, 4,8:1 sobre `--primary-soft`, 5,13:1 sobre `--surface`. Muda a cor de todos os textos de apoio, de forma leve. Os outros temas (escuro e alto contraste) têm variáveis próprias e devem ser conferidos.
- **Forma B (local):** trocar a cor só no subtítulo do título e na marca, que são os dois lugares que falham. Deixa o resto igual, mas o padrão visual fica com dois cinzas.
- Opção intermediária medida: `#5f6f84` dá 4,77:1 sobre `--bg` e 4,55:1 sobre `--primary-soft` (passa por pouco).
