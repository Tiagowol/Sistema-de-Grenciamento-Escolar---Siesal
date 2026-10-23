# 📡 API REST do SIESAL — Referência Completa

> Documentação técnica de **todos os endpoints** do backend SIESAL v2.0.
> Implementação: `backend/src/routes/` + `backend/src/controllers/`.

---

## Visão Geral

| Item | Valor |
|---|---|
| URL base (desenvolvimento) | `http://localhost:3001/api` |
| Formato de dados | JSON (UTF-8) |
| Autenticação | `Authorization: Bearer <token_jwt>` |
| Documentação viva (OAuth) | `GET /api/auth/google/status` e `GET /api/health` |
| Rota de saúde | `GET /api/health` |

### Convenções de erro

Todas as respostas de erro seguem este formato:

```json
{
  "error": "Mensagem legível para o usuário",
  "field": "email",
  "bloqueado": true,
  "tentativas_restantes": 3
}
```

| Campo | Quando aparece | Descrição |
|---|---|---|
| `error` | Sempre | Mensagem principal do erro |
| `field` | Erros de validação | Campo do formulário culpado (`nome`, `email`, `senha`, `escola`, `turma`, `confirmarSenha`, `novaSenha`...) |
| `bloqueado` | NF03 | `true` quando a conta está bloqueada por tentativas |
| `tentativas_restantes` | NF03 | Tentativas restantes antes do bloqueio automático |

### Códigos de status HTTP utilizados

| Código | Significado no SIESAL |
|---|---|
| `200` | Sucesso (GET/PUT/PATCH/DELETE) |
| `201` | Recurso criado (POST) |
| `400` | Validação de dados / requisição malformada |
| `401` | Sem token / token inválido / senha incorreta |
| `403` | Conta desativada ou **bloqueada (NF03)** / sem privilégios de admin |
| `404` | Recurso não encontrado (ou não pertence ao usuário logado) |
| `409` | Conflito (e-mail já cadastrado — erro Prisma `P2002`) |
| `429` | **Rate limit** excedido (mais de 30 chamadas/min nas rotas de autenticação) |
| `500` | Erro interno do servidor |

---

## 🩺 1. Health Check

### `GET /api/health` — **(pública)**

Verifica se o backend está no ar. Não consulta o banco (por design: o *OfflineGate* do frontend usa esta rota para detectar queda do servidor sem depender do MySQL).

**Resposta `200`:**
```json
{
  "status": "online",
  "system": "SIESAL - Sistema de Gerenciamento Escolar do Aluno",
  "version": "2.0.0",
  "timestamp": "2026-10-20T14:00:00.000Z"
}
```

---

## 🔐 2. Autenticação (`/api/auth`)

> Rotas marcadas com 🚦 possuem **rate limiting**: máximo de **30 requisições por minuto por IP** (resposta `429` ao exceder). Protege contra força bruta em conjunto com o bloqueio NF03.

### 2.1 `POST /auth/register` — **(pública)** 🚦

Cadastra um novo aluno. A senha é hasheada com **bcrypt (12 rounds)**. Automaticamente cria **7 matérias padrão** (Português, Matemática, Ciências, História, Geografia, Artes, Inglês) e uma **notificação de boas-vindas**, e devolve o JWT de sessão.

**Corpo (todos obrigatórios exceto `confirmarSenha`):**
```json
{
  "nome": "João Silva",
  "email": "aluno@escola.gov.br",
  "senha": "senha-forte-123",
  "confirmarSenha": "senha-forte-123",
  "escola": "Escola Municipal Protótipo",
  "turma": "9º Ano B"
}
```

**Validações do servidor:**

| Campo | Regra |
|---|---|
| `nome` | ≥ 2 caracteres, apenas letras/espaços (`/^[a-zA-ZÀ-ÿ\s'-]+$/`) |
| `email` | Formato de e-mail; salvo em minúsculas; único |
| `senha` | ≥ 6 caracteres |
| `escola` | ≥ 3 caracteres |
| `turma` | ≥ 1 caractere |

