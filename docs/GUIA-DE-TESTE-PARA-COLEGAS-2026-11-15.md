# Guia de teste para quem não é de TI — SIESAL 4.0 — 15/11/2026

Resultado em uma linha: este guia diz, em passos curtos, como conferir os lotes L22c, L22e e L22g e os testes T1 a T4. Nenhum lote é "Verificado" ainda; a sua checagem é o que falta.

## Antes de tudo
- **Achar um defeito não atrasa nada.** Anote o que viu e devolva para o autor. Quem decide o que fazer com o defeito é o autor.
- Só dados fictícios. Não use dado real de ninguém.
- Senhas e códigos **não estão neste guia**. O autor entrega as contas de teste por fora (arquivo `segredos-locais/`, fora do git). Não copie senha para anotação, foto ou chat.
- O "aprovo" de cada lote é só do autor. Testar não aprova nada.

## 1. Como abrir o site (no computador do autor)
1. Abra o navegador.
2. Digite `http://localhost:18080` e tecle Enter.
3. Deve aparecer a tela de entrada do SIESAL.
- Terminou quando: a tela de entrada aparece. Se não aparecer, anote "site não abriu" e avise o autor.
- Entrada de pessoa (cadastro próprio): `http://localhost:18080/pessoa`.
- Caixa de e-mails de teste (os e-mails do SIESAL caem aqui): `http://127.0.0.1:18025`.
- Para testar de outro aparelho, só o autor liga o acesso público temporário.

## 2. Como mudar a largura da tela (360, 768 e 1280 px)
1. No computador, abra o navegador e tecle F12.
2. Clique no ícone de celular e tablet (modo de dispositivo).
3. Em "Dimensões", digite a largura: 360, depois 768, depois 1280.
- Terminou quando: você viu a tela nas 3 larguras.
- O que procurar em todas: **nenhuma barra de rolagem na horizontal**; texto sem cortar; botões fáceis de tocar.
- Alternativa sem F12: use um celular (360 é parecido com o celular), um tablet e o computador.

## 3. Onde anotar
Copie a tabela da seção 9, uma linha por teste. Escreva **OK** ou **FALHOU**. Se FALHOU, escreva em uma frase o que viu, em qual largura e em qual navegador.

## 4. L22c — Admin desativa, convites e Primeiros passos
Quem testa: precisa de uma conta de Admin (segundo fator exigido) e da conta do Master. O autor entrega.
1. Entre como Admin. No Início aparece um cartão **"Primeiros passos"**. Clique em **"Entendi"**: o cartão fecha. Recarregue a página: ele não volta neste aparelho.
2. Abra **Usuários**. Em uma conta fictícia, clique em **Desativar**. Aparece uma pergunta de confirmação em texto simples. Confirme. A conta passa a "desativada"; clique em **Reativar** e confirme.
3. Tente desativar a **sua própria** conta. Deve ser recusado, com uma mensagem clara.
4. Entre como Master. Abra **Convites**: aparece a lista de convites esperando uso, **sem mostrar o código**. Clique em **Revogar** em um convite de teste.
5. No Master, abra **Limite de alunos**. Valores aceitos: de 1 a 20. Deixe em 5 ao terminar.
- Terminou quando: cada passo fez o que está escrito.
- Falhou se: o código do convite aparece na lista; ou o Admin consegue desativar a si mesmo; ou o Admin vê conta de outra escola.

## 5. L22e — Tela "Auditoria" do Admin
1. Entre como Admin. No menu, clique em **Auditoria**.
2. Deve aparecer uma lista do mais novo para o mais velho, e no topo a faixa **"Cadeia íntegra: sim"**.
3. Cada linha mostra quando (palavra e dia/mês, hora pequena), quem fez e o que foi feito, em frase.
4. Procure por: nome de aluno fazendo tarefa, nota, dificuldade ou plano. **Não deve haver nenhum.** Também não deve haver código, endereço de IP nem texto "antes/depois".
5. Clique em **"Ver eventos mais antigos"**, se o botão existir. Mais linhas aparecem.
- Terminou quando: a lista aparece e nada de aluno aparece.
- Falhou se: aparecer qualquer dado de aluno ou responsável. **Isso é falha de segurança: anote e avise o autor na hora.**
- Conferência da máquina (15/11): com um Admin fictício, a rota respondeu com a cadeia íntegra, 33 eventos e sem conteúdo de aluno. Falta a conferência humana na tela.

