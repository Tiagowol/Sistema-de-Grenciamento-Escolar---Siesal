# L17c — Conta e suporte (09/11/2026)

Estado: Implementado (falta checagem humana: leitor de tela, teclado, contraste, zoom 200%, medição em 360, 768 e 1280 px, e revisão do NAPNE e de um parecer sobre a anonimização). Migração 0013 provada em banco temporário; **não aplicada ao banco do site** (backup antes e retorno em `docs/RETORNO-0013.md`).

## O que foi feito
1. Tela "Minha conta" (menu, todos os perfis escolares): trocar senha (só com a senha atual; usa a rota que já existia), trocar e-mail e encerrar conta (duas etapas: pedido com a senha atual, depois confirmação), pedir suporte.
2. Aluno é tratado como menor de idade (o cadastro não guarda data de nascimento). A troca de e-mail precisa da aprovação do Responsável vinculado ou do Admin. O encerramento precisa do Responsável e, se o aluno não tem Responsável ativo, do Admin (A-032). O Admin de outra instituição e o Responsável sem vínculo não veem nem decidem.
3. Encerrar conta = desativar + anonimizar: nome vira "Conta encerrada"; e-mail vira endereço anônimo único; credencial, segundo fator, sessões e códigos de recuperação são anulados; vínculos, tarefas, etapas, eventos, tipos, notas pessoais e apelido são desativados e têm o texto limpo; textos de pedidos de ajuda, de suporte e de troca de e-mail são limpos. **Ficam**: auditoria (append-only, hash preservado), notas oficiais e suas versões, que passam a apontar para "Conta encerrada".
4. Suporte: assunto por lista + texto (até 500 letras, sem link). Chega ao sino do Admin e do Pedagógico (mesma base do L16, com "visto" por pessoa) e é marcado como atendido. Limite de 3 pedidos abertos por pessoa.
5. Matriz de permissões v9 (`conta`, `conta_menor`, `pedidos_suporte`), com testes gerados e coerência com a política.
6. Conta encerrada não entra (login recusa), não aparece na lista de usuários do Admin e a sessão antiga deixa de valer.

## Decisões e limites (para o autor decidir)
- **Confirmação por e-mail não existe** ainda: não há envio de e-mail real (Parte 2). Por isso, para perfis adultos, a "confirmação" da troca de e-mail é um segundo passo na própria tela, depois do pedido com a senha atual. Quando houver e-mail real, a confirmação passa a ser um código enviado ao e-mail novo.
- O Responsável e o Admin só veem o pedido do aluno dentro de "Minha conta"; **não há aviso no sino** para eles. Sugestão para o próximo lote.
- Dois gatilhos de append-only foram ajustados na migração 0013: o texto de `pedido_ajuda` e o título de `evento_versao` só podem ser limpos quando a conta do dono está encerrada. Para conta ativa, tudo continua imutável (há teste).
- O texto dos pedidos de revisão de nota (L15) não é limpo: faz parte do histórico de notas oficiais. Precisa de decisão jurídica (LGPD) antes de dizer "em conformidade".
- Rotas que testam a senha entram no limite por IP já existente.

## Falta
- Checagem humana e NAPNE. Aplicar a migração 0013 no banco do site (autorização separada). Aviso no sino para quem decide pelo menor.
