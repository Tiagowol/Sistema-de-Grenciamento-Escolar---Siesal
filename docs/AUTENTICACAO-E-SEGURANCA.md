# 🔐 Autenticação e Segurança do SIESAL

> Documentação completa dos mecanismos de autenticação e das camadas de segurança do SIESAL v2.0: sessão JWT, bloqueio NF03, Google OAuth 2.0, verificação de senhas contra vazamentos (HaveIBeenPwned), rate limiting e cabeçalhos HTTP.

---

## 1. Sessão JWT

**Arquivos:** `backend/src/controllers/authController.ts` (`generateSessionToken`), `backend/src/middlewares/authMiddleware.ts`.

### Como funciona

1. Após login/cadastro/troca do `login_code` (Google), o backend assina um **JWT HS256** com o segredo do `JWT_SECRET` (`backend/.env`);
2. **Payload:** `{ id_usuario, email }` — nada sensível (sem senha/hash);
3. **Validade:** 7 dias (`expiresIn: '7d'`);
4. O frontend guarda em `localStorage` (`@siesal:token`) e envia em **todas** as chamadas: `Authorization: Bearer <token>`;
5. O `authMiddleware` valida a assinatura/expiração e injeta `req.userId`/`req.userEmail`; **não existe caminho alternativo** — o antigo atalho de demonstração via cabeçalho `x-user-id` foi removido por permitir impersonação sem senha.

```ts
// middlewares/authMiddleware.ts (resumo)
const decoded = jwt.verify(token, JWT_SECRET) as { id_usuario: number; email: string };
req.userId = decoded.id_usuario;   // usado por TODOS os controllers
req.userEmail = decoded.email;
```

### Proteção de recursos (multiusuário)
Todo controller busca com `findFirst({ id, id_usuario: req.userId })` — um usuário **nunca** acessa registros de outro, mesmo conhecendo os IDs. Tokens de outros usuários também não ajudam: o `userId` vem sempre do próprio JWT.

### Isolamento de privilégios
Rotas administrativas passam por **dois** middlewares encadeados:

```
request → authMiddleware (JWT válido?) → adminMiddleware (is_admin no banco?) → controller
```

O `adminMiddleware` consulta `is_admin` **no banco a cada requisição** (não confia no JWT — revogar admin invalida o acesso imediatamente). Contas comuns recebem `403`.

---

## 2. NF03 — Bloqueio automático de conta

**Arquivos:** `authController.ts` (`verifyCredentials`), `googleAuthController.ts` (mesma função), `adminController.ts` (`unlockUser`).

### Regras

| Regra | Implementação |
|---|---|
| 5 senhas erradas | `tentativas_falhas + 1 >= 5` → grava `bloqueado_ate = agora + 15 min` |
| Durante o bloqueio | Login devolve **403** com `bloqueado: true` e minutos restantes |
| Mensagem genérica | "E-mail ou senha incorretos..." — não revela se o e-mail existe |
| Aviso progressivo | Cada falha devolve `tentativas_restantes` para a UI |
| Sucesso zera | Login correto → `tentativas_falhas: 0, bloqueado_ate: null` |
| Expiração reinicia | Se o bloqueio já venceu, a próxima falha **recomeça do zero** (não trava para sempre) |
| Desbloqueio admin | `POST /admin/users/:id/unlock` zera na hora |

### Compartilhada entre login direto e OAuth
`verifyCredentials()` é **exportada** do `authController` e usada também pelo `googleAuthController` no consentimento (na v1 era o SIESAL ID; atualmente usada em qualquer caminho que exija e-mail/senha), garantindo que **não existe rota de autenticação que ignore o NF03**.

---

## 3. Senhas contra vazamentos (NF04 — HaveIBeenPwned)

**Arquivos:** `frontend/src/utils/security.ts`, usos em `AuthPage.tsx` (cadastro) e `SettingsPage.tsx` (troca de senha).

### O problema
Senhas como `123456` ou `senha123` aparecem em **vazamentos de dados públicos** e são a primeira tentativa de qualquer invasor. O SIESAL recusa essas senhas na hora.

