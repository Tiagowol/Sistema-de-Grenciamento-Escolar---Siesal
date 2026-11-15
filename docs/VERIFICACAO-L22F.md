# Verificação do L22f — suporte do espaço individual — 15/11/2026

Estado: **Implementado e aplicado no site local; NÃO Verificado** (falta a checagem humana: leitor de tela, teclado, contraste, NAPNE, Firefox e Safari). Código **não commitado** (aguarda o commit do autor). Base: `docs/PROPOSTA-L22F.md`, A-127; "aprovo" e Q1 = A do autor em 15/11/2026 (A-131).

## O que foi feito
- **Migração 0033** (aplicada, com backup `backups/siesal-20261114-210616.dump`): coluna `pedido_suporte.atendido_pela_plataforma`; regra nova de atendimento (quem atende vem de fora do espaço); tabela `atendente_suporte` (sem acesso direto do aplicativo); 10 funções `SECURITY DEFINER`. Retorno em `docs/RETORNO-0033.md`.
- **Matriz v24:** recurso `suporte_individual` (`atender`: Master na plataforma, Admin "indicado"; `indicar_atendente`: só o Master) e escopo novo `indicado`.
- **API:** Master: `GET /operacao/suporte-atendentes`, `POST .../indicar` e `.../retirar`, `GET /operacao/suporte-individual` (+ `/contagem`), `POST /operacao/suporte-individual/:id/atender`. Admin indicado: `GET /suporte-individual`, `POST /suporte-individual/:id/atender`; `/auth/eu` ganha `atendente_suporte`; o sino Mensagens ganha o item `suporte_individual` (só a quantidade).
- **Telas:** Master: "Suporte dos espaços" e "Atendentes do suporte" (sino da plataforma avisa); Admin indicado: item de menu "Suporte dos espaços" (só para ele). Cartões, sem tabela; tempo em palavra ("hoje", "ontem", "há N dias") + dia/mês + barra; confirmação em texto; foco volta ao título depois de "Marcar como atendido". Texto da tela Suporte do Master atualizado (a regra "o Master não lê esses pedidos" vale só para pedidos de escola). Manual: 2 tópicos novos.

## Segurança (o maior risco da proposta)
- A fila só traz **espaços do tipo `individual`**; só os campos: id do pedido, id do espaço, assunto, texto, nome, e-mail, data. Teste confirma as chaves exatas e que pedido de escola não aparece nem pode ser atendido por este caminho.
- A indicação é conferida **no banco a cada chamada** (não retirada, Admin ativo, escola ativa). Retirar, desativar o Admin ou suspender a escola cortam o acesso na hora (testado).
- Abrir a fila e atender ficam na trilha do Master ou na cadeia da escola do Admin; o atendimento fica também na cadeia do espaço como `plataforma:suporte`, sem o nome de quem atendeu. Nada é apagado.

## Testes por máquina
- Integração: **416 de 416** (33 arquivos; 16 testes novos em `api/src/suporte/suporte-individual.integracao.test.ts`).
- Telas, shared e verificação: **1478 de 1479**. O 1 que falha é `web/src/calendario.test.tsx` ("o tempo é concreto"): depende da data real e falha quando o relógio do contêiner (UTC) já está no dia 15/11; falhou igual sem as minhas mudanças. Há também 1 erro não tratado antigo no `l22g.test.tsx` (`SinoPrazos`).
- Tipos de api, web e shared sem erro. Lint dos arquivos do lote sem erro (o lint do repositório inteiro tem erros antigos e não foi refeito).
- Site: `/api/saude` ok; `GET /suporte-individual` com Admin não indicado responde 403; sem sessão, 401. Funções conferidas no banco real (0 pedidos abertos, 7 Admins candidatos).

## Não verificado
- Telas em 360, 768 e 1280 px no navegador (só jsdom + axe). Falta a indicação feita por um Master real e um Admin indicado real vendo a fila (o Master e o segundo fator são do autor).
- Checagem humana. Texto do Termo e do aviso de privacidade do espaço individual dizendo que a equipe da plataforma pode ler o pedido: fica para o L25 (parecer jurídico).

## Como voltar
- Código: `git checkout` dos arquivos do lote (ainda não commitados) ou `git revert` depois do commit; depois `docker compose up -d --build` e `docker compose restart proxy`.
- Banco: restaurar `backups/siesal-20261114-210616.dump` ou o SQL de `docs/RETORNO-0033.md`.

## Feito, Falta, Sugestões
- **Feito:** acima. **Falta:** commit do código (autor); indicar um Admin pelo Master e testar a fila nas 3 larguras; checagem humana. **Sugestões:** indicar um Admin de teste e conferir com um pedido de espaço fictício antes de usar com dado real.
