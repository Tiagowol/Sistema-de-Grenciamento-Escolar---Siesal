# PROPOSTA L22c — Admin desativa, revogar convite, limite de alunos e primeiros passos — 13/11/2026

Estado: **Planejado (proposta escrita). Nenhum código nem migração feito.** Base: `PLANO-FECHAMENTO-PARTE-1` (L22c), `PLANO-L21-A-L25`, Adendo 3 (L22c), Termo 6 da minuta (`TERMOS-DE-ACEITE-MINUTA-v0.1`), diário de 13/11 (tela do limite de alunos), pedido do autor em chat ("o próximo lote do plano é o L22c, agora"). Ramo de trabalho: `lote-22c-admin-convites`. Pela A-071, só há código depois de "aprovo" explícito.

## Estado anterior (conferido no código)
- **Admin e usuários:** a tela "Usuários" **cria** conta (com senha provisória) e gera **nova senha provisória**. **Não existe desativar nem reativar** conta. As rotas são `GET/POST /usuarios` e `POST /usuarios/:id/senha-provisoria`; a RLS por instituição já impede o Admin de alcançar outra instituição.
- **Convites do Master** (`convite_individual`, tipos "individual" e "instituição"): o Master só vê **números** (esperando, usados, vencidos). **Não existe revogar**: a tabela não tem coluna de revogação. O código aparece uma vez, na criação.
- **Limite de alunos por representante:** guardado em `configuracao_plataforma` (valor 5), lido por `plataforma_limite_alunos()`. **Não há tela**: hoje só muda pelo banco.
- **Termo 6 (instituição/Admin):** consta na minuta; **não há aceite no cadastro da instituição** (o cadastro por convite de instituição não pede aceite nem guarda versão do termo).
- **Manual:** a Ajuda mostra os tópicos do perfil, mas a pessoa só os vê se abrir a Ajuda; nada aparece sozinho no primeiro acesso.

## Itens do lote (3)

1. **Admin desativa e reativa, só da própria instituição; aceite do Termo 6.**
   - Rotas `POST /usuarios/:id/desativar` e `/reativar` (só `admin`). Na tela "Usuários": botão "Desativar" e "Reativar" por pessoa, com confirmação em texto simples (sem apagar nada: usa `desativado_em`).
   - **Regras:** o Admin **não desativa a si mesmo** nem o **último Admin ativo** da instituição; ao desativar, as **sessões da pessoa são encerradas**; vai para a **auditoria** (`usuario.desativado`, `usuario.reativado`). Alvo de outra instituição = 404 (teste de isolamento).
   - **Termo 6:** o cadastro da instituição (link de convite de instituição) passa a pedir o aceite do Termo 6 (texto da minuta v0.1, com a ressalva "minuta, sem parecer jurídico") e **guarda versão e data** na instituição. **Migração 0032** (colunas `termo_versao` e `termo_aceito_em` em `instituicao`).

2. **Master: revogar convite (com auditoria) e tela do limite de alunos.**
   - **Convites:** a tela do Master passa a **listar os convites esperando uso** (tipo, criado em e válido até, em palavra e dia/mês; **nunca o código**) com o botão **"Revogar"**. Revogar grava na auditoria do Master (`convite.revogado`) e o convite deixa de valer na hora (o cadastro responde "convite inválido ou vencido"). **Migração 0032:** coluna `revogado_em` em `convite_individual`, o `espaco_individual_criar` e o cadastro de instituição passam a recusar convite revogado; `siesal_ops` ganha `UPDATE` só nessa coluna.
   - **Limite de alunos:** nova página no console do Master, "Limite de alunos por representante", com o valor atual, de 1 a 20, e botão Salvar. Grava na auditoria (`limite_alunos.mudado`, com o valor novo). Sem migração (a tabela e a função já existem; `siesal_ops` já grava a configuração).

3. **Primeiros passos: manual automático por tipo de destinatário.**
   - No **primeiro acesso de cada perfil** (aluno, professor, pedagógico, Admin, responsável, Master), aparece um cartão **"Primeiros passos"** no Início com os 3 a 5 tópicos mais importantes **do manual daquele perfil** (o mesmo texto da Ajuda, sem texto novo duplicado). A pessoa pode **fechar** ("Entendi") e reabrir pela Ajuda. Texto literal, sem pressão.
   - **Onde fica guardado que já viu:** neste aparelho (`localStorage`), sem banco. Limitação: em outro aparelho o cartão aparece de novo. Se preferir guardar na conta, vira migração (Q1).

## Decisões do autor registradas (A-111), fora deste lote
- **Quem atende o Suporte no espaço individual:** o **Master**, ou **um Admin que o Master indicar**. Vira o lote **L22f** (precisa de proposta própria: como o Master indica o Admin, onde o pedido chega, sino e tela de atendimento, migração).
- **Auditoria para o Admin da escola (Q2 do L22d):** **sim**. Vira o lote **L22e**, depois deste (tela de auditoria da própria instituição, só leitura, sem nota e sem conteúdo).