## 6. L22g — Menu lateral
1. Em 1280 px, com a janela baixa (diminua a altura do navegador), olhe o menu à esquerda. **Não deve aparecer barra de rolagem.**
2. Gire a roda do mouse sobre o menu: ele deve rolar. Quando há itens abaixo, deve haver uma **sombra suave** no pé do menu; ao chegar no fim, a sombra some.
3. Tecle Tab várias vezes: o item com foco deve ficar à vista e com borda visível. Chegue até **Ajuda**. Shift+Tab volta.
4. Confira que **cada item tem um ícone diferente** dos outros do mesmo menu.
5. Confira que "Pedidos de acompanhamento" (duas linhas) fica alinhado com os demais e sem texto cortado.
6. Repita em 360 px (gaveta do celular: botão de menu abre o menu) e em 768 px.
- Terminou quando: os 6 itens foram conferidos nas 3 larguras.

## 7. Testes T1 a T4 (cadastro próprio e representante legal)
O guia completo, com as contas e os códigos de convite, está no computador do autor em `segredos-locais/GUIA-DE-TESTES-2026-11-13.txt` (fora do git, não compartilhe). Resumo sem segredo:
- **T1 — Cadastro próprio, com confirmação por e-mail.** Em `/pessoa`, "Criar cadastro" com nome e e-mail de teste novos. O site avisa que enviou um link. Abra a caixa de e-mails de teste e clique no link. Depois entre. Deve aparecer "Escolha o espaço" vazia, sem dado de aluno. **Falhou se:** o login funciona antes de confirmar o e-mail.
- **T2 — Representante legal cria o aluno menor, com um convite.** Entre com a conta de representante. Clique em "Criar conta de aluno menor" e preencha. Sem marcar a declaração, deve recusar. Com a declaração, o espaço do aluno aparece e a contagem sobe para "1 de 5". **Falhou se:** o mesmo convite funciona duas vezes; ou aceita aluno de 18 anos ou mais; ou aceita o mesmo e-mail do representante.
- **T3 — O aluno menor entra e troca a senha.** Em outra janela anônima, entre na tela principal com "Sem instituição" e a senha provisória. O site pede para trocar a senha antes de continuar.
- **T4 — O representante entra no espaço do aluno.** Clique no espaço individual. Atenção: desde o L22a-3 o representante pode **ver em modo leitura** o que o aluno autorizou; o que **não** pode é alterar nada nem ver o que o aluno não autorizou. **Falhou se:** o representante consegue escrever algo no espaço do aluno. (O texto antigo do guia, que dizia que o representante não vê nada, está desatualizado.)
- Dica: use uma janela anônima para cada pessoa; os logins não se misturam.

## 8. Leitor de tela, Firefox e Safari
**Leitor de tela (NVDA no Windows é gratuito; VoiceOver no Mac e no iPhone já vem pronto).**
1. Ligue o leitor. Abra o site e use só o teclado (Tab, Shift+Tab, Enter, setas).
2. Em cada tela dos lotes acima, ouça se cada botão e cada ícone tem um nome que faz sentido. Os ícones do menu **não devem ser lidos** (só o nome do item).
3. Confira se, depois de **Desativar**, **Revogar** ou **Entendi**, o leitor avisa o que aconteceu e se o foco fica em um lugar lógico (observação A3: hoje o foco pode voltar ao início da página; anote o que você ouviu).
**Firefox:** abra o site no Firefox e repita as seções 5 e 6.
**Safari (Mac, iPhone ou iPad):** abra o site (o autor liga o acesso público temporário) e repita as seções 5 e 6. Atenção especial ao menu: no Safari a barra de rolagem some de forma diferente.
- Terminou quando: você anotou OK ou FALHOU para leitor de tela, Firefox e Safari na tabela.

## 9. Tabela para copiar
| Teste | Largura | Navegador | Resultado (OK ou FALHOU) | O que viu (se FALHOU) |
|---|---|---|---|---|
| L22c passos 1 a 5 | 360 / 768 / 1280 | | | |
| L22e Auditoria | 360 / 768 / 1280 | | | |
| L22g menu | 360 / 768 / 1280 | | | |
| T1 | | | | |
| T2 | | | | |
| T3 | | | | |
| T4 | | | | |
| Leitor de tela | | | | |
| Firefox | | | | |
| Safari | | | | |

Quem testou e quando (dia/mês): ______________________

## Ao terminar
Entregue a tabela ao autor. Defeito achado entra antes de qualquer lote novo, mas **não atrasa a entrega**: é só anotar e devolver.