> 🔒 **Verificação de vazamentos (NF04):** o *frontend* consulta a base HaveIBeenPwned **antes** de chamar esta rota e recusa senhas já vazadas (ver `docs/AUTENTICACAO-E-SEGURANCA.md`). O backend aplica apenas as validações acima.

**Resposta `201`:**
```json
{
  "message": "Conta criada com sucesso! Bem-vindo ao SIESAL.",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id_usuario": 10,
    "nome": "João Silva",
    "email": "aluno@escola.gov.br",
    "escola": "Escola Municipal Protótipo",
    "turma": "9º Ano B",
    "is_admin": false,
    "data_cadastro": "2026-10-20T14:00:00.000Z"
  }
}
```

**Erros:** `400` (validação, com `field`), `409` (e-mail já cadastrado), `429` (rate limit).

---

### 2.2 `POST /auth/login` — **(pública)** 🚦

Login com e-mail e senha. Aplica as regras **NF03**: a 5ª senha errada bloqueia a conta por 15 minutos; mensagens sempre genéricas para não revelar quais e-mails existem; contador zera no login correto ou quando o bloqueio expira.

**Corpo:**
```json
{ "email": "aluno@escola.gov.br", "senha": "senha-forte-123" }
```

**Resposta `200`:** igual ao formato do `register` (com `message: "Login realizado com sucesso!"`).

**Erros:**
- `400` — e-mail/senha ausentes ou inválidos (com `field`)
- `401` — credenciais incorretas; inclui `tentativas_restantes` enquanto houver tentativas
- `403` — conta **desativada** por um administrador, ou **bloqueada** pelo NF03 (inclui `bloqueado: true` e `desbloqueia_em`)

---

### 2.3 `GET /auth/profile` — **(autenticada)**

Dados do usuário autenticado (extraídos do JWT).

**Resposta `200`:**
```json
{
  "id_usuario": 10,
  "nome": "João Silva",
  "email": "aluno@escola.gov.br",
  "escola": "Escola Municipal Protótipo",
  "turma": "9º Ano B",
  "is_admin": false,
  "data_cadastro": "2026-10-20T14:00:00.000Z",
  "status": true
}
```

---

### 2.4 `PUT /auth/profile` — **(autenticada)**

Atualiza **nome, escola e turma** (usado pela tela Configurações → Perfil Escolar). Campos opcionais — só os enviados são alterados. Enviar `null`/`""` em `escola`/`turma` limpa o campo.

**Corpo:**
```json
{ "nome": "João S. Silva", "escola": "Nova Escola", "turma": "1º Colegial" }
```

**Resposta `200`:**
```json
{ "message": "Perfil atualizado com sucesso!", "usuario": { ...perfil_atualizado } }
```

**Erros:** `400` (validações de nome/escola/turma), `401`.

---

### 2.5 `PUT /auth/password` — **(autenticada)** 🚦

Altera a senha. Exige a senha atual; zera as tentativas de bloqueio NF03. O frontend verifica a nova senha contra vazamentos (HIBP) antes de chamar.

**Corpo:**
```json
{
  "senhaAtual": "senha-forte-123",
  "novaSenha": "senha-muito-mais-forte-456",
  "confirmarNovaSenha": "senha-muito-mais-forte-456"
}
```

**Resposta `200`:** `{ "message": "Senha alterada com sucesso!" }`

**Erros:** `400` (validação/confirmção não coincide, com `field`), `401` (`Senha atual incorreta.`, `field: senhaAtual`), `404`, `429`.

---

### 2.6 `DELETE /auth/account` — **(autenticada)**

Exclui a própria conta e **todos** os dados associados (demandas, matérias, eventos, lembretes e notificações) — direito de esquecimento da **LGPD**. As relações usam `onDelete: Cascade`, portanto uma única exclusão limpa tudo.

**Resposta `200`:**
```json
{ "message": "Sua conta e todos os dados associados foram excluídos com sucesso." }
```

---

## 🔗 3. Login com Google — OAuth 2.0 (`/api/auth/google`)

