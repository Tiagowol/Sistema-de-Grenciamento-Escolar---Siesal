# PROPOSTA L22d — Mesmo padrão de menu e topo para TODOS os perfis — 14/11/2026

Estado: **Planejado (proposta escrita). Nenhum código nem migração feito.** Pedidos do autor em chat (13/11/2026): "faltou no menu a opção de auditoria, busca no menu, ajuda, versão, suporte, e no topo avisos (sinos)" e "todos os perfis têm que atender o mesmo padrão". O número é **L22d** porque **L22c já existe** (Admin cria e desativa, revogar convite, manual por destinatário, tela do limite de alunos) e **não muda**. Pela A-071, só há código depois de "aprovo" explícito.

## Estado anterior (conferido no código)
- **Perfis da escola e espaço individual** (aluno, professor, pedagógico, Admin, responsável) já usam **um só componente**, o `Shell` (`web/src/componentes/Shell.tsx`): barra lateral com marca, **busca no menu**, itens por perfil, **Ajuda** e **Sino de Mensagens** no topo, **Acessibilidade**, **Minha conta** (onde fica o "Pedir suporte") e botão Sair.
- **Master (`/gestao`)** é a exceção: tela própria. Depois do ajuste de 13/11 (A-103, ainda sem commit) tem a barra lateral e o topo no mesmo visual, mas **faltam** busca no menu, Ajuda, Versão, Suporte, Auditoria como item de menu (hoje a "Trilha do Master" está no fim da página Instituições) e os sinos.
- **Versão:** **nenhum perfil** mostra a versão do sistema hoje (só `MANUAL_VERSAO` dentro da Ajuda). É lacuna de **todos**.
- **Suporte:** só existe dentro de "Minha conta" (formulário "Pedir suporte"); não é item de menu em nenhum perfil.
- **Sinos:** "Mensagens" para todos os perfis da escola (se o módulo estiver ligado); "Prazos" só para o aluno (regra de produto: tempo concreto para o aluno). O Master não tem sino.

## Itens do lote (3)

1. **O console do Master passa a usar o mesmo `Shell`.** Em vez de um menu paralelo, o `Shell` recebe a lista de itens (por perfil, incluindo `master`). Itens do Master: Instituições; **Auditoria** (a trilha, em página própria, com a conferência de integridade); Árvore (6 áreas); Ajuda; **Suporte**; Acessibilidade. Com isso o Master ganha, sem código duplicado: busca no menu, Ajuda no topo, sinos, Versão e o mesmo visual. A chamada ao banco continua por `/operacao/*` (cookie próprio do Master); o Master **continua sem dado escolar** além da árvore (A-074, A-097).

2. **Padrão comum para os 6 perfis (aluno é a referência), com teste de contrato.**
   - **Todo perfil tem:** busca no menu; Ajuda (menu e topo); **Suporte** como item de menu; **Versão** (no rodapé do menu e na Ajuda); sino **Avisos** no topo; Acessibilidade; Minha conta e Sair (Master: Sair e sem "Minha conta", que é da pessoa da escola).
   - **O que muda por perfil continua sendo só o conteúdo** (tabela abaixo), nunca a estrutura: o "Prazos" continua só do aluno; Personalizar, Modo foco e Cards continuam só do aluno.
   - **Suporte (perfis da escola):** item de menu que abre o mesmo formulário que hoje está em "Minha conta" (sem tabela nova, sem migração).
   - **Versão:** constante `web/src/versao.ts` (ex.: "SIESAL 4.0, Parte 1, lote L22d"), atualizada a cada lote. Sem banco.
   - **Teste de contrato:** uma lista única (perfil × elemento) gera um teste que **falha** se algum perfil ficar sem busca, Ajuda, Suporte, Versão ou sino; e se um perfil ganhar item que a matriz de permissões nega.

3. **Varredura de todos os perfis no navegador, com relatório.** Para cada perfil (aluno, professor, pedagógico, Admin, responsável em escola e em espaço individual, Master): conferir em 360, 768 e 1280 px (sem rolagem horizontal, alvos de 44 px, mesmo padrão visual), com contas de conferência fictícias. O que estiver fora do padrão vira **correção no próprio lote** se for pequeno (visual, rótulo, ordem) e **item do próximo lote** se mexer em regra ou banco. Entrega: `docs/VARREDURA-PERFIS-L22D.md` com a tabela do que aparece por perfil.

