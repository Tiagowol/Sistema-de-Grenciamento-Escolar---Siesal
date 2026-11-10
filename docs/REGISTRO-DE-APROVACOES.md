# Registro de aprovações (cópia no repositório)

O registro completo e anterior fica no Projeto "TW1-SaaS-SIESAL" (claude.ai). Este arquivo guarda, no repositório, as aprovações feitas a partir de 09/11/2026. Mudança de plano, escopo, ordem ou decisão só vale depois de registrada aqui e no Projeto.

## Nota de numeração (09/11/2026)
O roteiro trouxe A-027 e A-028 como numeração provisória. No repositório, A-027 já é a regra do motivo da revisão (L15/L16), A-029 são os comandos de manutenção e A-030 é a ordem dos lotes 16a a 16e. O próximo número livre é A-031. Por isso as duas decisões abaixo ficam como **A-031** e **A-032**. O texto do roteiro (docs/ROTEIRO-L17A-A-L20.md) ainda cita "A-028" na seção do L17c; leia como **A-032**. O autor deve conferir se o Projeto no claude.ai usa os mesmos números.

## A-031 — Roteiro L17a a L20 (09/11/2026)
Aprovado pelo proprietário (seção 1 do roteiro):
1. A numeração dos lotes termina no L20 (CLAUDE.md corrigido).
2. Depois do L20 é a Parte 2, lista sem número.
3. L19 e L20 são Parte 1 e entram na entrega de 10/12/2026. Pontos de controle: 20/11 e 01/12.
4. Aprovados para execução: L17a, L17b, L17c e L18. Não pedem novo "aprovo" para começar. Commit, push, merge, deploy e cada migração (com backup antes e retorno escrito) seguem com autorização separada.
5. L19 e L20: Planejados; cada um só começa com "aprovo o L19" / "aprovo o L20".
6. Prazo: se apertar, o trabalho para e o escopo é cortado por decisão do proprietário. Reavaliação em 20/11.
7. Toda alteração de plano, escopo, ordem ou decisão é registrada dos dois lados (docs/ e Projeto). Mudança sem registro não vale.

## A-032 — Menor de idade no L17c (09/11/2026)
- Trocar e-mail de aluno menor: exige aprovação do Responsável vinculado ou do Admin.
- Encerrar conta de aluno menor: confirmação do Responsável e, na falta dele, do Admin.
(No roteiro, citada como "A-028".)

## A-033 — Commit e push dos L17a, L17b e L17c (09/11/2026)
O autor pediu, em chat, que o Code crie um ramo por lote (lote-17a-calendario, lote-17b-personalizacao, lote-17c-conta-suporte), faça commit de cada um e suba todos ao GitHub no fim. Vale só para commit e push desses ramos. **Merge, deploy e aplicação das migrações 0011, 0012 e 0013 no banco do site continuam com autorização separada** (backup antes e retorno escrito em docs/RETORNO-*.md). As migrações foram provadas só em banco temporário, nos testes de integração.

## Ajuste de escopo do L17a (09/11/2026)
O item "aluno vê os eventos da turma vinculada" não existe ainda: não há tabela de eventos da turma. Fica para o L19 (calendário escolar, origem calendario_escolar). No L17a o teste de permissão prova que o aluno vê só os próprios eventos. Motivo: evitar criar uma tabela que o L19 vai definir.

## Nota do L17c (09/11/2026)
No L17c, "menor de idade" = perfil aluno (o cadastro não tem data de nascimento). Sem e-mail real, a confirmação de adultos é uma segunda etapa na tela. Detalhes e limites em docs/PLANO-L17C-CONTA-E-SUPORTE.md. O autor deve confirmar essas duas escolhas.
