# 🏛️ Arquitetura, Dados e Regras de Negócio do SIESAL

> Como o sistema é construído: stack, estrutura de pastas, modelo de dados completo (MySQL/Prisma) e as regras que o código implementa.

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Papel |
|---|---|---|
| **Backend** | Node.js 18+ / TypeScript 5.6 | API REST desacoplada |
| Framework web | Express 4.21 | Rotas, middlewares, CORS |
| ORM | Prisma 5.22 (MySQL) | Modelagem tipada, migrations via `db push`, consultas seguras |
| Auth | jsonwebtoken 9 + bcryptjs 2.4 | Sessão JWT (7 dias) e hash de senha (12 rounds) |
| OAuth | Endpoints oficiais do Google | Authorization Code Flow (sem bibliotecas externas — `fetch` nativo) |
| **Frontend** | React 18 + TypeScript + Vite 5 | SPA com HMR em desenvolvimento |
| Estilo | Tailwind CSS 3.4 (paletas em variáveis CSS) | Design system "dark neon" re-tematizável em runtime |
| Ícones | lucide-react | + SVG próprio para o logo do Google |
| Áudio | Arquivo OGG + Web Audio API de reserva | Bipe de notificações sem bibliotecas |
| Verificação de vazamentos | HaveIBeenPwned (k-anonymity) | Senhas recusadas se já vazadas na internet |

O projeto é **100% desacoplado**: backend na porta **3001**, frontend na porta **5173** (Vite). A comunicação é sempre HTTP/JSON; o frontend nunca acessa o MySQL diretamente.

```
┌────────────────────┐    HTTP/JSON (fetch)    ┌─────────────────────┐   Prisma    ┌──────────┐
│  Frontend (React)   │ ─────────────────────▶ │  Backend (Express)  │ ──────────▶ │  MySQL   │
│  localhost:5173     │ ◀───────────────────── │  localhost:3001/api │ ◀────────── │ siesal_db│
└────────────────────┘                         └─────────────────────┘             └──────────┘
        ▲                                               ▲  ▲
        │ redirects 302 (navegador)                     │  │ HTTPS
        │ (login Google)                                │  └──── Google OAuth/Userinfo
        └───────────────────────────────────────────────┘
```

---

## 2. Estrutura de Pastas (o que cada arquivo faz)

### Backend (`backend/`)

