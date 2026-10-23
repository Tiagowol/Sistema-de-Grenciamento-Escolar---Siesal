# SIESAL - Sistema de Gerenciamento Escolar do Aluno

> **Versão 2.0**  
> Autores: Natanael Francisco de Lima, Miquéias Braga, Domingos Tiago Wagner de Oliveira Lopes, Anna Clara Dias.

---

## 📖 Sobre o Projeto

O **SIESAL** é uma solução completa para auxiliar estudantes no gerenciamento de suas atividades diárias, ajudando na organização de tarefas, matérias, eventos, lembretes e notificações de prazos importantes.

O sistema possui **dois métodos de autenticação**:

1. **Login direto** com e-mail institucional e senha (hash bcrypt + JWT);
2. **Login com Google** — **OAuth 2.0 real** (*Authorization Code Flow*), em que o aluno autentica na tela oficial do Google e o SIESAL recebe apenas o **nome e o e-mail verificado** do perfil. A sessão emitida é o mesmo JWT usado em toda a API. Alunos novos têm a conta criada automaticamente no primeiro acesso.

---

## 📚 Documentação Completa (`docs/`)

Além deste README, o projeto possui documentação técnica aprofundada, arquivo por arquivo:

| Documento | Conteúdo |
|---|---|
| [`docs/API-REST.md`](docs/API-REST.md) | Referência dos **30 endpoints** da API: métodos, autenticação, parâmetros, corpos, exemplos de requisição/resposta, códigos de erro e rate limiting |
| [`docs/ARQUITETURA-E-DADOS.md`](docs/ARQUITETURA-E-DADOS.md) | Stack, estrutura de pastas com responsabilidade de cada arquivo, **modelo de dados completo** (6 tabelas, relações, cascades) e regras de negócio (prioridade dinâmica, NF03, fusos, console admin) |
| [`docs/AUTENTICACAO-E-SEGURANCA.md`](docs/AUTENTICACAO-E-SEGURANCA.md) | Sessão JWT, bloqueio NF03, **fluxo Google OAuth 2.0 passo a passo** (diagrama de sequência + camadas de segurança), verificação de senhas contra vazamentos (HaveIBeenPwned k-anonymity), rate limit e cabeçalhos de segurança |
| [`docs/RECURSOS-E-IMPLEMENTACAO.md`](docs/RECURSOS-E-IMPLEMENTACAO.md) | **Como cada recurso foi feito**: tour guiado (spotlight com box-shadow + correção do bug de tela), sistema de temas (variáveis CSS + matemática HSL), notificações em tempo real + bipe real, SiesalDialog (fim das janelas nativas), edição de demandas, OfflineGate, cores personalizadas de matérias, painel admin V2 |

---

## 🏛️ Arquitetura do Sistema

O projeto é 100% desacoplado entre **Backend** e **Frontend**:

