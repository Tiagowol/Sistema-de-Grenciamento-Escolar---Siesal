# PROPOSTA L22e — Auditoria do Admin da escola — 14/11/2026

Estado: **Planejado (proposta escrita). Nenhum código nem migração feito.** Origem: decisão do autor em 14/11/2026 (A-111, "Auditoria para o Admin da escola: sim"; Q2 da proposta do L22d) e "Não, seguir L22e" (14/11, noite). Pela A-071, só há código depois de "aprovo" explícito. Um lote por vez; este tem **1 item**.

## Estado anterior (conferido no código)
- **Matriz:** `shared/src/permissoes.json` já diz `auditoria.ler`: Master na plataforma e **Admin na instituição**. Nenhuma outra tela ou rota usa essa permissão para o Admin: **não existe tela, rota nem item de menu**.
- **Banco:** `auditoria_evento` (migração 0002) é por instituição, append-only, com cadeia de hash e RLS: o `siesal_app` só lê a cadeia da instituição do contexto. A função `auditoria_verificar()` já devolve "íntegra ou não" por instituição. **Não precisa de migração.**
- **Master:** tem a tela "Auditoria" (trilha do Master, 100 eventos, com "íntegra: sim/não"). É outra tabela (`operator_auditoria`) e outro perfil; **não muda**.
- **Conteúdo da tabela da escola:** além de eventos administrativos (`usuario.criado`, `usuario.desativado`, `usuario.reativado`, `usuario.senha_redefinida`, `instituicao.criada_por_convite`, `responsavel.autorizou`, `representante.aluno_criado`), ela guarda eventos **da vida do aluno**: `tarefa.criada`, `tarefa.concluida`, `nota_pessoal.criada`, `dificuldade.alterada`, `plano.gerado`, `auth.login_ok` e outros. O campo `antes`/`depois` pode ter o conteúdo.
- **[Fato]** Mostrar a tabela inteira ao Admin **violaria** a regra do produto (sem comparação, sem vigilância do aluno menor, sem conteúdo do aluno). Por isso o risco deste lote é **o que NÃO mostrar**, não a tela.

## Item do lote (1)
**Tela "Auditoria" no menu do Admin: só leitura, só ações administrativas da própria instituição.**
- **Menu:** novo item "Auditoria" no Admin (no mesmo padrão do menu dos outros perfis, L22d). Só o Admin; Pedagógico, Professor, Aluno e Responsável não ganham a tela.
- **O que a tela mostra:** lista dos últimos eventos, do mais novo para o mais velho, 50 por vez, com botão "Ver eventos mais antigos". Cada linha: **quando** ("hoje", "ontem" ou dia/mês, e a hora pequena ao lado), **quem fez** (nome da pessoa, nunca o identificador), **o que foi feito** (frase em português, ex.: "Desativou a conta de Aluno Fictício"), **em quem** (nome). Uma faixa no topo: "Cadeia íntegra: sim" ou "não" (usa `auditoria_verificar()`).
- **O que a tela NUNCA mostra:** o conteúdo `antes`/`depois`; notas, tarefas, notas pessoais, dificuldade, planos; endereços de IP; códigos; nenhuma busca por aluno; nenhuma contagem por aluno, ranking ou comparação.
- **Quais eventos entram (critério, lista fechada no código):** só ações **administrativas da instituição**: criar, desativar, reativar e redefinir senha de conta (Admin e equipe), criação de aluno e de conta por convite, autorização do responsável, criação da instituição por convite, e mudanças de configuração da escola (turmas, vínculos, identidade, módulos) que já são auditadas. **Ficam de fora**: tudo que nasce do uso do aluno e `auth.*` de aluno (entrada, saída, falha de login) — vigiar a atividade do aluno menor não é papel desta tela. A lista exata de ações vai para o código como **lista permitida (deny by default)**: ação nova não aparece até alguém incluí-la, com teste.
- **Rótulos:** cada ação tem uma frase fixa em português; ação sem frase não aparece. Texto literal, sem pressão.
- **Registro da leitura:** abrir a tela grava um evento `auditoria.leitura` na cadeia da instituição (quem abriu, quando; nunca o que viu), no mesmo espírito de `acompanhamento.leitura` e da árvore do Master. Esse evento aparece na lista como "Abriu a tela de auditoria".
- **Rota:** `GET /auditoria` (somente leitura, sem corpo, sem escrita), com a permissão `auditoria.ler`. O Admin **só** vê a própria instituição (RLS + `withTenant`). O Master continua sem ver esta lista pelo Admin; ele tem a dele.
- **Tela:** mesmo padrão visual e mesma responsividade; teste em 360, 768 e 1280 px, alvos de 44 px, sem rolagem horizontal (nada de tabela larga: **cartões em telas estreitas**, para não repetir a F-059). axe nas telas novas. "Primeiros passos" e Ajuda do Admin ganham 1 tópico curto sobre a Auditoria.
- **Matriz:** sem mudança na regra (já existe). Entra um teste gerado pela matriz: Professor, Aluno, Pedagógico e Responsável recebem 403 na rota.

## Testes que o lote precisa passar (critérios de "terminou")
1. Admin vê só eventos da **própria** instituição (teste de integração com duas instituições).
2. Nenhum evento de aluno (`tarefa.*`, `nota_pessoal.*`, `dificuldade.*`, `plano.*`, `auth.*`) aparece, e `antes`/`depois` nunca saem na resposta.
3. Professor, Pedagógico, Aluno, Responsável e pessoa sem sessão: 403 ou 401.
4. A abertura da tela grava `auditoria.leitura`.
5. "Cadeia íntegra" responde certo com a cadeia boa e com uma cadeia adulterada de teste.
6. Tela: axe sem violação; 360, 768 e 1280 px sem rolagem horizontal; teclado e foco visível.

## Fora do lote
- Auditoria para Pedagógico ou Professor (nenhum pedido).
- Exportar, filtrar por pessoa, apagar ou "marcar como lido".
- Suporte do espaço individual (é o **L22f**).
- Corrigir a F-059 (tabela de Usuários em 360 px) e o contraste 4,42:1: ficam em lote de defeito à parte, se o autor quiser.

## Riscos e custo
- **[Fato]** Sem migração e sem mudança de matriz: risco baixo no banco.
- **[Estimativa]** Meio dia de código e testes. Não está entre os "nunca cortar" do Adendo 3; pode ser adiado sem quebrar nada.
- **Risco principal:** esquecer um evento do aluno na lista permitida. Mitigação: lista permitida (não proibida) e o teste 2.

## Pergunta (1, fechada)
**Q1 — Quais eventos o Admin vê?**
- **A (recomendada):** só ações administrativas da instituição, como descrito acima (contas, convites, autorizações, configurações). Nada da vida do aluno.
- B: A mais os logins e bloqueios de login **da equipe** (Admin, Professor, Pedagógico), nunca de aluno.
- C: tudo que está na cadeia, sem o conteúdo `antes`/`depois`. **Não recomendo:** mostra a atividade do aluno menor.

## Feito, Falta, Sugestões
- **Feito:** estado anterior conferido no código e na matriz; proposta escrita; risco de privacidade identificado (eventos do aluno na mesma tabela).
- **Falta:** resposta do autor à Q1 e "aprovo" explícito. Depois, código, testes e conferência nas 3 larguras. Merge e deploy só com autorizações separadas.
- **Sugestões:** aprovar com a A; fazer o L22e em um dia de descanso do ritmo (Adendo 4); decidir a F-059 antes ou depois deste lote.
