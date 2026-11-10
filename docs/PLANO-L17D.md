# Plano do L17d — Rótulos, chave do menu, ajuda e VLibras (10/11/2026)

Aprovado pelo autor em 10/11/2026, 15:30 (A-036). Ramo: `lote-17d-rotulos-libras`, criado a partir do `siesal-4` em `05f3d01`.
Estado: **Planejado**. Nada é "Verificado" antes do retorno do NAPNE e do professor (12/11/2026).

## Especificação (texto do autor)
1. **Rótulos:** padrão ícones; em Personalizar o aluno troca para texto. O botão de recolher o menu vira uma chave liga/desliga explícita (nome acessível, estado anunciado). Ajuda com ícone "?". Preferência por usuário, no banco.
2. **VLibras** (suíte oficial do governo federal): liga/desliga em Personalizar ou Acessibilidade (o Code recomenda onde); padrão desligado; estado salvo por usuário. Antes de integrar, o Code diz ao autor o que o widget carrega e o que envia para fora (CSP e LGPD). Se enviar conteúdo da página a servidor externo, o Code para e pergunta.

**Terminou quando:** chave e "?" nos 5 perfis; troca ícone/texto mantida após novo login; VLibras liga e desliga nas telas principais; CSP documentada; axe sem violações.

## Estado anterior (conferido em 10/11/2026)
- O menu tem um botão "Recolher menu" / "Mostrar menu" (`web/src/componentes/Shell.tsx`, linha 304).
- A tabela `preferencia_usuario` existe desde o L17b (migração 0012), uma linha por pessoa, com RLS.
- CSP do site (`web/seguranca.conf`): `default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. Hoje nada externo é carregado.

## Onde fica o liga/desliga do VLibras
Recomendação do Code: **Acessibilidade**. Motivo: é recurso de acesso ao conteúdo, como leitura em voz e tempo visual; Personalizar trata da aparência. A troca ícone/texto fica em Personalizar, como pede a especificação.

## Análise do VLibras (CSP e LGPD)
Fontes: manual oficial do VLibras Widget 7.0.0 (`vlibras.gov.br/doc/widget`), páginas de integração, CSP, tradução de texto e avaliação, lidas em 10/11/2026.

**O que ele carrega (fato, do manual):**
- Script `https://vlibras.gov.br/app/vlibras-plugin.js`, que se inicia sozinho.
- O avatar 3D (Unity) num `iframe` de `https://vlibras.gov.br/app/unity/index.html`.
- Fonte de `vlibras.gov.br`, redirecionada para `cdn.jsdelivr.net`.
- CSP pedida pelo manual: `frame-src https://vlibras.gov.br; font-src https://vlibras.gov.br https://cdn.jsdelivr.net`. Na prática também seria preciso liberar `script-src https://vlibras.gov.br` (hoje só `'self'`). O manual não lista `connect-src`, `worker-src` nem WASM.

**O que ele envia para fora:**
- Fato: o texto que a pessoa clica é traduzido pelo avatar, que roda no `iframe` de `vlibras.gov.br`. Ou seja, **o texto da página sai do SIESAL e vai para código de outro domínio**, no mínimo dentro do navegador.
- Estimativa (não confirmada no manual): a tradução do texto para glosa é feita num servidor do governo, e não no navegador. Se for assim, o texto clicado (por exemplo, uma nota, um aviso ou o nome de um colega) é enviado ao servidor do VLibras.
- Fato: existe a avaliação "Gostei / Não gostei" e o envio de sugestão de correção; o manual não diz para qual endereço vai.
- Toda carga do script também envia ao `vlibras.gov.br` o IP e o navegador da pessoa (comportamento comum de qualquer recurso externo).

**Consequência:** a condição de parada da especificação foi atingida. O Code **não integrou** o VLibras e aguarda a decisão do autor.

## Itens do lote
| Item | Estado |
|---|---|
| 1. Rótulos ícone/texto, chave do menu, "?" de ajuda, preferência no banco | Planejado (pode seguir; independe do VLibras) |
| 2. VLibras | Parado, aguardando decisão do autor sobre envio de texto a servidor externo |

## Migração
O item 1 precisa de uma coluna nova em `preferencia_usuario` (provável migração `0015`, por exemplo `rotulos` e `vlibras`). Backup antes, retorno em `docs/RETORNO-0015.md` e aviso ao autor antes de aplicar no banco do site.
