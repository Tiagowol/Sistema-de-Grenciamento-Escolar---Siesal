# SIESAL 4.0

Sistema Inteligente de Estudos, Agenda e Aprendizagem: sistema escolar inclusivo e multi-instituição, feito como TCC (IFRN Canguaretama) e simulado como SaaS.

Estado (08/11/2026): lotes L1 a L16 implementados e com telas (login, Agenda, Foco, Atividades, notas oficiais com revisão, turmas e vínculos, avisos curtos, sinos de Mensagens e Prazos, usuários do Admin). Os lotes L16a, L16b, L16c, L16d (menu recolhível, estados de carregamento, busca no menu) e L16e (ajuda e manual por perfil) estão implementados, aguardando checagem humana e commit. Seguem L17 (Apoio ao aluno) e L18 (Fechamento, com login dos Masters). Nada é "Verificado": faltam as checagens humanas (leitor de tela, teclado, contraste real, zoom de 200%, NAPNE) e o parecer jurídico. Login e painel de Master ainda não existem.

Como ver o sistema:
- Site local: http://localhost:18080 (`WEB_PORTA=18080` no `.env`). Subir ou refazer: `docker compose up -d --build`.
- Entrada pública (Funnel/túnel): proxy em `127.0.0.1:18081`, com página de manutenção fora da janela 06:00-23:59 (America/Sao_Paulo) e comandos manuais em `scripts/manutencao.sh`. Ver `docs/FUNNEL-E-MANUTENCAO.md` e `docs/ACESSO-PUBLICO-TEMPORARIO.md`.
- Testes: `pnpm verificar` (lint, tipos e testes) e, no Docker, `docker compose --profile teste run --rm --build teste`.
- Critério de entrega: lint, tipos e testes passando, axe sem violação nas telas novas, medição em 360, 768 e 1280 px, e registro de falhas em `docs/REGISTRO-DE-FALHAS.md`.

## O que este projeto não é
- Não é ferramenta clínica: sem diagnóstico, sem ranking e sem comparação entre alunos.
- Não é serviço em produção. Só dados fictícios. A única conta real é a do autor do TCC (maior de 18 anos).

## Tecnologia (ADR-007, 07/11/2026)
TypeScript, Node 26 LTS, Fastify 5.12.8, React 19.3.1 + Vite 8.3.6, PostgreSQL 18.6 com RLS, Prisma 7.10.1, Better Auth 1.7.18, pg-boss 12.38.1, Docker Compose próprio.

## Verificação local (Lote 3, item 1)
Pacotes: `api`, `web` (reservado) e `shared`. Ferramentas: pnpm 12.18.0, Biome 2.6.6 (lint e formatação), Vitest 5.1.0.

```
pnpm install
pnpm verificar
```

`pnpm verificar` roda lint, typecheck e testes. Use `pnpm verificar` e não `pnpm ci` (o `pnpm ci` é outro comando do pnpm).

## Banco, migração e testes de isolamento (Lote 3)
Ordem para rodar no WSL2 (um comando por vez, na pasta do projeto):

```
bash scripts/backup.sh
```
```
CONFIRMA_BACKUP=sim docker compose --profile release run --rm migrate
```
```
docker compose --profile teste run --rm --build teste
```

Antes: preencher `SIESAL_APP_PASSWORD` no `.env` (`openssl rand -hex 24`). O `migrate` cria os papéis `siesal_owner` e `siesal_app` e aplica `api/migracoes/*.sql`; o `teste` roda a suíte de isolamento em um banco temporário.

## Lote 4: auditoria, permissões e Masters
- Auditoria: tabela `auditoria_evento` por instituição, com hash calculado no banco; sem UPDATE, DELETE nem TRUNCATE.
- Permissões: matriz em `shared/src/permissoes.json` (nega por padrão), validada e testada.
- Masters: tabela `operator_account` com 2 vagas. Depois da migração, criar as vagas (sem senha) uma única vez, com `MASTER_1_USUARIO` e `MASTER_2_USUARIO` preenchidos no `.env`:

```
docker compose --profile release run --rm bootstrap
```

O login dos Masters fica para o Lote 6.

## Lote 5: autenticação própria (ADR-008)
- Rotas: `POST /auth/login`, `POST /auth/logout`, `GET /auth/eu`, `POST /auth/totp/iniciar`, `POST /auth/totp/confirmar`. Só entram com `AUTH_SECRET` preenchido no `.env`.
- Senha com Argon2id; sessão opaca no cookie `__Host-siesal_sessao` (só o hash fica no banco); TOTP (RFC 6238) obrigatório para admin; 10 códigos de recuperação de uso único.
- 5 falhas seguidas bloqueiam a conta por 15 minutos; limite de 10 tentativas por minuto por IP; todo evento é auditado.
- Ainda sem tela de cadastro de senha: a senha inicial entra pelo fluxo de usuários (Lote seguinte).

## Regras do repositório
- Repositório público: nenhum segredo, IP, domínio interno, dado real ou dump.
- Variáveis de ambiente: copiar `.env.example` para `.env` (o `.env` nunca vai para o git).
- Versões exatas, sem `^` nem `~`. Atualização só em lote aprovado.
- Migrações só pelo job `migrate`, com backup antes.
- Falhas corrigidas ficam em `docs/REGISTRO-DE-FALHAS.md`.

## Documentos
A documentação de planejamento (Visão, ADRs, matriz de permissões, modelo de dados, riscos, privacidade) está no projeto de trabalho e será copiada para `docs/` em lote próprio.

## Conformidade
Projetado para atender LGPD, ECA Digital (Lei 15.211/2025), WCAG 2.2 AA e eMAG. Sem parecer jurídico até o momento; não afirmamos "em conformidade".
