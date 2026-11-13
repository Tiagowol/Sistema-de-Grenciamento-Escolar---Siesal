# PROPOSTA L22b — Árvore do Master, menu das áreas e indicador de ambiente — 13/11/2026

Estado: **Planejado (proposta escrita). Nenhum código nem migração feito.** Base: A-074 (N6, decisão de 12/11: o Master vê a árvore, sem nota e sem alterar e-mail), `ADENDO-1` seção 1.3, `PLANO-L21-A-L25.md`. Pela A-071, só há código depois de "aprovo" explícito.

## Correção de registro: o L22a-3 já foi feito
O L22a-3 **não está pendente**. Está **Implementado e aplicado no site local** (A-092 a A-095): migração 0030 aplicada, commit de código `cf31c50` (só local, sem push), sem merge, sem deploy. Não é "Verificado". O trecho "L22a-3 em chat novo" do `ESTADO-REAL-2026-11-13.md` e do diário das 23:30 estava desatualizado; foi corrigido na A-096.

## O que sobrou do L22a-3 e entra neste lote (conferência, não é item novo de escopo)
1. Ver a tela "Meu aluno" no navegador em 360, 768 e 1280 px (sem rolagem horizontal, alvos de 44 px). Não foi feito.
2. Ver a tela "Pedidos de acompanhamento" (Admin e Pedagógico) no navegador. Pendência antiga, sem prazo; entra aqui porque o L22b também exige um Admin de teste e o Master com segundo fator.
3. Arrumar o 1 erro de formatação restante em `pessoa-rotas.ts` (só formato).
- **Continuam fora, por conta do autor:** T1 a T4 do guia e a checagem humana (leitor de tela, teclado, contraste, NAPNE).
- **Continuam fora, para outro lote (pedido novo se quiser):** o aluno marcar um pedido de ajuda como "só a escola"; avisos por mensagem fora do sistema.

## Estado anterior (conferido no código, 13/11)
- O Master entra por `/operacao/*` com cookie próprio e segundo fator. Roda como o papel de banco `siesal_ops`, que **não tem permissão em nenhuma tabela escolar**. Hoje só vê **números** (`contagem_por_perfil`, `espaco_individual_contar`).
- A tela do Master (`web/src/paginas/Operacao.tsx`) tem uma página só: Instituições, Espaços individuais, Convites e Trilha. Não tem menu nem árvore.
- Não existe indicador de ambiente. A API só expõe `modo_local` (cookie sem HTTPS), que não diz se é teste ou produção.

## Itens do lote (3)

1. **Árvore do Master, só leitura.**
   - Duas rotas novas, **só GET**, no console do Master (nível "completo"): `/operacao/arvore/instituicao/:id` e `/operacao/arvore/espacos`.
   - **Instituição:** pessoas agrupadas por área (Administradores, Professores, Pedagógicos/NAPNE, Alunos, Responsáveis), com **nome**, situação (ativa ou desativada) e, para aluno, "menor" ou "maior".
   - **Espaço individual:** o aluno; e, se for menor, o Responsável legal. Aluno maior: só o aluno.
   - **Aparece também o e-mail** (Q1 = B, A-097), só leitura. Para o aluno menor, aparece o e-mail do Responsável legal; se o aluno não tiver e-mail, o campo fica em branco.
   - **Nunca aparece:** nota, tarefa, agenda, mensagem, dificuldade, CPF, data de nascimento, senha. Nenhuma rota de escrita. O Master continua sem alterar nota nem e-mail.
   - **Banco:** **migração 0031**, só funções `SECURITY DEFINER` de leitura (`arvore_instituicao`, `arvore_espacos_individuais`), com `EXECUTE` só para `siesal_ops`. O `siesal_ops` continua sem ler tabela escolar. **Backup antes** (`bash scripts/backup.sh`), aplicação pelo job `migrate`, retorno em `docs/RETORNO-0031.md` (restaurar o backup, ou `DROP FUNCTION` das duas funções).
   - **Auditoria:** cada abertura de um nó vai para a trilha do Master (quem, qual instituição ou espaço, quando), **sem os nomes lidos**.
   - Sem busca por nome de aluno: o Master navega pela árvore, não procura pessoas.
   - Matriz **v22**: recurso `arvore_master`, só `ler`, `master` = `plataforma`; teste gerado.

2. **Menu das áreas no console do Master.**
   - Menu lateral no mesmo padrão do `Shell`: Instituições, Espaços individuais, Convites, Trilha, e **Árvore** com as áreas **Administradores, Professores, Pedagógicos/NAPNE, Alunos, Responsáveis, Usuários sem vínculo**.
   - "Usuários sem vínculo" = conta (pessoa) sem participação ativa em nenhum espaço; mesmos campos do item 1.
   - Teclado, foco visível, `aria-current`, menu recolhível no celular, 360/768/1280 px. O conteúdo da página atual **não muda**; só ganha o menu.
   - Sem migração além da 0031 (a área "sem vínculo" usa uma terceira função na mesma migração).