| Arquivo/Diretório | Responsabilidade |
|---|---|
| `src/server.ts` | Bootstrap do Express: CORS, **cabeçalhos de segurança HTTP**, parsers JSON, rota de health, montagem de `/api`, tratador de erros e **mensagem amigável de EADDRINUSE** (porta ocupada) |
| `src/routes/index.ts` | Agrega todos os roteadores sob `/api` |
| `src/routes/authRoutes.ts` | Login, cadastro, perfil, senha, conta + rotas do Google OAuth (com **rate limiting** nas rotas sensíveis) |
| `src/routes/demandRoutes.ts` / `subjectRoutes.ts` / `eventRoutes.ts` / `notificationRoutes.ts` / `statsRoutes.ts` | CRUDs de negócio (todos atrás de `authMiddleware`) |
| `src/routes/adminRoutes.ts` | Rotas administrativas (atrás de `authMiddleware` **+** `adminMiddleware`) |
| `src/controllers/authController.ts` | Cadastro/login/perfil/senha/exclusão de conta; exporta `verifyCredentials` (NF03 compartilhada com o OAuth), `generateSessionToken`, `publicUser` e `createDefaultStudentData` (7 matérias + boas-vindas, usado por cadastro e Google) |
| `src/controllers/googleAuthController.ts` | Provedor Google OAuth: redirect → consentimento → callback → troca de tokens → perfil verificado → `login_code` de uso único |
| `src/controllers/demandController.ts` | CRUD de demandas com **prioridade dinâmica** recalculada em toda leitura/escrita |
| `src/controllers/subjectController.ts` | CRUD de matérias/marcadores (cor em hex livre) |
| `src/controllers/eventController.ts` | CRUD de eventos com filtros de **dia/mês em horário local** (`localDayRange`/`localMonthRange` — evita bug de fuso UTC) |
| `src/controllers/notificationController.ts` | Lista, marcar lida, marcar todas |
| `src/controllers/statsController.ts` | Agregados do Dashboard (prazos, semana, distribuição, avisos) |
| `src/controllers/adminController.ts` | Métricas do servidor/banco, lista de usuários, broadcast, purga e **gestão de contas v2** (status, desbloqueio NF03, exclusão LGPD) |
| `src/middlewares/authMiddleware.ts` | Exige `Bearer <JWT>`; extrai `userId`/`userEmail`; **sem atalhos de impersonação** |
| `src/middlewares/adminMiddleware.ts` | Consulta `is_admin` no banco para cada requisição admin |
| `src/middlewares/rateLimit.ts` | 30 req/min por IP nas rotas de autenticação (janela deslizante em memória) |
| `src/middlewares/errorHandler.ts` | Tratador global de erros (status + mensagem) |
| `src/services/prisma.ts` | Instância única do PrismaClient (log de erros/warnings) |
| `src/utils/priorityCalculator.ts` | Regra de prioridade dinâmica (idêntica ao frontend) |
| `src/debug_console.ts` | CLI administrativa (`grant-admin`, `revoke-admin`, `users`, `status`...) |
| `prisma/schema.prisma` | Fonte da verdade do modelo de dados |
| `prisma/seed.ts` | Conta demo + matérias/demandas/eventos/avisos do protótipo |
| `database/siesal_workbench_schema.sql` | DDL equivalente para MySQL Workbench (com `escola`, `turma`, `is_admin`) |
| `.env` | `DATABASE_URL`, `PORT`, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `FRONTEND_URL` |

### Frontend (`frontend/`)

| Arquivo/Diretório | Responsabilidade |
|---|---|
| `src/main.tsx` | Bootstrap: aplica **tema salvo antes do primeiro paint**, desbloqueia áudio no 1º clique e monta `DialogProvider → AuthProvider → App` |
| `src/App.tsx` | Shell da aplicação: gate de conexão (**OfflineGate**), callback OAuth (`/oauth/callback`), tour guiado no 1º login, estados globais de dados, **polling de notificações (12 s)** + bipe + badge no título, handlers de CRUD |
| `src/components/UI/SiesalDialog.tsx` | **Sistema de diálogos integrado** (`confirm`/`alert`/`prompt` via Promise) que substitui as janelas nativas do navegador |
| `src/components/UI/OfflineGate.tsx` | Hook `useBackendStatus` (ping 4 s + tolerância a 2 falhas), splash de conexão e tela **"Servidor SIESAL fora do ar"** |
| `src/components/Tutorial/GuidedTutorial.tsx` | Tour passo a passo com spotlight apontando para recursos reais (`data-tutorial`) |
| `src/components/Layout/Header.tsx` / `Sidebar.tsx` | Navegação; badge V2; sino com contador |
| `src/pages/AuthPage.tsx` | Abas Entrar / Criar Conta / Google; força de senha; **verificação HIBP no cadastro** |
| `src/pages/DemandsPage.tsx` | Filtros, chips de matéria, lista e painel de detalhes (com **Editar**) |
| `src/pages/AgendaPage.tsx` + `components/Agenda/*` | Calendário mensal + linha do tempo 00:00–23:00 (datas em fuso local) |
| `src/pages/SubjectsPage.tsx` | Cards de matéria com **barra de progresso** |
| `src/pages/SettingsPage.tsx` | Perfil, **troca de senha (HIBP)**, Aparência (temas/animações/notificações), backup completo, LGPD |
| `src/pages/AdminPage.tsx` | Painel administrativo V2 (métricas, broadcast, purga, **gestão de contas**) |
| `src/components/Demands/DemandModal.tsx` | Modal de demanda em **modo criação E edição** (prioridade recalculada ao vivo) |
| `src/components/Subjects/SubjectModal.tsx` | Matérias: paleta rápida + **seletor de cor personalizada** + edição |
| `src/services/api.ts` | Cliente HTTP central: `customFetch` (com fallback mock **somente em falha de rede**), todos os endpoints, `pollNotifications`, `pingBackend` |
| `src/context/AuthContext.tsx` | Sessão (login, Google, perfil, logout) persistida em localStorage |
| `src/utils/appearance.ts` | **Motor de temas** (HSL hue-shift → variáveis CSS), preferências persistidas e som de notificação |
| `src/utils/security.ts` | **Verificação de senha contra vazamentos** (SHA-1 + k-anonymity) |
| `src/utils/date.ts` | Helpers de data em **fuso local** (`toLocalDateString`, `isoToLocalDateString`, `toLocalDateTimeInput`) |
| `src/utils/priorityCalculator.ts` | Mesma regra de prioridade do backend (paridade total) |
| `public/sounds/notification-beep.ogg` | Bipe baixado da Google Sound Library (CC BY 4.0) |