> Fluxo **Authorization Code real** contra os servidores oficiais do Google. Requer `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `backend/.env` (guia de configuração em `docs/AUTENTICACAO-E-SEGURANCA.md`).
> O JWT **nunca** trafega na URL do navegador: é entregue via `login_code` de uso único.

### 3.1 `GET /auth/google/status` — **(pública)**

Informa ao frontend se o provedor Google está configurado (a aba Google do login usa isto para mostrar o guia de configuração quando falta algo).

**Resposta `200`:**
```json
{ "configured": true, "client_id": "1234-abc.apps.googleusercontent.com", "redirect_uri": null }
```

---

### 3.2 `GET /auth/google?state=...` — **(pública, redirecionamento)**

Inicia o fluxo. Valida a configuração, registra o `state` (validade 10 min, uso único) e redireciona o navegador (HTTP **302**) para a tela de consentimento oficial do Google:

```
https://accounts.google.com/o/oauth2/v2/auth
  ?client_id=...&redirect_uri=http://localhost:3001/api/auth/google/callback
  &response_type=code&scope=openid email profile
  &state=<state>&access_type=online&prompt=select_account
```

**Se não configurado:** redireciona para o frontend em `/oauth/callback?error=google_nao_configurado&state=...`.

---

### 3.3 `GET /auth/google/callback?code=...&state=...` — **(pública, redirecionamento)**

Recebe o retorno do Google e executa no servidor:

1. Valida o `state` (anti-CSRF, uso único) — inválido → `?error=state_invalido`;
2. Troca o `code` pelos tokens (POST em `https://oauth2.googleapis.com/token` com o client_secret);
3. Busca o perfil em `https://www.googleapis.com/oauth2/v3/userinfo`;
4. **Exige `email_verified: true`** do Google;
5. Localiza o aluno pelo e-mail — se for o primeiro acesso, cadastra automaticamente (senha aleatória inutilizável + 7 matérias padrão + notificação de boas-vindas);
6. Emite o JWT do SIESAL e guarda num `login_code` de **uso único (60 s)**;
7. Redireciona (302) o navegador para: `http://localhost:5173/oauth/callback?login_code=<código>&state=<state>`.

**Códigos de erro possíveis no redirect** (o frontend traduz todos para mensagens amigáveis em `App.tsx`):

| `error=` | Significado |
|---|---|
| `google_nao_configurado` | Faltam credenciais no backend/.env |
| `google_autorizacao_recusada` | O usuário cancelou a tela do Google |
| `state_invalido` | State anti-CSRF não confere (possível ataque) |
| `google_codigo_ausente` | Google não devolveu o código |
| `google_token_invalido` | Falha na troca do code pelos tokens |
| `google_perfil_indisponivel` | Não foi possível ler o perfil |
| `google_email_nao_verificado` | E-mail do Google sem verificação |
| `conta_desativada` | Conta SIESAL desativada por um admin |
| `google_falha_interna` | Erro inesperado no servidor |

---

### 3.4 `POST /auth/google/exchange` — **(pública)** 🚦

O frontend troca o `login_code` (da URL do callback) pela sessão completa. Código expira em 60 s e é apagado após o primeiro uso.

**Corpo:** `{ "code": "cMnsAEzz4ELcmj..." }`

**Resposta `200`:**
```json
{
  "message": "Login com Google realizado com sucesso!",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": { ...mesmo formato do login... }
}
```

**Erros:** `400` (código ausente, inválido ou expirado), `429`.

---

## 📋 4. Demandas (`/api/demands`) — **(todas autenticadas)**

### 4.1 `GET /demands`

Lista as demandas do usuário logado, **agrupáveis por filtros**. A prioridade é recalculada dinamicamente na hora da leitura (regra prazo × dificuldade — ver `docs/ARQUITETURA-E-DADOS.md`).

**Query params (todos opcionais):**