### Como foi feito — modelo k-anonymity

```
Senha: "123456"
  1. SHA-1 no navegador (crypto.subtle)  →  7C4A8D09CA376A2E67A...  (fica no computador)
  2. Só o PREFIXO de 5 chars sai          →  GET https://api.pwnedpasswords.com/range/7C4A8
  3. Servidor devolve ~800 sufixos        →  1D09CA376A...:210461208
  4. Front compara o SUFIXO local          →  achou! = senha vazada 210.461.208 vezes
```

- A **senha completa (e mesmo o hash completo) nunca sai do computador** do usuário;
- O serviço recebe apenas 5 caracteres do hash — a mesma proteção usada por bancos e grandes provedores;
- **Se o serviço estiver fora do ar**, a verificação retorna `null` e o cadastro **não é bloqueado** (graceful degradation — a segurança extra nunca tira o sistema do ar).

### Onde é aplicada
| Tela | Comportamento |
|---|---|
| **Criar Conta** (AuthPage) | Antes do `POST /register`: senha vazada → erro no campo: *"Senha insegura: já apareceu em vazamentos de dados N vez(es)"* |
| **Alterar Senha** (Configurações) | Mesma checagem na `novaSenha` antes do `PUT /auth/password` |

### Verificação de força (barrinha de progresso)
`getPasswordStrength()` pontua comprimento (≥6, ≥10), mistura maiúscula/minúscula, dígitos e símbolos → rótulos *Muito fraca → Muito forte* com cores.

---

## 4. Login com Google — OAuth 2.0 Authorization Code

**Arquivos:** `backend/src/controllers/googleAuthController.ts`, `frontend/src/pages/AuthPage.tsx` (aba Google), `frontend/src/App.tsx` (callback), `frontend/src/context/AuthContext.tsx` (`loginWithGoogleCode`).

### 4.1 Configuração obrigatória (~5 min)
1. Acesse [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials);
2. **Criar credenciais → ID do cliente OAuth → Aplicativo da Web**;
3. **URI de redirecionamento autorizada:** `http://localhost:3001/api/auth/google/callback`;
4. **Origem JavaScript:** `http://localhost:5173`;
5. Preencha no `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxx
   FRONTEND_URL=http://localhost:5173
   ```
6. Reinicie o backend. A aba Google do login mostra o guia automaticamente enquanto `GET /auth/google/status` responder `configured: false`.

### 4.2 Sequência completa do fluxo

```
┌──────────┐                                  ┌──────────┐                        ┌──────────┐
│ Frontend │                                  │ Backend  │                        │  Google  │
│ (React) │                                  │ (Express)│                        │ (oficial)│
└────┬─────┘                                  └────┬─────┘                        └────┬─────┘
     │ 1. GET /auth/google/status                    │                                  │
     │ ◀──────────────── { configured: true } ────────│                                  │
     │ 2. gera state (sessionStorage) + redirect ────▶│ 3. registra state (10 min, 1 uso)│
     │                                               │ ── 4. 302 ──────────────────────▶ │
     │                                               │        accounts.google.com        │
     │                                          5. aluno autentica e AUTORIZA no Google │
     │                                               │ ◀─ 6. 302 callback?code&state ── │
     │                                               │ 7. valida state (uso único)      │
     │                                               │ 8. POST /token (client_secret) ─▶│
     │                                               │ ◀── 9. access_token ──────────── │
     │                                               │ 10. GET /userinfo ─────────────▶│
     │                                               │ ◀── nome + email_VERIFICADO ──── │
     │                                               │ 11. acha/cria aluno; emite JWT; │
     │                                               │     guarda login_code (60 s)    │
     │ ◀── 12. 302 /oauth/callback?login_code&state ──│                                  │
     │ 13. valida state vs sessionStorage             │                                  │
     │ 14. POST /auth/google/exchange { code } ──────▶│ 15. consome code → { token, usuario }
     │ 16. salva sessão (localStorage) + entra no app │                                  │
```

