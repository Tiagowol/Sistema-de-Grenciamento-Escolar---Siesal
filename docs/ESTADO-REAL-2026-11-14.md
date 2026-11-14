# Estado real — 13/11/2026, noite (virada para 14/11)

## Onde está
- Pasta `C:\TW1-DEV\siesal-4`. Ramo de trabalho atual: **`lote-22c-admin-convites`** (no GitHub, igual ao local). Último commit de código: **`dbf1d4b`** (L22c). Ramo anterior `lote-21-22-fechamento` (também no GitHub) guarda L22a-3, L22b e L22d. **Sem merge** em `siesal-4` nem em `main` (v3 intacta). **Sem deploy.**
- Commits de código de hoje, em ordem: L22a-3 `cf31c50`, L22b `a6af13c`, L22d `9dbc69c`, L22c `dbf1d4b`.

## O que está aplicado no site local (http://localhost:18080)
- **32 migrações** (até a `0032`). Hoje entraram a 0030 (L22a-3), 0031 (árvore do Master) e 0032 (Termo 6 e revogação de convite). Backups de hoje: `backups/siesal-20261113-195212.dump` (antes da 0030), `siesal-20261113-203928.dump` (antes da 0031) e `siesal-20261113-213024.dump` (antes da 0032).
- API e site com o código do `dbf1d4b`; saúde ok; ambiente "teste" (`SIESAL_AMBIENTE`, padrão "teste").
- Matriz de permissões **v23**.

## Lotes de hoje (todos **Implementados e aplicados, não Verificados**)
- **L22a-3:** "Meu aluno" (representante legal vê tudo do menor, só leitura), agenda e disciplinas nas caixas, seção "Aluno menor" só do representante legal.
- **L22b:** árvore do Master (só leitura, com e-mail), menu das áreas e faixa de ambiente teste/produção.
- **L22d:** console do Master no mesmo menu e topo dos outros perfis (busca, Ajuda, Versão, Suporte, sino de avisos, Auditoria); Suporte e Versão em todos os perfis; teste de contrato do padrão; varredura em `docs/VARREDURA-PERFIS-L22D.md`.
- **L22c:** Admin desativa e reativa (só da própria instituição); Termo 6 no cadastro da instituição; Master revoga convite e muda o limite de alunos; Primeiros passos no primeiro acesso.

## O que está testado por máquina
- Integração 393 de 393; testes de tela e shared 1352 de 1352 (axe sem violação nas telas novas); tipos ok; lint dos arquivos de cada lote ok. O lint do repositório inteiro não foi refeito (ele já tinha erros antigos).
- Conferido no navegador (login do Master e dos perfis **simulados**, sem conta real): faixa de ambiente, menu e topo dos 6 perfis em 360, 768 e 1280 px (sem rolagem horizontal, alvos de 44 px). **Telas do L22c ainda não conferidas no navegador.**

## O que NÃO foi verificado por humano
- **Checagem humana** (leitor de tela, teclado, contraste, NAPNE) de tudo de hoje.
- **T1 a T4** do guia de testes e a tela "Pedidos de acompanhamento" no navegador (pendências abertas, do autor).
- Master real (com segundo fator) vendo a árvore, o sino e as páginas Convites e Limite com dados reais.
- Envio de e-mail real, parecer jurídico (L25; o Termo 6 é minuta v0.1).

## Próximos lotes (decididos em chat, ainda sem proposta)
- **L22e:** Auditoria do Admin da escola (decisão do autor: sim).
- **L22f:** Suporte do espaço individual atendido pelo Master ou por um Admin que o Master indicar. Hoje o pedido é gravado, mas ninguém o atende lá.
- Depois: L23a, L23b, L24, L25, L26, L27 (ver plano e adendos).

## Ritmo
- Hoje houve 6 lotes grandes (L22a-3, L22b, L22d, L22c e os anteriores L22a-2 e L22a-2b); o Adendo 4 recomenda 1 por dia. O autor autorizou cada começo. Sugestão: descansar e só fazer conferência e checagem humana amanhã.

## Resíduo no banco do site (dados fictícios)
- Contas do guia e de conferência (`rep.ficticio`, `prof.ficticio`, `ped.ficticio`, `conf.*`) e convites de teste; podem ser desativados (agora o Admin tem o botão, e o Master revoga convite).