| Parâmetro | Exemplo | Descrição |
|---|---|---|
| `id_marcador` | `?id_marcador=3` | Filtra por matéria (`todos` = ignora) |
| `prioridade` | `?prioridade=Urgente` | Filtra **após** o recálculo dinâmico (`Urgente`, `Proximo`, `Longe`) |
| `status` | `?status=Pendente` | `Pendente` / `Concluido` (`todos` = ignora) |
| `dificuldade` | `?dificuldade=Difícil` | `Fácil` / `Médio` / `Difícil` |
| `tipo` | `?tipo=Prova` | `Atividade` / `Trabalho` / `Prova` / `Exercício` |
| `search` | `?search=vírgula` | Busca textual em título, descrição e professor |

**Resposta `200`** (array; ordenado por prazo crescente):
```json
[
  {
    "id_tarefa": 12,
    "titulo": "Sujeito e Predicado",
    "descricao": "Estudo das orações sintáticas",
    "data_criacao": "2026-10-01T12:00:00.000Z",
    "data_entrega": "2026-10-06T14:00:00.000Z",
    "prioridade": "Urgente",
    "status": "Pendente",
    "dificuldade": "Difícil",
    "tipo": "Atividade",
    "professor": "Diego Cisne",
    "id_usuario": 10,
    "id_marcador": 1,
    "marcador": { "id_marcador": 1, "nome": "Português", "cor": "#F97316" },
    "lembretes": []
  }
]
```

### 4.2 `GET /demands/:id`
Detalhe de uma demanda — só se pertencer ao usuário (`findFirst` com `id_usuario`). **`404`** caso contrário (não vaza dados de terceiros).

### 4.3 `POST /demands`

Cria uma demanda. **Título e prazo são obrigatórios**. A `prioridade` é calculada automaticamente pelo backend (o valor enviado é ignorado). Opcionais: `criar_lembrete: true` (gera lembrete 24 h antes do prazo — F02) e, se a prioridade resultante for `Urgente`, uma notificação é criada automaticamente.

**Corpo:**
```json
{
  "titulo": "Trabalho de Vírgula",
  "descricao": "Redação aplicando pontuação",
  "data_entrega": "2026-10-25T18:00",
  "dificuldade": "Médio",
  "tipo": "Trabalho",
  "professor": "Diego Cisne",
  "id_marcador": 1,
  "criar_lembrete": true
}
```
**Resposta `201`:** a demanda criada (com `marcador` incluso e `prioridade` recalculada).
**Erros:** `400` (`Título e Data de Entrega são obrigatórios.`).

### 4.4 `PUT /demands/:id`

**Edição** (v2): atualiza qualquer campo enviado e **recalcula a prioridade** com o novo prazo/dificuldade. Usado pelo botão ✏️ do Painel de Detalhes.

**Corpo:** campos de `POST` (sem `criar_lembrete`). **`404`** se não pertencer ao usuário.

### 4.5 `PATCH /demands/:id/toggle`
Alterna o status: `Pendente ↔ Concluido`. Responde com a demanda atualizada e prioridade recalculada.

### 4.6 `DELETE /demands/:id`
Exclui a demanda (os lembretes vinculados caem via cascade). **`404`** se não pertencer ao usuário.

---

## 🎨 5. Matérias / Marcadores (`/api/subjects`) — **(todas autenticadas)**

### 5.1 `GET /subjects`
Lista matérias do usuário com contagem de tarefas (`_count.tarefas`), ordenadas por nome. A `cor` aceita **qualquer hex** (ex.: `#8b5cf6`) — o frontend oferece paleta rápida + seletor de cor personalizada.

```json
[
  { "id_marcador": 1, "nome": "Português", "cor": "#F97316", "id_usuario": 10, "_count": { "tarefas": 4 } }
]
```

### 5.2 `POST /subjects`
**Corpo:** `{ "nome": "Filosofia", "cor": "#8b5cf6" }` (ambos obrigatórios). **`201`** com a matéria criada.

### 5.3 `PUT /subjects/:id`
**Edição** (v2): renomear e/ou trocar a cor. **Corpo:** `{ "nome": "Filosofia", "cor": "#a78bfa" }` (campos opcionais).

### 5.4 `DELETE /subjects/:id`
Exclui a matéria. As demandas vinculadas **não são apagadas** — ficam sem matéria (`onDelete: SetNull` no Prisma).