## O que aparece em cada perfil (a confirmar no "aprovo")
| Elemento | Aluno | Professor | Pedagógico | Admin | Responsável | Master |
| --- | --- | --- | --- | --- | --- | --- |
| Busca no menu, Ajuda, Versão, Suporte, Acessibilidade | sim | sim | sim | sim | sim | sim |
| Sino Avisos (mensagens) | sim | sim | sim | sim | sim | sim (da plataforma, ver Q1) |
| Sino Prazos | sim | não | não | não | não | não |
| Minha conta | sim | sim | sim | sim | sim | não |
| Auditoria como item de menu | não | não | a decidir (Q2, fora deste lote) | a decidir (Q2, fora deste lote) | não | sim |
| Conteúdo próprio | Meu dia, Atividades, Agenda, Calendário, Personalizar, Foco, Cards, Notas | Início, Notas da turma, Calendário da escola | Início, Acompanhamento, Pedidos de acompanhamento, Notas oficiais, Avisos da escola, Calendário da escola | Início, Pedidos de acompanhamento, Usuários, Turmas, Regras, Identidade, Notas oficiais, Avisos da escola, Calendário da escola | Início, Meu aluno, Quem pode ver meus dados, Notas oficiais, Calendário da escola | Instituições, Auditoria, Árvore |

## Decisão que depende do autor (uma pergunta fechada)
**Q1. O que são "Suporte" e "Avisos" (sinos) do Master?**
- **A (recomendada):** **Suporte** = página de texto literal (como pedir ajuda da plataforma, o que o Master vê e o que não vê), sem formulário e sem banco. **Avisos** = sino "Avisos da plataforma", calculado dos dados que o Master já pode ler: convites de instituição esperando uso ou vencendo, instituição em implantação, trilha com problema de integridade. Só números e nomes de instituição, **sem migração**.
- **B:** o Master entra no padrão, mas **sem** sino e **sem** Suporte (só busca, Ajuda, Versão, Auditoria). Mais simples, contraria o pedido de "todos iguais".

> Se você responder só "aprovo", **vale a A**.

**Q2 (não bloqueia este lote; registrada para depois):** o **Admin da escola** (e o Pedagógico) deve ter "Auditoria" no menu? A matriz já permite leitura da auditoria da própria instituição ao Admin, mas não existe tela. Se sim, vira lote próprio (L22e), com proposta.

## Padrões que valem sem nova pergunta
- Texto literal, sem pressão. Datas em palavra e dia/mês. Responsividade em 360, 768 e 1280 px, alvos de 44 px, sem rolagem horizontal.
- Sem migração neste lote. Sem rota nova de escrita. Matriz de permissões **sem mudança de versão**, salvo se o item "Suporte" do menu exigir recurso novo (hoje `pedidos_suporte` já cobre).

## Testes (previstos)
- Teste de contrato perfil × elemento (item 2). Teste de tela do `Shell` com perfil `master`. Axe sem violação em todas as telas tocadas. Busca no menu do Master acha só itens do Master. Sino da plataforma não mostra dado escolar. Os testes atuais do Master (`operacao.test.tsx`) e dos outros perfis continuam passando. Lint, tipos e testes antes de entregar.

## Riscos
- **Médio:** refatorar o `Shell` para aceitar o Master pode quebrar telas dos outros perfis. Mitigação: o teste de contrato e os testes de tela existentes (1268) rodam antes e depois; mudança só aditiva.
- **Baixo:** a "versão" é um texto manual; pode ficar desatualizada. Mitigação: entra na lista de fechamento de cada lote.
- **Ritmo (Adendo 4):** **lote grande** (reorganiza a estrutura de todas as telas). Pode ser aprovado hoje; o código só a partir de **14/11** (hoje já houve 4 lotes grandes), salvo ordem do autor.

## Retorno
`git revert` do commit do lote. Sem banco, nada a restaurar.

## Feito, Falta, Sugestões
- **Feito:** proposta escrita; padrão atual e lacunas conferidos no código.
- **Falta:** seu "aprovo" (e Q1, ou só "aprovo" = A); depois código, testes, varredura no navegador e as autorizações separadas (commit de código, merge, deploy). O ajuste de menu do Master de 13/11 (A-103) ainda não foi commitado.
- **Sugestões:** aprovar com a A; fazer o L22d em 14/11 ou depois; decidir a Q2 quando o L22c estiver pronto.