```
Sistema de Gerenciamento Escolar - Siesal/
├── backend/                              # API RESTful em Node.js com Express e Prisma ORM
│   ├── database/
│   │   └── siesal_workbench_schema.sql  # Script DDL completo pronto para o MySQL Workbench
│   ├── prisma/
│   │   ├── schema.prisma                # Modelagem do Prisma para MySQL
│   │   └── seed.ts                      # População inicial com os dados do protótipo
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.ts        # Cadastro, login, perfil, troca de senha, exclusão de conta
│   │   │   ├── googleAuthController.ts  # Login com Google — OAuth 2.0 Authorization Code real
│   │   │   ├── demandController.ts      # Demandas com prioridade dinâmica
│   │   │   ├── subjectController.ts    # Matérias/marcadores
│   │   │   ├── eventController.ts      # Agenda e eventos
│   │   │   ├── notificationController.ts# Notificações
│   │   │   ├── statsController.ts       # Estatísticas do Dashboard
│   │   │   └── adminController.ts       # Painel administrativo
│   │   ├── middlewares/
│   │   │   ├── authMiddleware.ts        # Autenticação JWT obrigatória (Bearer token)
│   │   │   ├── adminMiddleware.ts       # Bloqueio de rotas exclusivas de administradores
│   │   │   └── errorHandler.ts          # Tratador global de erros
│   │   ├── routes/                      # Rotas Express REST (auth + google, demands, ...)
│   │   ├── services/
│   │   │   └── prisma.ts                # Instância do Prisma Client
│   │   ├── utils/
│   │   │   └── priorityCalculator.ts    # Cálculo dinâmico de prioridade
│   │   ├── debug_console.ts             # Console de administração (grant-admin, etc.)
│   │   └── server.ts                    # Inicialização do Servidor Express
│   ├── .env                             # Configuração de conexão do MySQL
│   ├── package.json
│   └── tsconfig.json
├── frontend/                             # Interface Web Moderna e Responsiva em React + Vite + TS + Tailwind
│   ├── public/
│   │   └── sounds/
│   │       └── notification-beep.ogg     # Som de notificação (Google Sound Library — CC BY 4.0)
│   ├── src/
│   │   ├── components/
│   │   │   ├── UI/                       # SiesalDialog (diálogos integrados) e OfflineGate (tela sem servidor)
│   │   │   ├── Dashboard/               # Gráficos Donut (Prazos/Semana), Avisos, Gráfico por Matéria
│   │   │   ├── Demands/                 # Cards, Painel de Detalhes (com Editar), Modal Criação/Edição
│   │   │   ├── Agenda/                  # Linha do tempo 00:00-23:00 e Calendário Mensal
│   │   │   ├── Subjects/                # Matérias: cores personalizadas + edição + progresso
│   │   │   ├── Notifications/           # Drawer de Avisos e Notificações em Tempo Real
│   │   │   ├── Tutorial/                # Tour guiado com spotlight/setas — abre no 1º login
│   │   │   └── Layout/                  # Sidebar e Header
│   │   ├── pages/
│   │   │   ├── AuthPage.tsx             # Login / Cadastro (senha contra vazamentos) / Aba Google
│   │   │   ├── DashboardPage.tsx        # Visão geral com gráficos
│   │   │   ├── DemandsPage.tsx          # Lista + filtros + painel de detalhes (com edição)
│   │   │   ├── AgendaPage.tsx           # Calendário e linha do tempo horária
│   │   │   ├── SubjectsPage.tsx         # Matérias com barra de progresso
│   │   │   ├── SettingsPage.tsx         # Perfil, troca de senha, aparência, backup completo e LGPD
│   │   │   └── AdminPage.tsx            # Painel administrativo (gestão de contas, NF03, LGPD)
│   │   ├── services/
│   │   │   └── api.ts                    # Cliente HTTP + helpers OAuth + ping do backend
│   │   ├── context/
│   │   │   └── AuthContext.tsx          # Sessão, login, OAuth, perfil e logout
│   │   ├── utils/
│   │   │   ├── priorityCalculator.ts    # Mesma regra de prioridade do backend
│   │   │   ├── appearance.ts            # Temas de cor, animações e som de notificação
│   │   │   ├── security.ts              # Verificação de senha contra vazamentos (HIBP)
│   │   │   └── date.ts                  # Helpers de data no fuso LOCAL (evita bug UTC)
│   │   ├── types/                       # Tipos TypeScript compartilhados
│   │   ├── App.tsx                      # Shell + callback OAuth + gate de conexão
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docs/                                # Documentação técnica completa (API, arquitetura, segurança, recursos)
│   ├── API-REST.md                      # Referência dos 30 endpoints com exemplos
│   ├── ARQUITETURA-E-DADOS.md            # Stack, pastas, modelo de dados e regras de negócio
│   ├── AUTENTICACAO-E-SEGURANCA.md       # JWT, NF03, Google OAuth, HaveIBeenPwned, rate limit
│   └── RECURSOS-E-IMPLEMENTACAO.md       # Como cada recurso foi implementado
└── README.md
```