---

## 3. Modelo de Dados (MySQL + Prisma)

Fonte: `backend/prisma/schema.prisma`. Prefixo de tabela por `@@map` (nomes sem acento, minúsculos).

### 3.1 Diagrama de Relacionamentos

```
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│    usuario    │1      *│   marcador    │1      *│    tarefa     │
│───────────────│───────▶│───────────────│───────▶│───────────────│
│ id_usuario PK │        │ id_marcador PK│        │ id_tarefa PK  │
│ nome, email U │        │ nome, cor     │        │ titulo, ...   │
│ senha (hash)  │        │ id_usuario FK │        │ id_usuario FK │
│ escola, turma │        └───────────────┘        │ id_marcador FK│──▶ SetNull
│ is_admin      │                                 └───────┬───────┘
│ tentativas_…  │                                 1        │ *       
│ bloqueado_ate │        ┌───────────────┐                 │
└──┬────────────┘        │    lembrete   │◀────────────────┘
   │1                   *│───────────────│  (cascade: apagar tarefa apaga lembretes)
   ├──────────────*───▶  │ id_lembrete PK│
   │                     │ data_hora     │   id_tarefa FK ──▶ Cascade
   ├──────────────*──┐   │ id_evento? FK │──▶ evento (Cascade)
   │                 │   └───────────────┘
   │        ┌───────────────┐        ┌────────────────┐
   ├──────▶ *│    evento    │        │  notificacao  │
   │         │ id_evento PK │1     * └──────────┬─────┘
   │         │ data_inicio… │◀──────────────────┘ id_usuario FK (Cascade)
   └────────▶ └───────────────┘
```

### 3.2 Tabelas detalhadas

#### `usuario` — contas de aluno/admin
| Coluna | Tipo | Regras |
|---|---|---|
| `id_usuario` | INT AUTO_INCREMENT | PK |
| `nome` | VARCHAR(100) | obrigatório, só letras/espaços |
| `email` | VARCHAR(100) | **UNIQUE**, salvo em minúsculas |
| `senha` | VARCHAR(255) | hash bcrypt (12 rounds); contas Google recebem hash aleatório inutilizável |
| `escola` | VARCHAR(100) NULL | informada no cadastro ou `null` (usuários Google podem editar depois) |
| `turma` | VARCHAR(50) NULL | idem |
| `data_cadastro` | DATETIME | `DEFAULT now()` |
| `status` | TINYINT(1) | `true` = ativo; **admin pode desativar** (login volta 403) |
| `is_admin` | TINYINT(1) | só concede/revoga via **Console de Debug** (nunca via HTTP) |
| `tentativas_falhas` | INT | contador do **NF03** (zera no acerto/desbloqueio) |
| `bloqueado_ate` | DATETIME NULL | timestamp de fim do bloqueio NF03 |