## Decisão que depende do autor (uma pergunta fechada)
**Q1. Onde guardar "já vi os Primeiros passos"?**
- **A (recomendada):** **neste aparelho** (`localStorage`), sem banco. Mais simples e sem dado novo; no máximo o cartão reaparece em outro aparelho.
- **B:** **na conta** (nova coluna), vale em qualquer aparelho. Exige mais uma migração e mais um dado por pessoa.

> Se você responder só "aprovo", **vale a A**.

## O que muda no banco
- **Migração 0032:** (a) `instituicao.termo_versao` e `instituicao.termo_aceito_em`; (b) `convite_individual.revogado_em` e `revogado_por`; (c) `UPDATE` de `siesal_ops` só nessas colunas de convite; (d) `espaco_individual_criar` e o cadastro de instituição passam a recusar convite revogado. **Sem tabela nova.** Backup antes (`bash scripts/backup.sh`), aplicação pelo job `migrate`, retorno em `docs/RETORNO-0032.md` (restaurar o backup; ou remover as colunas e recriar as 2 funções pelo texto das migrações 0020 e do cadastro de instituição).
- Matriz de permissões **v23:** `usuarios` ganha `desativar` e `reativar` só para `admin` (escopo `instituicao`); recurso `convites_plataforma` (`revogar`, só `master`) e `configuracao_plataforma` (`administrar`, só `master`), com testes gerados.

## Padrões que valem sem nova pergunta
- Texto literal, sem pressão. Datas em palavra e dia/mês. Sem número solto de tempo. Responsividade em 360, 768 e 1280 px, alvos de 44 px, sem rolagem horizontal, mesmo menu e topo do sistema (L22d).
- Nenhum segredo ou código de convite em tela, log ou auditoria (a auditoria guarda só o id do convite).

## Testes (previstos)
- **Desativar:** Admin desativa e reativa gente da própria instituição; **não alcança outra instituição** (404); não desativa a si nem o último Admin; sessão da pessoa cai na hora; pessoa desativada não entra; professor, aluno, pedagógico e responsável recebem 403; auditoria de cada ação.
- **Convite:** revogado não cria conta (individual e de instituição); revogar convite já usado ou já vencido é recusado com texto claro; listagem nunca traz o código nem o hash; sem sessão de Master = 401; auditoria sem o código.
- **Limite:** só Master muda; valor fora de 1 a 20 = 400; o representante no limite recebe a mensagem de suporte; subir o limite libera.
- **Termo 6:** cadastro de instituição sem aceite é recusado; com aceite guarda versão e data.
- **Primeiros passos:** aparece uma vez por perfil e some ao fechar; reabre pela Ajuda; axe sem violação.
- Varredura de injeção de SQL nas rotas novas; resposta só depois do COMMIT (F-056); matriz v23 gera os testes. Lint, tipos, testes de integração e de tela passando antes de entregar; conferência no navegador em 360/768/1280 px.

## Riscos
- **Alto:** desativar conta é ação com efeito imediato; um erro poderia deixar a escola sem Admin. Mitigação: regra do último Admin, confirmação em texto e reativação simples.
- **Médio:** revogar convite não pode vazar o código. Mitigação: a lista usa só id, tipo e datas.
- **Médio:** o Termo 6 é **minuta sem parecer jurídico**; o aceite no código usa "projetado para atender" e registra a versão do texto. O parecer jurídico segue no L25.
- **Baixo:** "Primeiros passos" neste aparelho pode reaparecer em outro (Q1).
- **Ritmo (Adendo 4):** **lote grande** (migração e 3 frentes). Hoje (13/11) já houve 5 lotes grandes; o código só começa em 14/11 ou depois, **salvo ordem do autor**. O plano permite cortar o item 3 se faltar tempo, com a sua decisão.

## Retorno
Backup antes da 0032; `docs/RETORNO-0032.md`; `git revert` do commit do lote. O Termo 6 e os convites revogados não somem com o retorno do código; por isso o retorno do banco é o backup.

## Feito, Falta, Sugestões
- **Feito:** proposta escrita; estado anterior conferido no código; decisões do autor sobre Suporte do espaço individual (L22f) e Auditoria do Admin (L22e) registradas como lotes planejados.
- **Falta:** seu "aprovo" (Q1, ou só "aprovo" = A); depois código, testes e as autorizações separadas (backup e aplicação da 0032, commit de código, merge, deploy). Seguem por sua conta: checagem humana e T1 a T4.
- **Sugestões:** aprovar com a A; começar o código em 14/11 ou depois; depois do L22c, fazer L22e e L22f nessa ordem.