---

## 🗄️ Integração com MySQL Workbench & Banco de Dados

### Opção 1: Executar diretamente no MySQL Workbench
1. Abra o **MySQL Workbench**.
2. Conecte-se à sua instância local do MySQL.
3. Abra o arquivo SQL: `backend/database/siesal_workbench_schema.sql`.
4. Execute o script (ícone de raio ⚡) para criar o banco `siesal_db`, as tabelas e os dados iniciais.

> O script cria **todas as colunas** usadas pelo Prisma, incluindo `escola`, `turma`, `is_admin`, `tentativas_falhas` e `bloqueado_ate`.

### Opção 2: Utilizando o Prisma ORM
No diretório `backend/`:
1. Configure suas credenciais no arquivo `.env`:
   ```env
   DATABASE_URL="mysql://usuario:senha@localhost:3306/siesal_db"
   PORT=3001
   JWT_SECRET="siesal_secret_jwt_key_2026_super_secure"
   ```
2. Gere o cliente Prisma e sincronize o schema:
   ```bash
   cd backend
   npm install
   npm run prisma:generate
   npm run prisma:db:push
   npm run prisma:seed
   ```

> 💡 **Importante:** se o banco já existir de uma versão antiga, execute `npm run prisma:db:push` para alinhar as tabelas com o `schema.prisma` (o comando adiciona colunas novas sem apagar dados).

---

## 🚀 Como Executar o Sistema

### ⚡ Opção Rápida: Iniciar Backend e Frontend Juntos (Recomendado)
Na raiz do projeto:
```bash
npm run dev
```
> Ou dê um **duplo clique** no arquivo `iniciar.bat`.
> Ambos os serviços iniciarão simultaneamente no mesmo terminal:
> - 📡 **Backend Express**: `http://localhost:3001`
> - 💻 **Frontend Vite**: `http://localhost:5173`

### Opção Manual (Terminais Separados)

#### 1. Iniciar o Backend (Node.js + Express)
```bash
cd backend
npm install
npm run dev
```
> O servidor Express iniciará em: `http://localhost:3001`  
> Rota de saúde: `http://localhost:3001/api/health`

#### 2. Iniciar o Frontend (Vite + React)
Em outro terminal:
```bash
cd frontend
npm install
npm run dev
```
> A aplicação abrirá em: `http://localhost:5173`

### Conta de demonstração (seed)
| E-mail | Senha |
|---|---|
| `jose.arimateia@escola.gov.br` | `123456` |

---

## 🔐 Login com Google (OAuth 2.0 real)

A tela de login possui **três abas**: **Entrar**, **Criar Conta** e **Google**. A aba Google usa o fluxo oficial **Authorization Code Flow** do Google — não há senha do Google passando pelo SIESAL em nenhum momento.

### Como funciona o fluxo

```
┌────────────┐   1. GET /api/auth/google?state=...   ┌──────────────────┐
│  Frontend   │ ────────────────────────────────────▶ │  Backend SIESAL   │
│  (React)    │                                        │                  │
│             │   2. 302 → tela oficial de login       │  valida config   │
│             │      accounts.google.com               │  e guarda state  │
│             │ ◀───────────────────────────────────── └──────────────────┘
│             │   3. Aluno autoriza na conta Google
│             │   4. Google → 302 /api/auth/google/callback?code=...&state=...
│             │ ────────────────────────────────────▶  Backend troca o code
│             │                                        │ pelos tokens do  │
│             │   5. 302 frontend /oauth/callback      │ Google, lê nome +│
│             │      ?login_code (uso único, 60s)      │ e-mail verificado│
│  JWT salvo  │ ◀───────────────────────────────────── │ e emite o JWT    │
│  na sessão  │   6. POST /api/auth/google/exchange    └──────────────────┘
│             │      → { token, usuario }
└────────────┘
```