#### `marcador` — matérias com cor
| Coluna | Tipo | Regras |
|---|---|---|
| `id_marcador` | INT PK | |
| `nome` | VARCHAR(50) | obrigatório |
| `cor` | VARCHAR(20) | hex livre (ex.: `#8b5cf6`) — paleta rápida OU seletor personalizado |
| `id_usuario` | INT FK → usuario | **Cascade** (conta apagada apaga matérias) |

#### `tarefa` — demandas
| Coluna | Tipo | Regras |
|---|---|---|
| `id_tarefa` | INT PK | |
| `titulo` | VARCHAR(100) | obrigatório |
| `descricao` | TEXT NULL | |
| `data_criacao` | DATETIME | `now()` |
| `data_entrega` | DATETIME | obrigatória; base do cálculo de prioridade |
| `prioridade` | VARCHAR(20) | recalculada a cada leitura/escrita (ver §4.1) |
| `status` | VARCHAR(20) | `Pendente` (default) / `Concluido` (usados pela UI; o **"Atrasada"** é derivado no frontend por prazo vencido) |
| `dificuldade` | VARCHAR(20) NULL | `Fácil` / `Médio` / `Difícil` |
| `tipo` | VARCHAR(50) NULL | `Atividade` / `Trabalho` / `Prova` / `Exercício` |
| `professor` | VARCHAR(100) NULL | |
| `id_usuario` | FK → usuario | Cascade |
| `id_marcador` | FK → marcador NULL | **SetNull** (matéria excluída deixa a tarefa viva) |

#### `evento` — agenda
`id_evento PK`, `titulo` (100), `descricao` TEXT NULL, `data_inicio` DATETIME, `data_fim` DATETIME, `local` VARCHAR(100) NULL, `id_usuario` FK Cascade.

#### `lembrete` — lembretes (F02)
`id_lembrete PK`, `mensagem` (255), `data_hora` DATETIME, `data_envio` DATETIME NULL, `enviado` TINYINT(1) default 0, `id_usuario` FK Cascade, `id_tarefa` FK NULL **Cascade**, `id_evento` FK NULL **Cascade**. Nasce da opção "ativar lembrete 24 h antes" na criação da demanda.

#### `notificacao` — avisos
`id_notificacao PK`, `titulo` (100), `mensagem` TEXT, `data_envio` DATETIME default now, `lida` TINYINT(1) default 0, `id_usuario` FK Cascade.

### 3.3 Políticas de exclusão (resumo)

| Ação | Consequência em cascata |
|---|---|
| Excluir usuário (conta própria ou admin) | Apaga matérias, tarefas, eventos, lembretes e notificações dele (LGPD) |
| Excluir matéria | Demandas vinculadas ficam **sem matéria** (SetNull) — nada é perdido |
| Excluir tarefa/evento | Lembretes vinculados são apagados |

### 3.4 Sincronização do banco

- **Prisma:** `npm run prisma:db:push` alinha o MySQL ao `schema.prisma` adicionando colunas **sem apagar dados** (usado quando o banco foi criado por script antigo).
- **Workbench:** `backend/database/siesal_workbench_schema.sql` cria tudo do zero (inclui os dados do protótipo e a conta demo `jose.arimateia@escola.gov.br` / `123456`).
- **Seed:** `npm run prisma:seed` repõe a conta demo e os dados do protótipo (idempotente — não duplica).

---

## 4. Regras de Negócio Implementadas

### 4.1 Prioridade dinâmica (`utils/priorityCalculator.ts` — backend e frontend idênticos)

Calculada pelo cruzamento **prazo restante × dificuldade**, recalculada em toda listagem/leitura/escrita:

| Prazo restante | Fácil | Médio | Difícil |
|---|---|---|---|
| Vencido ou ≤ 24h | **Urgente** | **Urgente** | **Urgente** |
| ≤ 3 dias | Próximo | **Urgente** | **Urgente** |
| ≤ 7 dias | Próximo | Próximo | **Urgente** |
| ≤ 14 dias | Longe | Próximo | Próximo |
| > 14 dias | Longe | Longe | Próximo |

