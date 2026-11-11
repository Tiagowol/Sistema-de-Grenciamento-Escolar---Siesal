# Plano do L19 — Admin institucional (proposta, 10/11/2026)

Aprovado para execução em A-036; esta proposta precisa do "sim" do autor antes do código (A-038).
Ramo: `lote-19-admin`, criado a partir do `lote-17d-rotulos-libras` (`592a459`), porque o merge do L17d em `siesal-4` ainda não foi autorizado.
Estado: **Implementado** (10/11/2026; aprovado em A-039, ajustes em A-040). Nada é "Verificado" antes do retorno do NAPNE e do professor (12/11/2026).

## Estado anterior (conferido em 10/11/2026)
- `evento` (0006 e 0011) é por aluno (`usuario_id`) e já aceita `origem = 'calendario_escolar'`; o Calendário já mostra selo de origem. Não existe evento de turma nem evento da instituição.
- Notas (0008): cada nota tem versões (0 a 10, uma casa). Não existem períodos, pesos, arredondamento nem regra.
- `instituicao` tem só `nome` e `situacao` (ativa, suspensa). Não há logotipo nem cores.
- Personalização do aluno (L17b, 0012) e da interface (L17d, 0015) gravadas por usuário.

## Proposta (1 migração: `0016_admin_institucional.sql`)

### 1. Calendário escolar institucional
- Tabela nova `calendario_escolar` (períodos letivos, feriados e eventos), com `turma_id` opcional: vazio vale para a escola toda; preenchido vale só para a turma. Tabela `calendario_escolar_versao` append-only: toda criação, edição e desativação grava versão, com auditoria.
- **Os itens não são copiados para cada aluno.** O Calendário e a Agenda do aluno leem os itens da escola e os da turma vinculada (`aluno_turma`) junto com os eventos próprios, com `origem = calendario_escolar` e selo "Escola". O aluno não edita; pode **ocultar** só para si (tabela pequena `calendario_escolar_oculto`). Motivo: uma fonte só, sem cópia desatualizada.
- Tela do Admin "Calendário da escola": criar, editar, desativar. Tempo concreto: dia por extenso + data + barra para períodos.

### 2. Regras de notas versionadas
- Tabela `regra_nota` (por instituição) com versões imutáveis: lista de períodos (nome, início, fim), peso de cada período e arredondamento (sem arredondar, 0,1 ou 0,5). Cada versão tem data de vigência; nada se apaga.
- `nota_oficial_versao` ganha `regra_versao` (opcional nas notas antigas). No lançamento e na revisão do L15, a API grava a versão vigente no dia da nota; a tela mostra "Regra v3, vigente desde 01/08".
- A média do período e a final aparecem **só para o próprio aluno e para o responsável dele** (A-040). Professor, Admin e Pedagógico não recebem médias. Sem comparação, sem ranking.

### 3. Identidade visual da instituição
- Tabela `identidade_instituicao_versao`: nome de exibição, logotipo e a cor da escola em 2 versões, uma para o tema claro e outra para o tema escuro (A-040: uma cor só não passa no contraste nos dois temas).
- Logotipo: só PNG ou JPEG, até 200 KB, conferido pelos bytes (SVG recusado: pode levar código). Guardado no banco e servido pelo próprio site (a CSP não muda).
- Contraste: a API recusa cor com contraste menor que 4,5:1 (a do claro vale contra o tema claro e o alto contraste; a do escuro, contra o tema escuro), com o mesmo cálculo do L17b. **A cor do aluno (L17b) sempre vence a da escola**; no alto contraste, a cor da escola não é aplicada.

### Permissões (matriz v11, testes gerados)
- Admin: gerir os 3 itens da própria instituição.
- Aluno: ler calendário da escola e da sua turma; ocultar para si; ler identidade.
- Professor, Pedagógico e Responsável: ler calendário da escola e das turmas a que já têm acesso; ler regra e identidade.
- Master: nada aqui (é escolar). RLS por instituição nas 6 tabelas novas.

## Terminou quando
3 itens com testes unitários e de integração; RLS e matriz v11 com testes gerados; migração 0016 com backup antes e `docs/RETORNO-0016.md`; axe sem violações; telas medidas em 360, 768 e 1280 px, alvos de 44 px, sem rolagem horizontal.

## Fora deste lote
Importar calendário (CSV, ICS, Google): Parte 2. Situação da instituição com 4 estados: L20 (hoje existem 2; o L20 amplia).

## Estimativa (não é promessa)
Lote G: cerca de 1 sessão longa. Ponto de controle do roteiro: 20/11/2026.

## Execução em 10/11/2026 (A-039 e A-040)
| Item | Estado |
|---|---|
| 1. Calendário da escola (Admin cadastra; aluno vê no Calendário e na Agenda, inclusive os da turma; oculta só para si) | Implementado |
| 2. Regras de notas versionadas (lançamento e revisão citam a versão; médias só para aluno e responsável) | Implementado |
| 3. Identidade visual (nome, logotipo PNG/JPEG até 200 KB, cor por tema com 4,5:1; a cor do aluno vence) | Implementado |

**Conferido:**
- Matriz v11 com testes gerados (`calendario_escolar`, `regras_nota` e `identidade_instituicao`), mais a política espelhada em `verificacao/politica-coerente.test.ts`.
- Lint: 0 erros e 1 aviso antigo. Tipos sem erro. 922 testes unitários (17 novos na web, com axe sem violações) e 227 de integração (16 novos, incluindo RLS entre instituições, tabelas append-only e cadeia de auditoria íntegra).
- Medido no navegador embutido (motor do Chrome) numa cópia isolada com a API simulada (porta 18095, já desligada): Calendário da escola, Regras de notas, Identidade e Notas oficiais (Admin) e Calendário, Agenda e Notas oficiais (aluno), em 360, 768 e 1280 px. Sem rolagem horizontal e sem alvo menor que 44 px. Exceção já registrada: os dias da grade do mês (F-044).
- Migração 0016 aplicada no banco do site em 10/11/2026, depois do backup `backups/siesal-20261110-210914.dump`. Site refeito: 200 local, no proxy e no link externo.

**Falta:** checagem humana (leitor de tela, teclado, contraste, celular real) com login de verdade, e o retorno do NAPNE (12/11/2026). Não medido com sessão real nem no Firefox.