**Proteções implementadas:**

- **`state` anti-CSRF** — gerado no frontend (sessionStorage), transmitido pelo Google e validado em duas etapas (callback do backend e retorno ao frontend);
- **E-mail verificado obrigatório** — o backend só aceita perfis com `email_verified: true` no Google;
- **`login_code` de uso único (60 s)** — o token JWT **nunca** trafega na URL do navegador;
- **Cadastro automático** — no primeiro acesso a conta é criada com 7 matérias padrão e notificação de boas-vindas; a senha gerada é aleatória e inutilizável (o acesso é sempre via Google);
- **Sessão padrão da API** — o token emitido é o mesmo JWT `Bearer` de 7 dias usado por todas as rotas.

### ⚙️ Configuração (obrigatória, ~5 minutos)

1. Acesse [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials);
2. **Criar credenciais → ID do cliente OAuth → Aplicativo da Web**;
3. Em **URIs de redirecionamento autorizados**, adicione:
   ```
   http://localhost:3001/api/auth/google/callback
   ```
4. Em **Origens JavaScript autorizadas**, adicione: `http://localhost:5173`;
5. No arquivo `backend/.env`, descomente e preencha:
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxx
   FRONTEND_URL=http://localhost:5173
   ```
6. Reinicie o backend.

> A aba Google no login mostra automaticamente **se o provedor está configurado** (`GET /api/auth/google/status`) e, se não estiver, exibe este guia na própria tela. Enquanto isso, as abas de e-mail/senha seguem funcionando normalmente.


---

## 📡 Referência da API REST

Todos os endpoints abaixo estão implementados no código (`backend/src/routes`), exigem `Authorization: Bearer <token>` (exceto os públicos marcados) e retornam JSON.

### Autenticação (`/api/auth`)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` **(pública)** | Cadastra aluno (nome, e-mail, senha, escola, turma), cria 7 matérias padrão + notificação de boas-vindas e devolve JWT |
| POST | `/auth/login` **(pública)** | Login com e-mail/senha; aplica bloqueio NF03 após 5 tentativas erradas |
| GET | `/auth/google/status` **(pública)** | Informa se o login com Google está configurado no servidor |
| GET | `/auth/google` **(pública)** | Inicia o fluxo: redireciona o navegador à tela oficial de consentimento do Google |
| GET | `/auth/google/callback` **(pública)** | Recebe o retorno do Google, troca o `code` pelos tokens, valida o e-mail verificado e redireciona ao frontend com `login_code` de uso único |
| POST | `/auth/google/exchange` **(pública)** | Troca o `login_code` (60 s) por `{ token, usuario }` |
| GET | `/auth/profile` | Dados do usuário autenticado |
| PUT | `/auth/profile` | Atualiza nome, escola e turma do perfil |
| PUT | `/auth/password` | Altera a senha (exige senha atual; zera tentativas de bloqueio) |
| DELETE | `/auth/account` | Exclui a própria conta e todos os dados (LGPD) |

### Demandas (`/api/demands`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/demands` | Lista demandas do usuário; filtros: `id_marcador`, `prioridade`, `status`, `dificuldade`, `tipo`, `search`; prioridade recalculada dinamicamente |
| GET | `/demands/:id` | Detalhes de uma demanda |
| POST | `/demands` | Cria demanda (título e prazo obrigatórios; prioridade automática; opção `criar_lembrete`) |
| PUT | `/demands/:id` | Atualiza demanda e recalcula prioridade |
| PATCH | `/demands/:id/toggle` | Alterna Pendente ↔ Concluído |
| DELETE | `/demands/:id` | Exclui demanda |

### Matérias / Marcadores (`/api/subjects`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/subjects` | Lista matérias com contagem de tarefas |
| POST | `/subjects` | Cria matéria (nome + cor) |
| PUT | `/subjects/:id` | Atualiza nome/cor |
| DELETE | `/subjects/:id` | Exclui matéria (tarefas ficam sem matéria — `onDelete: SetNull`) |

