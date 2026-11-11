# VERIFICAÇÃO DO L20a — Personalizar e Acessibilidade (11/11/2026)

Estado do lote: **Implementado**, não "Verificado". Falta a checagem humana (leitor de tela, teclado, contraste, NAPNE) e a API nova no site (F-052).
Conta usada nos testes de tela: aluno de teste. As preferências dela foram devolvidas ao que estavam.

## 1. O que foi conferido por máquina

| Verificação | Resultado |
| --- | --- |
| Lint (biome) | 0 erros, 1 aviso antigo (`api/src/conta/rotas.ts`) |
| Tipos (api, web, shared) | sem erro |
| Testes unitários | 958 passando (inclui axe em Personalizar) |
| Testes de integração (banco temporário, com a 0018) | 241 passando |
| Contraste de toda cor × 4 temas | fundo suave 4,5:1; painel e menu 7:1 e 12:1 contra o branco; item ativo 7:1 (teste automático) |
| Contraste medido no navegador, 7 cores × 4 temas | menor valor 4,53:1 (Verde, tema claro) |

## 2. Tabela de controles

Legenda: **Função** = mexe no que deve, conferido no navegador (aluno) ou em teste; **Conta** = volta depois de sair e entrar, conferido em teste de integração para os 5 perfis (a API de teste, não a do site); **Humano** = falta a checagem de leitor de tela e teclado.

| Controle | Onde fica agora | Claro | Escuro | Alto contraste claro | Alto contraste escuro | Conta | Humano |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Apelido | Personalizar | ok | ok | ok | ok | ok | falta |
| Cor de destaque (6 cores + do tema) | Personalizar | ok | ok | ok | ok | ok | falta |
| Tela que abre primeiro | Personalizar | ok | ok | ok | ok | ok | falta |
| Tempo das atividades (3 blocos) | Personalizar | ok | ok | não medido | não medido | ok | falta |
| Voltar ao padrão | Personalizar | ok | ok | não medido | não medido | ok | falta |
| Tema escuro | Acessibilidade | ok | ok | ok | ok | ok | falta |
| Alto contraste | Acessibilidade | ok | ok | ok | ok | ok | falta |
| Tamanho da letra | Acessibilidade | ok (unitário) | — | — | — | ok | falta |
| Reduzir movimento | Acessibilidade | ok | ok | — | — | ok | falta |
| Leitura facilitada | Acessibilidade | ok | ok | — | — | ok | falta |
| Modo simples | Acessibilidade | ok (35 elementos a menos no Meu dia) | ok | — | — | ok | falta |
| Tempo visual | Acessibilidade | ok (unitário) | — | — | — | ok | falta |
| Linguagem curta | Acessibilidade | ok (unitário) | — | — | — | ok | falta |
| "Escolha o que fazer agora" | Acessibilidade | ok (unitário) | — | — | — | ok | falta |
| Botões do topo e VLibras | Acessibilidade | ok (L17d) | — | — | — | ok (L17d) | falta |

"—" = não conferido neste lote. "Conta: ok" vale para os testes de integração; no navegador a conta só foi lida com a API **antiga** (ver seção 4).

## 3. Os 6 achados, depois da correção

| # | Antes | Depois |
| --- | --- | --- |
| C1 | cor mudava 6 de 31 fundos | muda fundo suave, menu, item ativo, painel de boas-vindas, marca e realce do botão |
| C2 | escuro + contraste: botão com cor calculada para fundo branco | tema `alto_contraste_escuro` (fundo preto) com cores próprias, igual nas 2 telas e no banco |
| C3 | Modo simples não escondia nada | esconde, no Meu dia, os 4 números e a "Rotina possível" (35 elementos a menos) |
| C4 | "ficam neste aparelho" | "ficam salvos na sua conta" para os 5 perfis |
| C5 | controles repetidos nas 2 telas | cada controle em um lugar (A-048, item 2) |
| C6 | 179 cores no CSS | 162 hexadecimais restantes em `prototipo.css` e `extra.css`, a maioria nas definições dos temas (necessárias) e em cores de estado; lista dos que ainda acompanham só o tema azul fica para o autor decidir |

## 4. O que NÃO foi feito
1. **API nova e 0018 no site:** a imagem da API não reconstrói (F-052). Por isso o site em http://localhost:18080 ainda roda a API antiga; com o site novo e a API antiga, mudanças de preferência valem no aparelho, mas a API recusa o formato novo e a conta não guarda. Não reconstruí o `web` do site para não deixar essa combinação.
2. Alto contraste (claro e escuro) em Tempo das atividades e Voltar ao padrão não foi medido em tela.
3. Checagem em 768 e 1280 px: sem rolagem horizontal em Personalizar, Acessibilidade e Meu dia (768 px: 753 de 768); 360 px conferido em Personalizar (360 de 360, botões de 44 x 44).
4. Não conferi o plano de atividades (Atividades) e o Calendário com blocos novos em tela; usam a mesma lista de blocos do Foco, onde o valor novo apareceu.
5. Leitor de tela, teclado completo e NAPNE.

## 5. Como voltar atrás
- Código: `git checkout siesal-4` (o ramo `lote-20a-personalizar` não altera o `siesal-4`).
- Banco: a 0018 ainda não foi aplicada no site. Como desfazer depois: `docs/RETORNO-0018.md`.

## Feito, Falta, Sugestões
**Feito:** os 3 itens do L20a no código; testes; medições em tela; registros A-047, A-048, F-052 e F-053.
**Falta:** aplicar a 0018 e a API nova no site (depende de resolver a F-052 e do backup); a checagem humana; "aprovo" para commit e merge.
**Sugestões:** resolver o certificado dos contêineres antes de aplicar a 0018; levar a lista do Modo simples ao NAPNE em 12/11/2026.
