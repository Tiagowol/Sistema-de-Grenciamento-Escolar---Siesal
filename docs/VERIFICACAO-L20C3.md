# VERIFICAÇÃO DO 20c-3 — Convite de instituição (11/11/2026)

Estado do lote: **Implementado**, aplicado no site em 11/11/2026 (ver A-058). Não é "Verificado": falta a checagem humana.

## 1. O que foi conferido por máquina
| Verificação | Resultado |
| --- | --- |
| Lint (biome) | 0 erros, 1 aviso antigo |
| Tipos (api, web, shared) | sem erro |
| Testes unitários | 1051 passando (inclui axe no formulário de cadastro de instituição) |
| Testes de integração (banco temporário, com a 0021) | 288 passando, 6 novos para este lote |
| Erro não tratado do vitest | o mesmo da F-053, já existia |

## 2. Critérios do lote
| Critério | Como foi conferido |
| --- | --- |
| Só o Master gera o convite | teste de integração (401 sem sessão) |
| Cria a instituição em implantação e o Admin com a senha escolhida | teste de integração (banco confere nome, tipo, situação e perfil) |
| O Admin entra só para ativar o segundo fator | teste: nível "configurar_totp" e /usuarios responde 403 |
| O Master vê a escola nova e muda a situação | teste de integração |
| Uso único; inventado, vencido e usado dão a mesma recusa | teste de integração |
| Convite de aluno não cria instituição e o de instituição não cria aluno | teste de integração; nenhum dos dois é gasto na recusa |
| Dados inválidos e senha fraca não gastam o convite | teste de integração |
| O aplicativo não cria instituição por conta própria | teste de integração (o `INSERT` direto é negado) |
| Formulário no axe | teste de tela |
| Medidas em 360, 768 e 1280 px, leitor de tela e teclado | **não conferido** |

## 3. O que NÃO foi feito
1. Fluxo completo no site com um convite real (o teste de integração cobre; falta o autor tentar).
2. E-mail de aviso ao Master e módulos da instituição nova (o Master liga pelo painel).
3. Medidas em tela, leitor de tela, teclado, NAPNE.

## Feito, Falta, Sugestões
**Feito:** convite de instituição de ponta a ponta no código; link `/cadastro/instituicao#CODIGO`; painel do Master com botão e cópia do link; 6 testes de integração e 3 de tela; registro A-058.
**Falta:** checagem humana; 20c-2 (D2b e D7); merge dos lotes em `siesal-4`.
**Sugestões:** testar com um convite real: gerar em `/gestao`, abrir o link em janela anônima, criar e ativar o segundo fator.