---

## 📅 6. Eventos / Agenda (`/api/events`) — **(todas autenticadas)**

### 6.1 `GET /events`

Lista eventos do usuário. Filtros por **dia** ou **mês** usam limites construídos no **horário local do servidor** (funções `localDayRange`/`localMonthRange` — corrigiu o bug de fuso UTC que "pulava" eventos do fim do dia).

| Parâmetro | Exemplo | Descrição |
|---|---|---|
| `date` | `?date=2026-10-19` | Apenas eventos daquele dia local (00:00–23:59) |
| `month` + `year` | `?month=10&year=2026` | Apenas eventos do mês local |

### 6.2 `POST /events`
**Corpo:** `{ "titulo": "Feira de Ciências", "descricao": "...", "data_inicio": "2026-10-22T09:30", "data_fim": "2026-10-22T11:30", "local": "Laboratório 2" }` — título, início e fim obrigatórios. **`201`**.

### 6.3 `PUT /events/:id`
Atualiza os campos enviados. **`404`** se não pertencer ao usuário.

### 6.4 `DELETE /events/:id`
Exclui o evento (lembretes vinculados caem via cascade).

---

## 🔔 7. Notificações (`/api/notifications`) — **(todas autenticadas)**

> O frontend consulta `GET /notifications` a cada **12 segundos** (tempo real) via `api.pollNotifications()`.

### 7.1 `GET /notifications`
Lista as notificações do usuário, mais recentes primeiro (`data_envio desc`). Notificações nascem de: boas-vindas, demanda urgente criada, avisos do administrador (broadcast) e auditoria do OAuth.

```json
[
  {
    "id_notificacao": 30,
    "titulo": "Bem-vindo ao SIESAL! 🎓",
    "mensagem": "Olá, João! Sua conta foi criada com sucesso...",
    "data_envio": "2026-10-20T14:00:00.000Z",
    "lida": false,
    "id_usuario": 10
  }
]
```

### 7.2 `PATCH /notifications/:id/read`
Marca uma como lida. **`404`** se não pertencer ao usuário.

### 7.3 `POST /notifications/read-all`
Marca todas como lidas (`updateMany`). Resposta: `{ "message": "Todas as notificações foram marcadas como lidas." }`.

---

## 📊 8. Estatísticas do Dashboard (`/api/stats`) — **(autenticada)**

### `GET /stats/dashboard`

Agregados calculados **no momento da chamada** para os gráficos do Início:

```json
{
  "todosOsPrazos": { "total": 6, "urgente": 2, "proximo": 2, "longe": 1, "concluido": 1 },
  "essaSemana":   { "total": 3, "urgente": 1, "proximo": 1, "longe": 0, "concluido": 1 },
  "distribuicaoMaterias": [
    { "id_marcador": 1, "nome": "Português", "cor": "#F97316", "total": 4, "pendentes": 3, "concluidas": 1 }
  ],
  "avisos": [ ...5 notificações mais recentes... ]
}
```

- `todosOsPrazos` — todas as demandas, com prioridade recalculada;
- `essaSemana` — apenas entregas dentro da semana corrente (domingo a domingo, horário local);
- `distribuicaoMaterias` — contagens por matéria (base do gráfico de barras/pizza);
- `avisos` — as 5 últimas notificações (o painel do Início usa a lista ao vivo das notificações, sincronizada pelo polling).

---

## 🛡️ 9. Administração (`/api/admin`) — **(todas exigem `is_admin`)**

> Pipeline de acesso: `authMiddleware` (JWT) → `adminMiddleware` (consulta `is_admin` no banco). Usuários comuns recebem **`403`** com a mensagem "Acesso restrito...". Privilégio só é concedido via **Console de Debug** (`npm --prefix backend run console` → `grant-admin email`).

### 9.1 `GET /admin/stats`

Diagnóstico do servidor e métricas gerais (v2 com campos extras):