### Eventos / Agenda (`/api/events`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/events` | Lista eventos; filtros por `date` (dia local) ou `month`+`year` |
| POST | `/events` | Cria evento (título, início, fim, local) |
| PUT | `/events/:id` | Atualiza evento |
| DELETE | `/events/:id` | Exclui evento |

### Notificações (`/api/notifications`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/notifications` | Lista notificações do usuário |
| PATCH | `/notifications/:id/read` | Marca uma notificação como lida |
| POST | `/notifications/read-all` | Marca todas como lidas |

### Estatísticas (`/api/stats`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/stats/dashboard` | Agregados para o Dashboard: "Todos os Prazos", "Essa Semana", distribuição por matéria e últimos avisos |

### Administração (`/api/admin` — exige `is_admin`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/admin/stats` | Uptime, latência/estado do MySQL, memória do processo, totais do banco |
| GET | `/admin/users` | Lista todos os usuários com contadores de dados |
| POST | `/admin/broadcast` | Envia aviso (título + mensagem) para todos os alunos |
| POST | `/admin/purge-notifications` | Remove notificações já lidas de todos os usuários |
| PUT | `/admin/users/:id/status` | Ativa/desativa a conta de um usuário (desativado não faz login); bloqueia alterar a própria conta |
| POST | `/admin/users/:id/unlock` | Desbloqueia conta travada pelo NF03 (zera tentativas e bloqueio) |
| DELETE | `/admin/users/:id` | Exclui usuário e todos os dados (LGPD); bloqueia excluir admins e a própria conta |