### 4.3 Camadas de segurança do fluxo

| Camada | O que previne |
|---|---|
| **`state` anti-CSRF** (gerado no frontend, guardado no `sessionStorage`, validado no backend na ida e no frontend na volta) | Ataque de "login CSRF" — alguém injetar a própria sessão no navegador da vítima |
| **State de uso único + 10 min** (mapa em memória no backend) | Replay do redirect |
| **`email_verified: true` obrigatório** (lido do userinfo oficial) | Contas Google sem e-mail verificado |
| **`client_secret` só no backend** | Apps clientes (o frontend) nunca manipulam credenciais do Google |
| **`login_code` de uso único (60 s)** em vez do JWT na URL | Token de sessão não fica no histórico/endereço do navegador |
| **Conta Google → senha aleatória inutilizável** (hash de 24 bytes aleatórios) | Ninguém "adivinha" a senha de uma conta criada via Google |
| **Rate limit** em `/auth/google/exchange` | Força bruta contra o trocador de códigos |
| **Notificação de boas-vindas** ao aluno no primeiro acesso | Transparência da criação automática da conta |

### 4.4 Extensibilidade para testes
Os endpoints do Google (`accounts.google.com`, `oauth2.googleapis.com/token`, `userinfo`) são **enviáveis por variáveis** (`GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_USERINFO_URL`). Foi assim que o fluxo foi validado ponta-a-ponta com um **mock local** do Google durante o desenvolvimento — os mesmos passos do §4.2, sem depender do serviço externo.

---

## 5. Rate Limiting (força bruta)

**Arquivo:** `backend/src/middlewares/rateLimit.ts` — aplicado em `register`, `login`, `google/exchange` e `password` (rotas marcadas 🚦 em `docs/API-REST.md`).

- **Limite:** 30 requisições/min por IP (janela de 60 s);
- **Estrutura:** `Map<ip, { count, resetAt }>` em memória com limpeza periódica (`setInterval` com `.unref()` para não travar o encerramento);
- **Resposta:** `429` + `"Muitas tentativas seguidas. Aguarde 1 minuto antes de tentar novamente."`;
- **Complementa o NF03:** o bloqueio é por *conta* (5 senhas), o rate limit é por *origem* — mesmo distribuído em várias contas, o IP não passa de 30 tentativas/min.

---

## 6. Cabeçalhos de segurança HTTP

**Arquivo:** `backend/src/server.ts` (middleware global, antes das rotas).

| Cabeçalho | Valor | Previne |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | MIME-sniffing (browser "adivinhar" tipo de conteúdo) |
| `X-Frame-Options` | `DENY` | Clickjacking (site embutir o SIESAL num iframe) |
| `Referrer-Policy` | `no-referrer` | Vazamento da URL (com tokens em query) via Referrer |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Acesso indevido a recursos do dispositivo |

---

## 7. Outras proteções implementadas

| Proteção | Onde | Detalhe |
|---|---|---|
| **Hash de senha forte** | `authController` | bcrypt com 12 rounds |
| **E-mails normalizados** | cadastro/login/Google | `trim().toLowerCase()` sempre — impossível criar duplicatas por case |
| **Exclusão LGPD** | `DELETE /auth/account` + admin | Cascade remove 100% dos dados do usuário |
| **Guardas de auto-ação (admin)** | `adminController` | Admin não pode desativar/excluir **a própria conta** nem excluir **outro admin** via HTTP |
| **`is_admin` só via console** | `debug_console.ts` | Nenhuma rota HTTP cria administradores — comprometimento de um admin não escala |
| **Códigos OTP de uso único** | Google OAuth | `state` e `login_code` apagados do mapa após consumo |
| **Mensagens genéricas de login** | NF03 | Não oraculam e-mails existentes |
| **JWT nunca na URL** | Google flow | Entrega via `login_code` trocado por POST |
| **Sem `x-user-id`** | authMiddleware | Atalho de impersonação removido na v2 |