3. **Indicador de ambiente teste/produção.**
   - Faixa fixa no topo de **todas** as telas (login, escola, aluno individual, console do Master): texto + ícone + cor, nunca só cor. Teste: "Ambiente de teste. Dados fictícios." Produção: "Ambiente de produção."
   - Fonte: nova variável `SIESAL_AMBIENTE` (`teste` ou `producao`), exposta em `/config` como `ambiente`. **Padrão seguro: se faltar ou for inválida, vale "teste"**; "produção" precisa ser escrita de propósito. Entra em `.env.example` e `docker-compose.yml`.
   - **Ação manual do autor (1 linha no diário, sem segredo):** `SIESAL_AMBIENTE=teste` no `.env` do site local. Sem a linha, o padrão já é "teste".
   - Sem banco.

## Decisão já tomada (Q1, A-097)
**Q1. A árvore mostra o e-mail das pessoas?** Resposta do autor em 13/11/2026: **"Sim (B)"**. O e-mail aparece, só leitura (ajuda o atendimento; expõe e-mail de pessoa e de responsável de menor ao Master, risco aceito pelo proprietário). Isso **não é o "aprovo"** do lote.

## Padrões que valem sem nova pergunta (vetáveis no "aprovo")
- Texto literal e sem pressão. Aviso fixo na árvore: "Você está só lendo. Nota, tarefa e mensagem não aparecem aqui." Datas, quando houver, em palavra e dia/mês.
- **Responsividade:** 360, 768 e 1280 px, alvos de 44 px, sem rolagem horizontal, mesmo padrão visual do console atual.
- **Interpretação a confirmar no "aprovo":** "menu das áreas" é o menu **do console do Master**, que dá acesso à árvore por área. Se você queria o menu das áreas **no sistema escolar** (Admin, Professor, Pedagógico, Aluno, Responsável já têm menu por perfil no `Shell`), diga e eu ajusto o item 2.

## Testes (previstos)
- Master com segundo fator lê a árvore; Master sem segundo fator recebe 403; sessão escolar recebe 401 (o cookie da escola não vale).
- Nenhuma escrita: POST, PATCH e DELETE em `/operacao/arvore/*` não existem (404 ou 405).
- A resposta contém só nome, área, situação, menor/maior e e-mail; nunca CPF, nascimento, nota ou conteúdo (teste de formato fechado). Nenhuma rota altera e-mail.
- Aluno maior no espaço individual aparece sozinho; aluno menor aparece com o Responsável legal; conta desativada aparece como desativada.
- Isolamento: instituição A não mostra pessoa da B.
- `siesal_ops` continua sem `SELECT` em tabela escolar (teste de permissão do banco).
- Cada abertura de nó gera 1 evento na trilha, sem nome; varredura de injeção de SQL nas rotas novas; resposta só depois do COMMIT (F-056).
- Indicador: valor ausente ou inválido vira "teste"; a faixa aparece em todas as telas; axe sem violação.
- Lint, tipos e testes de integração e de tela passando antes de entregar; conferência em 360/768/1280 px.

## Riscos
- **Alto:** o Master passa a ver **nome de aluno menor e e-mail** de pessoas, inclusive de responsável (dado pessoal; Q1 = B). Decisão do proprietário (A-074), já com risco aceito; precisa constar no aceite do contrato de abertura de conta (L25) e no parecer jurídico. Só dados fictícios na Parte 1. O sistema diz "projetado para atender", nunca "em conformidade".
- **Médio:** as funções `SECURITY DEFINER` são o ponto sensível. Mitigação: devolvem só as colunas listadas, `EXECUTE` só para `siesal_ops`, `search_path` fixo, e teste de formato fechado.
- **Baixo:** o indicador depende de a variável estar certa. O padrão "teste" erra para o lado seguro, mas em produção real é preciso escrever `producao`; fica na lista do L24/L25.
- **Ritmo (Adendo 4):** **lote grande** (migração e leitura de dado pessoal). Hoje (13/11) já houve 3 lotes grandes; **o código só começa em 14/11 ou depois**. O Adendo 3 prevê o L22b entre 23/11 e 29/11. A proposta pode ser aprovada hoje.

## Retorno
Backup antes da 0031; `docs/RETORNO-0031.md`; `git revert` do commit do lote. O item 3 volta sozinho removendo a variável (a faixa some ou vira "teste").

## Feito, Falta, Sugestões
- **Feito:** proposta escrita; estado anterior conferido no código; pendências do L22a-3 reunidas.
- **Falta:** o "aprovo" explícito (Q1 já respondida: B) e a confirmação do que é "menu das áreas"; depois código, testes e autorizações separadas (aplicar no site, commit de código). T1 a T4 e a checagem humana seguem por sua conta.
- **Sugestões:** começar o código em 14/11 ou depois; no mesmo dia da conferência no navegador, ver "Meu aluno" e "Pedidos de acompanhamento".
