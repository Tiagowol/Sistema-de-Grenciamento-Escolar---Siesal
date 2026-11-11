# Plano do L20 — Painel Master real (proposta, 10/11/2026)

Aprovado para execução em A-036; esta proposta precisa do "sim" do autor antes do código (A-038).
Ramo: `lote-20-master`, criado a partir do `siesal-4` em `6a0bf10` (depois do merge do L17d e do L19, A-041).
Estado: **Implementado** (10/11/2026; aprovado em A-042). Último lote da Parte 1. Nada é "Verificado" antes do retorno do NAPNE e do professor (12/11/2026).

## Estado anterior (conferido em 10/11/2026)
- `instituicao.situacao` tem 2 estados: `ativa` e `suspensa`. O login escolar só passa se a instituição está `ativa` (`api/src/auth/autenticacao.ts`).
- Painel mínimo do L18 (`/operacao`): listar, criar, suspender e reativar instituição. O papel `siesal_ops` lê e altera só `instituicao`, `operator_*`; não lê nenhuma tabela escolar.
- `operator_auditoria` (0014): trilha do Master, append-only, com cadeia de hash. Ainda não aparece no painel.
- Não existe liga/desliga de módulo nem página de status. O proxy já tem a página de manutenção, servida mesmo com o site fora do ar.

## Sobreposição com o L18 (aviso pedido pelo autor)
Existe, e é só nos estados. Os botões "suspender" e "reativar" do L18 passam a fazer parte das 4 situações; nada do L18 é duplicado nem apagado. A lista e o cadastro de instituições ficam como estão. A divisa da seção 4 do roteiro continua valendo.

## Proposta (1 migração: `0017_master.sql`)

### 1. Instituições e módulos
- 4 situações: **em implantação**, **ativa**, **suspensa** e **encerrada**. Efeito no login escolar:
  - em implantação: só o Admin da escola entra (para preparar turmas, calendário e regras);
  - ativa: todos entram;
  - suspensa: ninguém entra; os dados ficam guardados; pode voltar a ativa;
  - encerrada: ninguém entra; os dados ficam guardados (nada se apaga). Pede confirmação em 2 passos no painel.
- Módulos que o Master liga e desliga por instituição: **mensagens e avisos**, **calendário** (do aluno e da escola) e **apoio ao aluno** (pedido de ajuda e "Escolha o que fazer agora"). Tabela `instituicao_modulo`.
- Módulo desligado: some do menu daquela escola **e** a API nega as rotas dele (deny by default), não só esconde.
- Toda mudança vai para `operator_auditoria`.

### 2. Auditoria do Master com contagens agregadas
- O painel mostra a trilha do Master (quem, o quê, em qual instituição, quando) e se a cadeia de hash está íntegra.
- Contagens por instituição e por perfil (quantos Admin, professores, alunos, Pedagógico e responsáveis ativos). Como o `siesal_ops` não lê `usuario`, a contagem sai de uma função do banco que devolve **só números** (`instituicao_id`, `perfil`, `total`), com permissão de execução só para o `siesal_ops`. Nunca nome, e-mail, nota ou dado de aluno; um teste confere que a resposta não tem nenhum campo além desses.

### 3. Página de status independente
- Página pública `/status`, servida pelo **proxy** (como a de manutenção), fora do aplicativo React. Por isso abre mesmo com o site ou a API fora do ar.
- Mostra em texto literal: "O site está funcionando", "O sistema de login está funcionando", "O banco de dados está funcionando" (ou "fora do ar agora"), com a hora da última checagem e uma forma visual (círculo cheio ou vazio, com o texto ao lado).
- A rota pública `/saude` passa a dizer também se o banco responde (só "ok" ou "fora"). Nenhum dado escolar, nenhum número de usuários, nenhuma credencial.

### Permissões e matriz (v12)
- `instituicoes.criar_suspender` vira `instituicoes.administrar` (4 situações) e entram `modulos.administrar` e `metricas_plataforma.ler`, todos só `master` e `plataforma`. Testes gerados.
- Regra fixa testada: o master continua sem nenhuma permissão sobre recurso escolar.

## Terminou quando
3 itens com testes unitários e de integração; matriz v12 com testes gerados; RLS e GRANTs conferidos (o `siesal_ops` continua sem ler tabela escolar); migração 0017 com backup antes e `docs/RETORNO-0017.md`; axe sem violações; telas medidas em 360, 768 e 1280 px.

## Fora deste lote
Uptime externo e status em outro servidor (Parte 2: sem deploy fora do computador).

## Estimativa (não é promessa)
Lote G: cerca de 1 sessão longa. Entrega da Parte 1: 10/12/2026.

## Execução em 10/11/2026 (A-042)
| Item | Estado |
|---|---|
| 1. 4 situações (login: em implantação só Admin; suspensa e encerrada, ninguém) e módulos mensagens, calendário e apoio ao aluno (somem do menu e a API responde 403) | Implementado |
| 2. Trilha do Master no painel, com conferência da cadeia, e contagens por perfil só numéricas (função `contagem_por_perfil`; o `siesal_ops` continua sem ler `usuario`) | Implementado |
| 3. Página `/status` pública, servida pelo proxy, com CSP fechada; `/saude` diz se o banco responde | Implementado |

**Decisões de execução (dentro da proposta):**
- Com o calendário desligado, a Agenda (núcleo) continua e só deixa de trazer os itens da escola.
- O painel mínimo do L18 foi substituído pelo painel do L20 na mesma tela. As rotas `suspender` e `reativar` do L18 continuam na API.
- `instituicao_modulo` entrou na lista de tabelas que o Master lê, no teste de isolamento do L18: é configuração da plataforma, não dado escolar.

**Conferido:**
- Matriz v12 com testes gerados.
- Lint: 0 erros e 1 aviso antigo. Tipos sem erro. 945 testes unitários (incluindo a página de status lida como está no proxy, com axe) e 238 de integração (11 novos).
- Medido no navegador embutido (motor do Chrome):
  - painel do Master numa cópia isolada com a API simulada (porta 18096, já desligada);
  - página `/status` no proxy real.
  Nas duas, em 360, 768 e 1280 px: sem rolagem horizontal e sem alvo menor que 44 px.
- Migração 0017 aplicada no banco do site em 10/11/2026, depois do backup `backups/siesal-20261110-214709.dump`. Site refeito: 200 local, no proxy e em `/status` pelo link externo; `/saude` = `{"status":"ok","banco":"ok"}`.

**Falta:** checagem humana (leitor de tela, teclado, contraste, celular real); o painel do Master não foi visto com login real de Master (as contas `w1lopes` e `tw1lopes` continuam sem senha); retorno do NAPNE (12/11/2026).
