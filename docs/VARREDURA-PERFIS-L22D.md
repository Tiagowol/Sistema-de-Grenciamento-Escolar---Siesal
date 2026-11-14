# VARREDURA DOS PERFIS — L22d — 13/11/2026

Estado: **Implementado e aplicado no site local (só o contêiner `web`), não Verificado.** Método: navegador do app em 360, 768 e 1280 px, com a entrada e as respostas de cada perfil **simuladas no navegador** (nenhuma conta real, nenhum dado de aluno, banco intocado). A varredura confere **estrutura, menu, topo, rolagem e alvos de toque**. O **conteúdo de cada tela** continua coberto pelos testes de tela e de integração.

## Padrão (referência: aluno) e resultado
| Elemento | Aluno | Professor | Pedagógico | Admin | Responsável | Master |
| --- | --- | --- | --- | --- | --- | --- |
| Busca no menu | sim | sim | sim | sim | sim | sim |
| Ajuda (menu e topo) | sim | sim | sim | sim | sim | sim |
| Suporte (item de menu) | sim | sim | sim | sim | sim | sim (texto) |
| Acessibilidade | sim | sim | sim | sim | sim | sim |
| Minha conta | sim | sim | sim | sim | sim | não (não tem conta de escola) |
| Versão no rodapé do menu e na Ajuda | sim | sim | sim | sim | sim | sim |
| Sino de mensagens / avisos | sim | sim | sim | sim | sim | sim (Avisos da plataforma) |
| Sino de prazos | sim | não | não | não | não | não |
| Faixa de ambiente | sim | sim | sim | sim | sim | sim |
| Sem rolagem horizontal; alvos de 44 px (360, 768, 1280) | sim | sim | sim | sim | sim | sim |

## Menu de cada perfil (o que aparece)
- **Aluno (escola):** Meu dia, Atividades, Agenda, Calendário, Personalizar, Modo foco, Cards de resumo, Notas, Notas oficiais, Avisos, Suporte, Acessibilidade, Minha conta, Ajuda. **Aluno (espaço individual):** sem Notas oficiais; com Quem pode ver meus dados.
- **Professor:** Início, Notas da turma, Calendário da escola, Suporte, Acessibilidade, Minha conta, Ajuda.
- **Pedagógico:** Início, Acompanhamento, Pedidos de acompanhamento, Notas oficiais, Avisos da escola, Calendário da escola, + comuns.
- **Admin:** Início, Pedidos de acompanhamento, Notas oficiais, Avisos da escola, Usuários, Turmas e vínculos, Calendário da escola, Regras de notas, Identidade da escola, + comuns.
- **Responsável (escola):** Início, Notas oficiais, Calendário da escola, + comuns. **Responsável (espaço individual):** Início, Meu aluno, Quem pode ver meus dados, + comuns.
- **Master:** Instituições, Auditoria, Árvore (Administradores, Professores, Pedagógicos e NAPNE, Alunos, Responsáveis, Usuários sem vínculo), Suporte, Acessibilidade, Ajuda.

## Fora do padrão encontrado e corrigido neste lote
1. **Responsável no espaço individual** viam "Notas oficiais" e "Calendário da escola", que não existem sem escola (o aluno individual já não via). Corrigido: os dois itens só aparecem na escola. Teste novo.
2. **Todos os perfis** não tinham **Suporte** como item de menu nem **Versão** visível. Corrigido (item 2 da proposta).
3. **Master** sem busca no menu, Ajuda, Suporte, Versão, Auditoria como item e sino. Corrigido (item 1 da proposta): o console usa o mesmo `Shell` dos outros perfis.

## Fora do padrão que NÃO foi mexido (para decidir)
- **Suporte no espaço individual:** o formulário grava um pedido, mas **não há Admin nem Pedagógico** no espaço individual para atendê-lo (já era assim em "Minha conta"). Sugestão: no próximo lote, decidir quem atende (suporte da plataforma?) ou o que a tela diz nesse caso.
- **Auditoria para o Admin da escola (Q2 da proposta):** a matriz permite, não existe tela. Lote próprio (L22e), se você quiser.
- **Perfis "Pedagógico" e "Professor" sem "Avisos" como no aluno:** é por desenho (aluno recebe avisos; eles publicam ou recebem pelo sino de mensagens). Sem mudança.
- **Login de verdade por perfil** (contas de conferência no banco), leitor de tela, teclado e contraste: continuam na **checagem humana** (do autor).

## Verificação por máquina
Testes de tela 1289 de 1289 (inclui o teste de contrato dos 5 perfis da escola e do espaço individual, e os 5 testes novos do console do Master); axe sem violação; tipos ok; arquivos novos formatados. Integração da API não mudou (sem alteração na API).

## Feito, Falta, Sugestões
- **Feito:** o que está acima.
- **Falta:** você entrar como Master real (segundo fator) e ver a árvore e o sino com dados reais; checagem humana; commit de código (autorização separada).
- **Sugestões:** decidir o Suporte do espaço individual e a Q2 antes do L22c.
