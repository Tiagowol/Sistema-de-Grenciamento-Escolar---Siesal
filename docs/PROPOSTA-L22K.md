# PROPOSTA L22k — Admin indicado por função (suporte, pedidos de convite ou os dois) — 18/11/2026

Estado: **Planejado (proposta escrita). Nenhum código nem migração feito.** Origem: mensagem do autor de 18/11/2026, item 3 ("Ajustes e acréscimo ao L22i"). Os itens 1 e 2 da mesma mensagem foram feitos como **L22j** (ver diário de 18/11/2026). Pela A-071 e pelo CLAUDE.md (seção 3), só há código depois de "aprovo" explícito.

## Estado anterior (conferido no código)
- **L22f (migração 0033):** tabela `atendente_suporte` = uma indicação por Admin (liga/desliga). Nada se apaga: retirar grava `retirado_em`. A função `suporte_atendente_ativo(inst, usuario)` confere a cada chamada: indicação vigente, Admin ativo, escola ativa.
- **L22i (migração 0035):** as funções `pedido_convite_*_admin` usam a **mesma** `suporte_atendente_ativo`. Ou seja: hoje, indicar um Admin dá a ele **as duas** funções (suporte dos espaços e pedidos de convite), sem escolha.
- **Tela do Master:** "Atendentes do suporte" (`m_atendentes`), com "Indicar" e "Retirar".
- **Site:** `/eu` devolve `atendente_suporte: boolean`; os itens de menu "Suporte dos espaços" e "Pedidos de convite" usam `soAtendente`.
- **Matriz v25:** `suporte_individual.atender` e `pedidos_convite.decidir` com `admin: "indicado"`; `suporte_individual.indicar_atendente` só Master.

## Itens do lote (3)
1. **Indicação por função (banco).** Nova tabela `admin_indicacao_funcao` (instituição, Admin, **função**, quem indicou, `criado_em`, `retirado_em`, `retirado_por`), uma linha vigente por Admin e função. Funções aceitas (lista fechada): `suporte_individual` e `pedido_convite`. Nova função `admin_funcao_ativa(inst, usuario, funcao)` com as mesmas conferências de hoje. `suporte_atendente_ativo` passa a conferir só a função `suporte_individual`; as `pedido_convite_*_admin` passam a conferir só `pedido_convite`. A tabela antiga fica (nada se apaga); deixa de ser lida.
2. **Tela do Master "Admins indicados"** (substitui "Atendentes do suporte"). Um cartão por Admin ativo de escola ativa, com duas chaves liga/desliga, cada uma com rótulo em texto: "Pedidos de suporte dos espaços" e "Pedidos de convite". Cada mudança pede confirmação em texto e vai para a trilha do Master (`admin_funcao.indicada` e `.retirada`, com a função). O cartão diz em palavras o que o Admin faz hoje ("Só pedidos de convite", "Só suporte", "Os dois", "Nenhuma").
3. **Site do Admin.** `/eu` passa a devolver `funcoes_indicadas: string[]` no lugar do booleano. Cada item de menu e cada item do sino aparece só com a sua função: "Suporte dos espaços" com `suporte_individual`; "Pedidos de convite" com `pedido_convite`. A rota confere no banco a cada chamada (o site só esconde).

## Migração
**Sim: `0036`** (job `migrate`, **com backup antes**, e `docs/RETORNO-0036.md`).
- Cria `admin_indicacao_funcao` com RLS forçada, escrita só pelas funções do Master (`siesal_ops`), como a `atendente_suporte`.
- **Copia** cada indicação vigente de hoje para **as duas** funções (é o que o Admin já faz hoje; ninguém perde acesso no dia da troca). Ver Q1.
- `CREATE OR REPLACE` de `suporte_atendente_ativo` e das 4 `pedido_convite_*_admin`; novas `admin_funcao_indicar`, `admin_funcao_retirar` e `admin_funcoes_listar` (só `siesal_ops`).
- **Matriz v26:** recurso `indicacoes_admin.gerenciar` (só Master, `plataforma`), no lugar de `suporte_individual.indicar_atendente`; `admin: "indicado"` continua nos dois recursos, agora lido como "indicado **para esta função**". O teste gerado cobre os 6 perfis.

## Testes e critérios de "terminou"
1. Admin só com `pedido_convite`: vê e decide pedidos de convite; recebe 403 na fila de suporte; o menu e o sino não mostram suporte.
2. Admin só com `suporte_individual`: o contrário do item 1.
3. Admin com as duas: vê as duas, cada uma com seu rótulo e sua contagem (como no L22j).
4. Retirar uma função corta só aquela, **na hora**; a outra continua. Desativar o Admin ou suspender a escola corta as duas.
5. A migração mantém as duas funções para quem já era indicado; o retorno (`RETORNO-0036.md`) volta ao estado de hoje sem perder registro.
6. Cada indicar e retirar deixa registro na trilha do Master com a função; nada é apagado.
7. Tela em 360, 768 e 1280 px, cartões, chaves com alvo de 44 px e rótulo em texto (não só cor), axe sem violação, foco mantido depois de confirmar.
8. Lint, tipos, testes de integração e de tela passando. **Não torna o lote "Verificado"** (isso é a checagem humana).

## Fora do lote
- Outras funções além das duas (a lista fica fechada; uma nova função é lote próprio).
- Indicar Pedagógico ou outro perfil (continua só Admin).
- Envio de e-mail real (Parte 2).

## Riscos
- **Troca de função de banco usada por rotas em produção local:** um erro na `0036` pode tirar o acesso do Admin indicado. Mitigação: testes de integração dos 3 casos e retorno escrito antes de rodar.
- **Privacidade:** nenhuma mudança no que é lido; só fica mais estreito (cada Admin vê só a fila da sua função).

## Perguntas
- **Q1. Quem já é Admin atendente hoje fica com quais funções depois da troca?**
  - **(Recomendado) As duas** — é o que ele já faz hoje; o Master tira uma depois, se quiser.
  - Só "Pedidos de suporte dos espaços" — como era no L22f, antes do L22i.

## Feito, Falta e Sugestões
- **Feito:** esta proposta, com o estado anterior conferido no código.
- **Falta:** aprovação do autor (e resposta à Q1); depois, código, migração 0036 com backup e retorno, testes.
- **Sugestões:** fazer o L22k só depois da checagem humana do L22j, para não misturar os dois testes.
