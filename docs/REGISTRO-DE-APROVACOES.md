# Registro de aprovações (cópia no repositório)

O registro completo e anterior fica no Projeto "TW1-SaaS-SIESAL" (claude.ai). Este arquivo guarda, no repositório, as aprovações feitas a partir de 09/11/2026. Mudança de plano, escopo, ordem ou decisão só vale depois de registrada aqui e no Projeto.

## Nota de numeração (09/11/2026)
O roteiro trouxe A-027 e A-028 como numeração provisória. No repositório, A-027 já é a regra do motivo da revisão (L15/L16), A-029 são os comandos de manutenção e A-030 é a ordem dos lotes 16a a 16e. O próximo número livre é A-031. Por isso as duas decisões abaixo ficam como **A-031** e **A-032**. Em 10/11/2026 o texto do roteiro (docs/ROTEIRO-L17A-A-L20.md) foi corrigido para A-031 e A-032 (A-035). O autor deve conferir se o Projeto no claude.ai usa os mesmos números.

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
(No roteiro, era citada como "A-028"; corrigido em 10/11/2026.)

## A-033 — Commit e push dos L17a, L17b e L17c (09/11/2026)
O autor pediu, em chat, que o Code crie um ramo por lote (lote-17a-calendario, lote-17b-personalizacao, lote-17c-conta-suporte), faça commit de cada um e suba todos ao GitHub no fim. Vale só para commit e push desses ramos. **Merge, deploy e aplicação das migrações 0011, 0012 e 0013 no banco do site continuam com autorização separada** (backup antes e retorno escrito em docs/RETORNO-*.md). As migrações foram provadas só em banco temporário, nos testes de integração.

## Ajuste de escopo do L17a (09/11/2026)
O item "aluno vê os eventos da turma vinculada" não existe ainda: não há tabela de eventos da turma. Fica para o L19 (calendário escolar, origem calendario_escolar). No L17a o teste de permissão prova que o aluno vê só os próprios eventos. Motivo: evitar criar uma tabela que o L19 vai definir.

## Nota do L17c (09/11/2026)
No L17c, "menor de idade" = perfil aluno (o cadastro não tem data de nascimento). Sem e-mail real, a confirmação de adultos é uma segunda etapa na tela. Detalhes e limites em docs/PLANO-L17C-CONTA-E-SUPORTE.md. O autor deve confirmar essas duas escolhas.

## A-034 — Execução do L18 (09 e 10/11/2026)
- 09/11/2026, em chat: o autor pediu que o Code criasse e aplicasse o L18 completo à 01:00 de 10/11, com commit em ramo próprio, relatório em `docs/` e testes no navegador ("você está autorizado").
- 10/11/2026, em chat: a tarefa agendada não rodou (F-043). O autor escreveu: "o lote 18 foi executado? se não foi execute".
- Coberto: código do L18, migração 0014 no banco do site (com backup antes e retorno em `docs/RETORNO-0014.md`), refazer o site local, commit no ramo `lote-18-masters-fechamento`, testes no navegador.
- **Não coberto:** push, merge, deploy fora do computador, ligar o acesso público e criar senha dos Masters (o primeiro acesso é do autor).

## Decisões do Code no L18 que o autor precisa confirmar (10/11/2026)
1. A API age como Master por `SET LOCAL ROLE siesal_ops` (sem segunda conexão). Motivo e provas em `docs/PROPOSTA-L18-ARQUITETURA-MASTER.md`.
2. Primeiro acesso do Master por convite de uso único, gerado por comando manual no servidor (30 minutos). Sem códigos de recuperação: perdeu a senha ou o aplicativo, gera-se outro convite.
3. Suspender uma instituição impede o login e encerra as sessões das pessoas dela. A mensagem na tela de login é a genérica ("Credenciais inválidas ou conta temporariamente bloqueada").
4. A trilha do Master (`operator_auditoria`) já foi criada no L18, separada da escolar. As contagens agregadas continuam no L20.
5. Matriz de permissões: continua na versão 9 (a permissão do Master já existia).
6. Correções de defeito fora do item do lote, feitas por regra ("salvo defeito ou segurança"): F-044 (alvos de toque) e F-045 (tamanho do texto no celular).

## A-035 — Correção do roteiro, commit, push do L18 e ramo do L17a (10/11/2026)
Mensagem do autor em chat, em 10/11/2026, com 5 itens:
1. Corrigir em `docs/ROTEIRO-L17A-A-L20.md` as referências "A-027" para A-031 e "A-028" para A-032. **Feito.**
2. "AUTORIZO o commit", no ramo `lote-18-masters-fechamento`, de 4 arquivos listados: `docs/ROTEIRO-L17A-A-L20.md`, `docs/REGISTRO-DE-APROVACOES.md`, `CLAUDE.md` e `docs/PLANO-L17A-CALENDARIO.md`. Estado encontrado: `CLAUDE.md` e o plano do L17a não tinham alteração pendente (já estavam no commit `6442f77`, de 09/11/2026). O commit levou só os 2 arquivos alterados: o roteiro e este registro.
3. "AUTORIZO o push" do ramo `lote-18-masters-fechamento` para o `origin`. Nada no `main`. Sem merge e sem deploy.
4. Criar o ramo `lote-17a-calendario` a partir do ponto atual do L18. **Não executado.** Estado encontrado: o ramo `lote-17a-calendario` já existe desde 09/11/2026, no commit `6442f77`, e já está no GitHub (A-033). Recriá-lo no ponto do L18 trocaria o que ele aponta e exigiria envio forçado. O ramo do L18 já contém o L17a, o L17b, o L17c, a correção F-045 e o roteiro.
5. Começar o L17a pelo plano e avisar antes da migração 0011. **Não executado.** Estado encontrado: o L17a está Implementado desde 09/11/2026 e a migração 0011 foi aplicada naquele dia, com backup antes (`backups/siesal-20261109-223319.dump`) e retorno em `docs/RETORNO-0011.md`.
- **Não coberto:** merge, deploy fora do computador, envio forçado, ligar o acesso público e criar senha dos Masters.