### Utilitários
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` **(pública)** | Status do servidor |

---

## 🎨 Opções de Personalização

O SIESAL permite que cada aluno deixe o sistema com a sua cara — tudo em **Configurações → Aparência e Personalização**, aplicado na hora e lembrado no navegador (localStorage):

| Personalização | Como funciona |
|---|---|
| **Cor de destaque (6 temas)** | Ciano (padrão), Azul, Violeta, Esmeralda, Âmbar e Rosa. As paletas `cyan`/`sky` do Tailwind são alimentadas por variáveis CSS (`--cNNN`/`--sNNN`); ao escolher um tema, o sistema recalcula as 11 tonalidades de cada paleta preservando saturação/luminosidade e sobrescreve as variáveis no `<html>` — **a interface inteira recolor instantaneamente**, sem recarregar (botões, gráficos de destaque, sidebar, modais, tour...). |
| **Reduzir Animações** | Desliga os efeitos de movimento (classe `siesal-reduced-motion` no `<html>`). Por padrão o sistema também respeita a preferência "reduzir movimento" do Windows/sistema operacional. |
| **Alertas Sonoros** | Toca um **bipe real baixado da internet** (`public/sounds/notification-beep.ogg`, Google Sound Library — CC BY 4.0) sempre que chega uma **nova** notificação, com bipe sintetizado de reserva se o arquivo falhar. Os avisos são buscados a cada **12 segundos** (tempo real) e o áudio é desbloqueado no primeiro clique. |
| **Lembretes de Prazos** | Define se o checkbox "ativar lembrete 24h antes" vem marcado por padrão ao criar demandas. |
| **Restaurar Padrões** | Um clique volta ao tema ciano com animações ativas. |

### 🔔 Notificações em tempo real

- **Polling inteligente a cada 12s**: o frontend busca silenciosamente apenas as notificações (`GET /api/notifications`) — se um aviso novo chegar (ex.: um **comunicado do administrador** ou uma demanda urgente criada), o **bipe toca** e todos os contadores atualizam sozinhos;
- **Sem bipes falsos**: em falha de rede a busca é ignorada (não cai no modo offline), e o som só toca quando a contagem de não lidas **aumenta** (marcar como lida nunca dispara);
- **Badge na aba do navegador**: o título da aba mostra as não lidas (ex.: `(3) SIESAL...`) mesmo com a janela minimizada;
- **Painel e gaveta sempre atuais**: os "Avisos do Sistema" do Início e a gaveta de notificações derivam da mesma lista ao vivo, atualizando na hora.

> O **tour guiado** tem um passo dedicado mostrando exatamente onde fica essa seção. As cores **semânticas** (matérias, donut de prioridades, Google) continuam fixas por serem informações — apenas o visual de destaque muda.

---

## 🛠️ Console de Administração (Debug)

Para conceder/revogar permissões de administrador (requisito de segurança NF03 — não existe rota HTTP para isso):
```bash
cd backend
npm run console
```
Comandos disponíveis: `start`, `stop`, `restart`, `status`, `grant-admin <email>`, `revoke-admin <email>`, `users`, `clear`, `exit`.

Depois de conceder `is_admin` a uma conta, a **aba oculta "Administrador"** aparece na Sidebar do frontend ao recarregar a página.

---

## ⚙️ Regras de Negócio Principais

### Prioridade dinâmica (`calculateDynamicPriority`)
Calculada automaticamente a partir do **prazo** e da **dificuldade**:

| Prazo restante | Fácil | Médio | Difícil |
|---|---|---|---|
| Vencido ou ≤ 24h | Urgente | Urgente | Urgente |
| ≤ 3 dias | Proximo | Urgente | Urgente |
| ≤ 7 dias | Proximo | Proximo | Urgente |
| ≤ 14 dias | Longe | Proximo | Proximo |
| > 14 dias | Longe | Longe | Proximo |

### Segurança NF03 (bloqueio de conta)
- A partir da **5ª senha incorreta** a conta fica bloqueada por **15 minutos**;
- Mensagens sempre genéricas ("E-mail ou senha incorretos") para não revelar quais e-mails existem;
- O contador **zera** após login bem-sucedido ou quando o bloqueio expira;
- A mesma regra vale para o login direto e para a página de autorização OAuth.

### Datas e fusos horários
Todas as comparações de data do frontend usam helpers de **fuso local** (`frontend/src/utils/date.ts`), e o backend monta os limites de dia/mês no horário local do servidor — evitando que eventos do fim do dia "pulem" para o dia seguinte.

### Modo offline (fallback local)
**Bloqueio quando o servidor cai (v2):** o frontend monitora o backend com um ping a cada 5 segundos. Se ele ficar **fora do ar**, o sistema é **bloqueado** com a tela integrada **"Servidor SIESAL fora do ar"** (estilo a aba "sem internet" do navegador), com checklist de soluções, tentativa de reconexão automática e botão "Tentar novamente" — quando a conexão volta, o app libera sozinho. Os diálogos nativos do navegador (`confirm`/`alert`/`prompt`) foram substituídos pelo **SiesalDialog**, janelas integradas com o visual do sistema, incluindo confirmações digitadas ("DELETAR") para ações irreversíveis.

---

## 🔐 Requisitos Implementados

- **F01 (Calendário Interativo)**: Calendário mensal navegável com visualização de dias e eventos — abre no **mês atual** do usuário.
- **F02 (Sistema de Lembretes)**: Lembretes vinculados a tarefas e compromissos (opção ao criar demanda, 24h antes do prazo).
- **F03 (Marcadores de Tarefas)**: Categorização com cores customizadas para cada disciplina escolar.
- **F04 (Área de Notificações)**: Central de avisos para atividades vencendo no dia e prioritárias.
- **F05 (Cadastro de Usuários)**: Criação de conta com hash bcrypt seguro (12 rounds) + 7 matérias padrão.
- **F06 (Login de Usuários)**: Autenticação JWT **ou** login com Google (OAuth 2.0 Authorization Code real).
- **F07 (Organização de Eventos)**: Grade horária de 00:00 a 23:00 e compromissos por datas.
- **NF01 (Interface Responsiva)**: Layout adaptável para computadores, tablets e smartphones.
- **NF02 (Facilidade de Uso)**: Visual escuro neon moderno com feedback instantâneo e **tour guiado na prática**: assim que o aluno faz login pela primeira vez, o sistema abre automaticamente um passo a passo que aponta com uma **seta para cada recurso real da tela** (gráficos, botão "Nova Demanda", filtros, lista e detalhes de demandas, agenda, calendário, matérias, notificações e configurações) explicando o que a função faz e como usá-la. Reversível a qualquer momento pelo botão **Ajuda** da barra lateral.
- **NF03 (Segurança)**: Bloqueio automático após 5 tentativas incorretas de senha; autenticação obrigatória em todas as rotas de negócio; sem cabeçalhos de impersonação; login Google protegido com `state` anti-CSRF, e-mail verificado obrigatório e token via código de uso único; **rate limiting** (30 req/min por IP nas rotas de autenticação) e cabeçalhos de segurança HTTP.
- **NF04 (Senhas contra vazamentos)**: no cadastro e na troca de senha, o SIESAL consulta a base pública **HaveIBeenPwned** com o modelo *k-anonymity* (apenas 5 caracteres do hash SHA-1 saem do computador) e **recusa senhas já vazadas na internet**, informando quantas vezes a senha apareceu em vazamentos.

---

## 🧰 Solução de Problemas (Troubleshooting)

### ❌ `EADDRINUSE: address already in use :::3001`
Já existe **outro backend rodando** na porta 3001 (outro terminal, o Console de Debug ou uma instância antiga). O servidor agora mostra instruções claras em vez de travar com erro críptico. Para resolver:
```powershell
# PowerShell — descobre e encerra o processo que ocupa a porta:
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
```
Depois execute `npm run dev` novamente.

### ❌ `The column ... does not exist in the current database` (ex.: `usuario.is_admin`)
O banco foi criado com um script **antigo** (ou recriado pelo Workbench com a versão antiga do SQL). Alinhe as tabelas com o schema do Prisma — o comando adiciona colunas novas **sem apagar dados**:
```bash
cd backend
npm run prisma:db:push
```
> ⚠️ Se for recriar o banco pelo MySQL Workbench, abra o arquivo **atualizado** do disco (`backend/database/siesal_workbench_schema.sql`) — ele já contém `escola`, `turma` e `is_admin`.

---

## 🆕 Novidades da versão 2.0 (V2)

**Edição e organização**
- **Editar demandas**: botão do lápis no Painel de Detalhes abre o formulário preenchido; a prioridade é recalculada automaticamente ao salvar (`PUT /demands/:id`);
- **Cores personalizadas para matérias**: seletor de cor completo (qualquer tom) além da paleta rápida, e **edição de matérias** (renomear/recolorir) direto no modal de Matérias;
- **Badge "Atrasada"**: demandas com prazo vencido ganham destaque vermelho pulsante no card e no painel de detalhes;
- **Barra de progresso por matéria** na página de Matérias (X% concluído);
- **Backup completo** em JSON: perfil + demandas + matérias + eventos + notificações.

**Segurança (NF04)**
- Verificação de senha contra **bases públicas de vazamentos (HaveIBeenPwned, k-anonymity)** no cadastro e na troca de senha — senhas vazadas são recusadas com a contagem de ocorrências, sem enviar a senha para lugar nenhum;
- **Rate limiting** (30 req/min por IP) nas rotas de autenticação + cabeçalhos de segurança HTTP no backend.

**Painel do Administrador V2**
- **Ativar/desativar contas** (usuário desativado não faz login);
- **Desbloquear contas travadas pelo NF03** com um clique;
- **Excluir usuários** com todos os dados (LGPD) — com guardas que impedem excluir a própria conta e contas admin;
- Coluna de **status real** na tabela (Ativo / Inativo / Bloqueado-NF03) e card de **Demandas Atrasadas** nas métricas.

**Experiência integrada**
- **SiesalDialog**: fim das janelas nativas do navegador — todos os `confirm`/`alert`/`prompt` viraram diálogos com o visual do SIESAL, incluindo confirmação digitada ("DELETAR") para ações irreversíveis, com suporte a Esc/Enter;
- **Tela "Servidor SIESAL fora do ar"**: quando o backend cai, o sistema bloqueia com uma tela estilo a aba "sem internet" (checklist de soluções + reconexão automática a cada 5s + botão "Tentar novamente");
- **Bipe real baixado da internet** (Google Sound Library — CC BY 4.0) para as notificações, com bipe sintetizado de reserva;
- **Correção do tour guiado**: o cartão agora é medido de verdade e sempre reposicionado dentro da tela (fim do tutorial fora da viewport);
- Identidade visual atualizada: o selo **PRO** virou **V2** em todo o sistema (Header, Painel Admin, health check e versões).

---

## 🐛 Correções da versão anterior (1.1)

**Segurança**
- Removido o cabeçalho `x-user-id`, que permitia se passar por qualquer usuário sem senha;
- Removido o antigo endpoint falso `/auth/google` (aceitava qualquer e-mail sem verificação) — substituído pelo **Google OAuth 2.0 real** (Authorization Code, e-mail verificado obrigatório, `state` anti-CSRF e token entregue via código de uso único);
- Erros HTTP do backend deixaram de ser silenciados pelo modo offline do frontend.

**Banco de dados**
- Script SQL do Workbench atualizado com as colunas `escola`, `turma` e `is_admin` (antes o login/register falhavam com erro 500 por divergência de schema);
- `prisma db push` alinha bancos antigos sem perda de dados.

**Backend**
- Rota de troca de senha implementada (`PUT /auth/password` — o controlador existia mas não estava conectado);
- Nova rota `PUT /auth/profile` para persistir o perfil editado nas Configurações;
- Bloqueio NF03 reinicia a contagem após a expiração do bloqueio;
- Filtro de eventos por dia/mês corrigido para horário local (bug de fuso UTC);
- Erro de porta ocupada (`EADDRINUSE`) agora exibe instruções claras em vez de travar o servidor;
- Login com Google implementado no backend (`/auth/google`, `/auth/google/callback`, `/auth/google/exchange`, `/auth/google/status`).

**Frontend**
- Nova aba de login **Google (OAuth 2.0 real)** com verificação de configuração, guia de setup na própria tela e callback `/oauth/callback`;
- Agenda abre no mês/dia **atuais** (antes fixava setembro/2026);
- Gráfico donut do Dashboard recalculado (fatias se sobrepunham e mostravam proporções erradas);
- Painel de detalhes de demanda não exibia mais dados obsoletos após concluir/editar;
- Botão "Ver Demandas" na página de Matérias agora filtra de verdade pela matéria;
- Linha do tempo da Agenda exibe todos os eventos da hora (antes só o primeiro) e respeita o fuso local;
- Página de Configurações realmente salva o perfil e permite alterar a senha;
- Tutorial refeito como **tour guiado na prática**: spotlight com seta apontando para cada recurso real da interface, navegação automática pelas abas, 15 passos explicando como usar cada função e abertura automática no primeiro login;
- Nova seção **"Aparência e Personalização"** nas Configurações: 6 temas de cor de destaque (aplicados na hora em toda a interface via variáveis CSS), opção de reduzir animações, som de notificação real (Web Audio) e lembrete automático persistido — antes esses dois últimos toggles não salvavam nem faziam nada;
- **Avisos em tempo real**: polling de 12s das notificações (o bipe toca e os contadores/avisos atualizam sozinhos quando chega um comunicado novo), áudio desbloqueado no primeiro clique (política de autoplay dos navegadores) e badge de não lidas no título da aba;
- Classes de animação inexistentes corrigidas; vazamento de `URL.createObjectURL` no backup corrigido; componente de login morto (`AuthModal`) removido.
