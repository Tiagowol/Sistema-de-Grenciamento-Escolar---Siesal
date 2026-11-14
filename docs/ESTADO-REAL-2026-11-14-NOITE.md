# Estado real — 14/11/2026, noite

## Onde está
- Pasta `C:\TW1-DEV\siesal-4`. Ramo de trabalho: **`lote-22c-admin-convites`**, no GitHub igual ao local (árvore limpa). **Sem merge** em `siesal-4` nem em `main` (a v3 segue intacta). **Sem deploy** fora do computador do autor.
- Commits de código do L22 em ordem: L22a-3 `cf31c50`, L22b `a6af13c`, L22d `9dbc69c`, L22c `dbf1d4b`, **L22e `1b4fa6e`** (separado do L22c, como combinado), **L22g `08c57e2`** (menu lateral; separado do L22e).
- Commits de docs de hoje, do mais novo: `f6b6820` (proposta do L22g, A-121), `400413a` (A-120), `eed1ad1` (verificação do L22e, A-119), `d83b381` (A-118), `3e3fd7e` (proposta do L22e, A-117), `4a1152e` (verificação do L22c, A-116, F-059), `b37d52d`.

## O que está aplicado no site local (http://localhost:18080)
- **32 migrações** (até a `0032_admin_convites`), conferidas no banco. O L22e **não tem migração**. Backup mais recente: `backups/siesal-20261113-213024.dump` (antes da 0032).
- API com o código do `1b4fa6e`; site (`web`) com o código do `08c57e2` (reconstruído e proxy reiniciado em 14/11, duas vezes: L22e e L22g; `/` e `/pessoa` respondem 200, `/api/saude` com status ok e banco ok, `/api/auditoria` sem sessão responde 401).
- Matriz de permissões **v23** (sem mudança no L22e: a regra `auditoria.ler` do Admin já existia).
- Ambiente "teste" (`SIESAL_AMBIENTE`).

## O que o L22g faz (resumo)
- Menu lateral: a barra de rolagem some (a rolagem continua por roda, toque e Tab), com sombra suave no pé quando há itens abaixo; ícone próprio por item (8 novos; nenhum repetido no menu de cada perfil, incluindo o Master); item de duas linhas alinhado. Só CSS, ícones, efeito do `Shell` e testes; sem API, banco, migração ou matriz. Verificação: `docs/VERIFICACAO-L22G.md` (telas e shared 1433/1433, tipos e lint dos 5 arquivos ok, 360/768/1280 px e Tab conferidos; Firefox e Safari não testados).

## O que o L22e faz (resumo)
- Tela "Auditoria" no menu do Admin, só leitura, só da própria instituição, 50 registros por vez. Mostra ações administrativas e entradas, falhas, bloqueios e saídas **da equipe** (Admin, Professor, Pedagógico). **Nunca** mostra eventos de aluno, responsável, pessoa ou anônimo, nem o conteúdo `antes`/`depois`. Abrir a tela grava `auditoria.leitura`. Faixa "Cadeia íntegra: sim/não".
- Mais estrito que a proposta: `responsavel.autorizou`, `representante.aluno_criado` e `conta.criada_aguardando_responsavel` não aparecem (quem faz é o responsável ou o aluno).

## O que está testado por máquina
- Integração (L22e; a API não mudou depois): **400 de 400** (32 arquivos; 7 testes novos da auditoria). Telas e shared: **1433 de 1433** (43 arquivos, com o L22g). Tipos de api, web e shared sem erro. Lint dos 13 arquivos do L22e sem erro; o lint do repositório inteiro tem erros antigos (95) e **não foi refeito**.
- Conferência das telas em 360, 768 e 1280 px (código real, API simulada): L22c em `docs/VERIFICACAO-L22C.md`, L22e em `docs/VERIFICACAO-L22E.md`.

## O que NÃO foi verificado por humano (nada é "Verificado")
- **Checagem humana** do L22c, do L22e e do L22g (menu em Firefox e Safari incluído): leitor de tela, teclado, contraste, NAPNE.
- **Tela "Auditoria" com um Admin real** (com segundo fator) e as telas do Master real (Convites, Limite de alunos).
- **T1 a T4** do guia de testes e a tela "Pedidos de acompanhamento" no navegador.
- Parecer jurídico (L25; o Termo 6 é a minuta v0.1).

## Abertos
- **F-059:** a página de Usuários alarga para cerca de 690 px em 360 px de largura (já existia antes do L22c). Sem correção; decisão do autor.
- **Contraste 4,42:1** (pedido: 4,5:1) no texto cinza `#64748b` sobre `#f4f7fb` (subtítulo do título e marca). Sem correção; decisão do autor.
- **Observação A3:** foco volta ao início da página depois de Desativar, Revogar e Entendi (no Chrome o Tab continua do ponto certo); leitor de tela fica para a checagem humana.
- **L22f (Suporte do espaço individual atendido pelo Master ou por Admin indicado):** **proposta escrita** em `docs/PROPOSTA-L22F.md` (A-127, commit `e9397f3`); 3 itens; **precisa de migração 0033** (tabela `atendente_suporte` e 3 funções `SECURITY DEFINER`, com backup e `RETORNO-0033.md`) e de matriz v24. Falta o autor responder a **Q1** (o que o atendente vê de quem pediu; recomendada A: nome e e-mail) e dar o **"aprovo"** separadamente. Recomendação do Code: código só em 15/11 ou depois, e só depois da checagem humana dos lotes de hoje. Sem código.

## Próximos passos, em ordem (para a próxima sessão)
1. **Autor:** checagem humana do L22c, L22e e L22g (leitor de tela, teclado, contraste, NAPNE; menu em Firefox e Safari), testes T1 a T4 e a tela "Auditoria" como Admin. Defeito achado vem antes de novo lote.
2. **Autor:** decidir sobre a F-059 e o contraste 4,42:1 (hoje sem proposta; o Code escreve se o autor pedir).
3. **Autor:** ler `docs/PROPOSTA-L22F.md`, responder a Q1 e dar o "aprovo". **Code:** só então migração 0033 (backup antes), código, testes e conferência em 360, 768 e 1280 px.
4. Merge em `siesal-4` e deploy fora do computador: só com autorizações separadas (nada pedido ainda).

## Ritmo
- Hoje (14/11) houve três lotes de código (L22c, L22e e L22g) e a conferência do L22c. O Adendo 4 recomenda um lote por dia. Sugestão: amanhã, checagem humana e decisão sobre o L22g e a F-059.

## Resíduo no banco do site (dados fictícios)
- Contas do guia e de conferência (`rep.ficticio`, `prof.ficticio`, `ped.ficticio`, `conf.*`) e convites de teste; o Admin agora desativa contas e o Master revoga convites. Nenhum evento `auditoria.leitura` foi gravado ainda (ninguém abriu a tela).

## Como voltar
- **Código do L22g:** `git revert 08c57e2`, depois `docker compose up -d --build` e `docker compose restart proxy`.
- **Código do L22e:** `git revert 1b4fa6e` (sem migração; o banco não muda). Depois reconstruir: `docker compose up -d --build` e `docker compose restart proxy`.
- **Código do L22c:** `git revert dbf1d4b`; banco: restaurar `backups/siesal-20261113-213024.dump` ou seguir `docs/RETORNO-0032.md`.
- **Docs:** `git revert` do commit de docs correspondente.