```json
{
  "status": "online",
  "uptimeSeconds": 75412,
  "uptimeFormatted": "20h 56m 52s",
  "database": {
    "connected": true,
    "latencyMs": 12,
    "engine": "MySQL (Prisma ORM)",
    "totalUsers": 8,
    "totalDemands": 24,
    "totalEvents": 6,
    "totalNotifications": 31,
    "demandsOverdue": 4,
    "activeUsers": 7,
    "newSignups7d": 3
  },
  "server": {
    "nodeVersion": "v24.21.0",
    "platform": "win32",
    "memoryRssMb": "112.40",
    "memoryHeapMb": "48.20"
  },
  "timestamp": "2026-10-20T14:00:00.000Z"
}
```

| Campo novo (v2) | Descrição |
|---|---|
| `demandsOverdue` | Demandas de todos os alunos com prazo vencido e status ≠ Concluido |
| `activeUsers` | Contas com `status = true` |
| `newSignups7d` | Cadastros nos últimos 7 dias |

### 9.2 `GET /admin/users`

Lista todos os usuários com contadores e **campos de bloqueio** (v2) usados pela coluna de status da tabela:

```json
[
  {
    "id_usuario": 10,
    "nome": "João Silva",
    "email": "aluno@escola.gov.br",
    "escola": "Escola...",
    "turma": "9º Ano B",
    "is_admin": false,
    "status": true,
    "data_cadastro": "...",
    "tentativas_falhas": 0,
    "bloqueado_ate": null,
    "_count": { "tarefas": 4, "marcadores": 7, "eventos": 1 }
  }
]
```

### 9.3 `POST /admin/broadcast`

Envia um aviso (notificação) para **todos** os usuários (`createMany`). Os alunos ouvem o bipe em até 12 s (polling em tempo real).

**Corpo:** `{ "titulo": "⚠️ Manutenção Programada", "mensagem": "O sistema passará por melhorias hoje às 22h." }`

**Resposta `200`:** `{ "message": "Aviso transmitido com sucesso para 8 estudante(s)!", "count": 8 }`

### 9.4 `POST /admin/purge-notifications`

Remove as notificações **já lidas** de todos os usuários (`deleteMany where lida: true`).

**Resposta `200`:** `{ "message": "12 notificações lidas foram removidas.", "purged": 12 }`

### 9.5 `PUT /admin/users/:id/status` — **(v2)**

Ativa/desativa uma conta. Conta desativada recebe **`403`** ao tentar logar ("Esta conta foi desativada..."). 

**Corpo:** `{ "ativo": false }`

**Guardas de segurança:** `400` se `ativo` não for booleano; **`400` se o alvo for a própria conta do admin** ("Você não pode alterar o status da sua própria conta."). **`404`** se o usuário não existir.

### 9.6 `POST /admin/users/:id/unlock` — **(v2)**

Desbloqueia uma conta travada pelo **NF03**: zera `tentativas_falhas` e limpa `bloqueado_ate`. Log da ação é impresso no console do servidor.

**Resposta `200`:** `{ "message": "Conta de João desbloqueada com sucesso.", "usuario": { ..., "tentativas_falhas": 0, "bloqueado_ate": null } }`

### 9.7 `DELETE /admin/users/:id` — **(v2)**

Exclui um usuário e **todos** os dados (cascade — LGPD).

**Guardas de segurança:**
- `400` — excluir a própria conta ("Use Configurações → Gestão de Dados.");
- `400` — excluir uma conta `is_admin` (revoque antes via console `revoke-admin`);
- `404` — usuário inexistente.

**Resposta `200`:** `{ "message": "Conta de João e todos os dados associados foram excluídos." }`

---

## 📎 Apêndice: verificação rápida com PowerShell

```powershell
# Health check
Invoke-RestMethod http://localhost:3001/api/health

# Login (guarde o token)
$login = Invoke-RestMethod -Method POST -Uri http://localhost:3001/api/auth/login `
  -ContentType "application/json" -Body '{"email":"jose.arimateia@escola.gov.br","senha":"123456"}'

# Chamada autenticada
Invoke-RestMethod http://localhost:3001/api/demands -Headers @{ Authorization = "Bearer $($login.token)" }
```