Detalhes de implementação: compara `diffHours <= 24` para o caso crítico e `diffDays = ceil(ms/86400000)` para os demais; a dificuldade é normalizada sem acento (`médio`/`medio`).

**"Atrasada"** (frontend): `status !== 'Concluido' && data_entrega < agora` → badge vermelho pulsante no card e no painel de detalhes; a métrica `demandsOverdue` do admin calcula o mesmo no backend com Prisma.

### 4.2 "Essa Semana" no Dashboard
Semana corrente de **domingo a domingo**, limites construídos em horário local (`setHours(0,0,0,0)` → `23:59:59.999`).

### 4.3 NF03 — bloqueio de conta
- 5 senhas erradas → `bloqueado_ate = agora + 15 min`; login devolve **403** com tempo restante;
- Mensagem de senha incorreta é sempre **genérica** (não revela existência do e-mail) e inclui `tentativas_restantes`;
- Acerto → zera o contador; bloqueio expirado → **contador reinicia do zero** na próxima falha;
- A mesma `verifyCredentials` atende `/auth/login` e o fluxo Google (comportamento idêntico);
- Admin pode desbloquear na hora (`POST /admin/users/:id/unlock`).

### 4.4 Datas e fusos
- Frontend **nunca** usa `toISOString()` para comparar dias (ele converte para UTC e desloca eventos); usa `utils/date.ts` (fuso local);
- Backend monta os limites de dia/mês dos filtros de eventos com `new Date(ano, mês, dia, ...)` local;
- O input `datetime-local` do modo edição é preenchido com `toLocalDateTimeInput()` (`YYYY-MM-DDTHH:mm` local).

### 4.5 Modo de demonstração (fallback) e OfflineGate
O `customFetch` do frontend mantém um fallback em `localStorage` que só é acionado em **falha de rede** (`TypeError` do `fetch`) — erros HTTP reais (401/409...) sempre chegam à UI. Em paralelo, o **OfflineGate** monitora `/api/health` a cada 5 s: 2 falhas seguidas **bloqueiam o sistema** com a tela "Servidor fora do ar" até a reconexão (ver `docs/RECURSOS-E-IMPLEMENTACAO.md` §6).

### 4.6 Console de Debug (administrador raiz)

```bash
cd backend
npm run console
```

| Comando | Função |
|---|---|
| `start` / `stop` / `restart` | Gerencia o servidor dentro do console |
| `status` | Latência do MySQL, nº de usuários/admins/demandas |
| `grant-admin <email>` | Concede `is_admin` (única forma de criar admins) |
| `revoke-admin <email>` | Revoga privilégios |
| `users` | Lista contas e badges ADMIN/ALUNO |
| `clear` / `exit` | Limpa tela / encerra |

Por decisão de segurança, **não existe rota HTTP** que conceda admin — nem um admin comprometido pode criar outros via API.

---

## 5. Fluxo de dados de uma requisição típica

```
Usuário clica "Concluir demanda"
   └─▶ App.handleToggleDemandStatus(id)
        └─▶ api.toggleDemandStatus(id) → PATCH /api/demands/12/toggle
             └─▶ authMiddleware: valida Bearer JWT → req.userId = 10
                  └─▶ demandController.toggleStatus
                       ├─ findFirst({ id_tarefa: 12, id_usuario: 10 })   ← posse do recurso
                       ├─ status: Pendente → Concluido
                       └─ update + prioridade recalculada → res.json(...)
        ◀─ resposta 200 (demanda atualizada)
   └─▶ loadData() → refetch de tudo → UI reativa
```

Todos os controllers seguem o padrão **"verificar posse antes de tocar"** (`findFirst` com `id_usuario`), portanto um usuário jamais lê/altera registros de outro, mesmo conhecendo os IDs.
