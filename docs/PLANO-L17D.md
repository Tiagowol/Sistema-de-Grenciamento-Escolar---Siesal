# Plano do L17d — Rótulos, chave do menu, ajuda e VLibras (10/11/2026)

Aprovado pelo autor em 10/11/2026, 15:30 (A-036). Ramo: `lote-17d-rotulos-libras`, criado a partir do `siesal-4` em `05f3d01`.
Estado: **Implementado** (10/11/2026). Nada é "Verificado" antes do retorno do NAPNE e do professor (12/11/2026).

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

**Consequência:** a condição de parada da especificação foi atingida e o Code parou. **Decisão do autor (A-037, 10/11/2026): integrar o pacote completo**, com o aviso antes de ativar.

## Desenho do VLibras (A-037)
1. Ícone flutuante "Libras" do SIESAL no canto direito, por padrão, na tela de entrada e dentro do sistema.
2. Primeiro clique: aviso literal ("O texto que você clicar vai para o servidor do governo federal (vlibras.gov.br)..."), com "Ativar VLibras" e "Agora não". "Agora não" não muda nada e não pune.
3. Só depois do "Ativar" o script `vlibras-plugin.js` é carregado e o botão oficial do VLibras assume o lugar do ícone.
4. Liga/desliga ("Mostrar o VLibras") em Acessibilidade (5 perfis) e em Personalizar (aluno). Desligado: o ícone some e o script não carrega.
5. Preferência por usuário no banco (rótulos, VLibras e aviso aceito). Na tela de entrada, sem usuário, vale a última escolha feita neste aparelho.
6. Campos de usuário e senha: o VLibras traduz texto da página, não o que está digitado nos campos.

## Itens do lote
| Item | Estado |
|---|---|
| 1. Rótulos ícone/texto, chave do menu, "?" de ajuda, preferência no banco | Implementado |
| 2. VLibras | Implementado (A-037) |

## Migração
O item 1 precisa de uma coluna nova em `preferencia_usuario` (provável migração `0015`, por exemplo `rotulos` e `vlibras`). Backup antes, retorno em `docs/RETORNO-0015.md` e aviso ao autor antes de aplicar no banco do site.

## Pausa em 10/11/2026 (pedido do autor: créditos acabando)
**Feito (sem commit):** migração `0015_interface.sql` e `docs/RETORNO-0015.md`; rotas `GET`/`POST /conta/interface` (5 perfis); matriz v10; chave "Menu lateral", "?" e rótulos ícone/texto no topo; ícone "Libras" com aviso; controles em Acessibilidade e Personalizar; CSP em `web/seguranca.conf`.
**Conferido:** 805 testes unitários e 211 de integração passando (a 0015 rodou só em banco temporário); topo de 280 a 1280 px nos dois modos, sem rolagem horizontal e com alvos de 44 px; VLibras traduzindo com a CSP valendo (0 bloqueios) numa cópia isolada do site (porta 18090, já desligada); clicar num campo não enviou nada.
**Fato medido:** o texto clicado vai para `https://traducao2.vlibras.gov.br/translate`; os arquivos vêm de `vlibras.gov.br` e de `cdn.jsdelivr.net/gh/spbgovbr-vlibras/`. A CSP precisou de `style-src 'unsafe-inline'` (estilos do widget).
**Falta:** resultado da última rodada de lint/tipos/testes; registrar em REGISTRO-DE-FALHAS a sobreposição dos sinos no modo texto do celular (já corrigida); commit e push no ramo `lote-17d-rotulos-libras`; backup e aplicar a 0015 no banco do site (só com aviso ao autor); refazer o site; checagem humana.

## Fechamento em 10/11/2026, noite (A-038)
- Rodada final do zero (contêiner `node:26`, cópia com fim de linha LF): lint com 0 erros e 1 aviso antigo; tipos sem erro; 805 testes unitários e 211 de integração passando. Proxy conferido: 200 local e 200 no 18081.
- Registradas: F-048 (sinos sobrepostos no modo texto do celular, já corrigida) e F-049 (lint com CRLF na cópia de trabalho).
- Migração 0015 aplicada no banco do site em 10/11/2026, depois do backup `backups/siesal-20261110-203915.dump` (primeira tentativa recusada pela trava de hash: F-050). Site refeito: 200 local, 200 no proxy, 200 no link externo; `/api/conta/interface` sem sessão responde 401.
- Falta: checagem humana (leitor de tela, teclado, contraste, celular real) e retorno do NAPNE (12/11/2026).
