# VERIFICAÇÃO DO L22c — conferência de telas por máquina (14/11/2026)

Estado do lote: **Implementado e aplicado no site local, não Verificado.** Este documento **não** torna o L22c "Verificado": falta a checagem humana do autor (leitor de tela, teclado, contraste, NAPNE). Ordem do autor de 14/11 (19:06): o Code confere as telas em 360, 768 e 1280 px.

## 1. Como foi medido (e o limite)
- Código: ramo `lote-22c-admin-convites`, commit `dbf1d4b`. Navegador do aplicativo (Chromium), largura emulada em 360, 768 e 1280 px.
- **Ressalva importante:** não existe conta de Admin nem de Master nas credenciais de teste (o Master exige segundo fator, que é do autor). Para não mexer no banco, as telas rodaram em **um servidor temporário** (contêiner `node:26`, porta 5174, já removido) com o **código e o CSS reais do commit** e uma **API simulada com dados fictícios** (`prof@x.exemplo.invalid` etc.). Ou seja: **a tela é real; a resposta do servidor é simulada.** O site no ar (porta 18080) e o banco não foram tocados. A conferência com o Master real continua pendente (autor).
- Medidas por tela e largura: axe-core 4.14.0 (regras WCAG 2.0/2.1/2.2 A e AA + boas práticas, **com contraste ligado**), rolagem horizontal da página e interna, alvos de toque (mínimo 44 px), anel de foco, teclado (Tab e Enter de verdade) e mensagens.

## 2. Telas e larguras

| Tela | 360 px | 768 px | 1280 px |
| --- | --- | --- | --- |
| Admin: Início com "Primeiros passos" | passou* | passou* | passou* |
| Admin: Usuários (Desativar/Reativar, confirmação em texto) | **falhou (F-059)** | passou, com 1 ressalva (A2) | passou |
| Cadastro da instituição com Termo 6 | passou* | passou* | passou* |
| Master: Início com "Primeiros passos" | passou* | passou* | passou* |
| Master: Convites (lista e Revogar) | passou | passou | passou |
| Master: Limite de alunos | passou | passou | passou |

\* "Passou" = sem rolagem horizontal, alvos de 44 px, nenhum erro do axe **causado pelo L22c**. Os dois avisos que o axe dá em todas as telas estão em "Achados antigos" (seção 4).

## 3. O que falhou ou ficou aberto (do L22c ou em tela que o L22c alterou)

| # | Achado | Onde | Gravidade | Causa |
| --- | --- | --- | --- | --- |
| **F-059** | Em 360 px a página de Usuários **alarga para cerca de 690 px** e o navegador diminui o zoom (rolagem horizontal efetiva). Com a tabela escondida a página volta a 360 px. | Admin, Usuários | **Média** (regra de responsividade do CLAUDE.md, seção 4) | A tabela tem largura mínima de ~704 px dentro de `.table-wrap`. **Já existia antes do L22c:** repeti com o `Usuarios.tsx` de antes do commit e deu 687 px. O L22c só acrescentou um botão na coluna Ação e a tela é "alterada" pelo lote, então a regra vale. |
| A2 | Em 768 px a tabela rola 23 px por dentro (coluna Ação parcialmente fora do quadro); a pergunta "Desativar …?" e seus botões ficam apertados na célula. | Admin, Usuários | Baixa | Mesma tabela larga. |
| A3 | Depois de **Desativar**, **Revogar** e **Entendi**, o foco volta para o início da página (o botão sumiu da tela). No Chrome o Tab continua do ponto certo (conferi: o Tab seguinte caiu em "Sim, revogar"). A mensagem de resultado ("A conta de … foi desativada.") tem `role="status"`. **Não consegui conferir** se o leitor de tela anuncia a pergunta de confirmação que aparece no lugar do botão. | Usuários, Convites, Primeiros passos | Baixa a média (depende do leitor de tela) | O elemento que tinha o foco sai da tela. Fica para a checagem humana. |
| A4 | O cartão "Primeiros passos" do Master aparece **acima** do título da página ("Instituições"), então o título de seção vem depois do cartão. | Master, Início | Baixa (ordem de leitura) | Posição do cartão no `Gestao`. |

## 4. Achados antigos (não são do L22c; ficam registrados)
- **Contraste 4,42:1** (pedido: 4,5:1) no texto cinza `#64748b` sobre `#f4f7fb`: subtítulo do título da página (`.page-title p`) e o texto "Educação e inclusão" da marca. Aparece em todas as telas com esse estilo.
- **`region`** (boa prática) na faixa "Ambiente de teste. Dados fictícios." fora de uma área de página.
- Botão flutuante do VLibras (53×53 px) fica sobre o canto da tela (é de outro lote).
- Texto do sino "Mensagens, undefined não vistas" apareceu **só no servidor simulado** (a minha API simulada não devolveu o número); não afirmo que exista no site real.

## 5. O que passou (resumo)
- **Primeiros passos** (Admin e Master): 4 a 5 tópicos, texto literal, "Entendi" grava `siesal-primeiros-passos-v1-admin=sim` neste aparelho e o cartão some; botões de 44 px.
- **Desativar/Reativar:** pede confirmação em texto ("A pessoa deixa de entrar. Nada é apagado."), só envia o pedido depois de "Sim, desativar"; mensagem de resultado em `role="status"`; nome longo e e-mail longo quebram sem estourar.
- **Termo 6:** 7 itens e uma caixa "Li e aceito"; sem marcar, o envio é barrado (mensagem "Para criar a instituição, leia e aceite o termo.") e **nenhum pedido sai**; alvo da caixa de 48 px.
- **Convites (Master):** lista sem o código, datas em dia/mês/ano, "Revogar" com confirmação ("Ele deixa de valer na hora."); botões de 44 px.
- **Limite de alunos (Master):** campo com rótulo e dica "Um número de 1 a 20"; valor 99 é recusado com mensagem e **nenhum pedido sai**.
- Anel de foco visível nos botões: contorno sólido de 2,4 px (`#00718c`) quando o foco vem do teclado.

## 6. O que NÃO foi conferido aqui
- Leitor de tela, contraste a olho, NAPNE (checagem humana do autor).
- Fluxo completo com a API real (Admin real, Master real com segundo fator, convite real). Os testes de integração do commit (393) cobrem a API; esta conferência cobre a tela.
- Termo 6 e Primeiros passos para os outros perfis (aluno, professor, pedagógico, responsável) nas 3 larguras; só Admin e Master foram abertos.

## Feito, Falta, Sugestões
**Feito:** telas do L22c abertas nas 3 larguras com axe, teclado, foco e alvos; 1 falha de responsividade (F-059, antiga), 3 observações.
**Falta:** checagem humana (autor); decidir o que fazer com F-059 (lote de correção, sem código nesta mensagem); conferência com o Master real.
**Sugestões:** corrigir F-059 e o contraste de `#64748b` em um lote pequeno de defeito (CLAUDE.md: defeito vem antes de melhoria); levar A3 para o leitor de tela do autor ou do NAPNE.

## Como voltar
Nada no código ou no banco foi alterado nesta conferência. O servidor temporário e o arquivo de configuração temporário foram removidos.
