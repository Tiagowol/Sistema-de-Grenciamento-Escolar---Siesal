# 📘 Documentação Técnica Completa - SIESAL

**Sistema de Gerenciamento Escolar do Aluno (SIESAL)**  
*Versão 1.0 — Documentação Técnica de Arquitetura, API e Código*

---

## 📋 Sumário
1. [Visão Geral e Objetivos](#1-visão-geral-e-objetivos)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Requisitos do Sistema](#3-requisitos-do-sistema)
4. [Modelo de Dados & Banco de Dados (MySQL / Prisma)](#4-modelo-de-dados--banco-de-dados-mysql--prisma)
5. [Documentação da API REST (Backend)](#5-documentação-da-api-rest-backend)
6. [Estrutura e Componentes do Frontend (React + Vite + TypeScript)](#6-estrutura-e-componentes-do-frontend-react--vite--typescript)
7. [Mecanismos de Segurança & Regras de Negócio](#7-mecanismos-de-segurança--regras-de-negócio)
8. [Guia de Instalação e Execução](#8-guia-de-instalação-e-execução)

---

## 1. Visão Geral e Objetivos

O **SIESAL** é uma aplicação web voltada ao público estudantil para organização da rotina de estudos, planejamento de tarefas, controle de horários/eventos acadêmicos, gestão de disciplinas (matérias/marcadores) e acompanhamento de prazos com notificações em tempo real.

### Principais Pilares:
- **Centralização de Demandas:** Agrupamento de trabalhos, provas e tarefas por status (Pendente, Concluído, Atrasado), disciplina e prioridade.
- **Visualização de Agenda:** Grade diária de horários (00:00 - 23:00) e calendário mensal integrados.
- **Gestão Visual por Cores:** Marcadores customizáveis por matéria para fácil identificação visual.
- **Notificações & Métricas:** Central de alertas de atividades pendentes e dashboard interativo com estatísticas de desempenho.

---

## 2. Arquitetura do Sistema

O sistema é construído utilizando uma arquitetura **100% desacoplada** entre cliente (Frontend) e servidor (Backend API), comunicando-se via JSON sobre HTTP/HTTPS com autenticação via JSON Web Tokens (JWT).

```mermaid
graph TD
    User["Estudante / Navegador Web"] -->|HTTPS / JSON| Front["Frontend (React + Vite + TypeScript)"]
    Front -->|Axios REST API| Back["Backend API (Node.js + Express)"]
    Back -->|Middlewares| Auth["JWT Auth & Bloqueio NF03"]
    Back -->|Prisma ORM| DB[(MySQL Database - siesal_db)]
```

### Stack Tecnológica:

| Camada | Tecnologia | Descrição |
|---|---|---|
| **Frontend** | React 18, Vite, TypeScript | SPA rápida com componentes modulares |
| **Estilização** | Tailwind CSS, Lucide Icons | UI responsiva com tema escuro/neon |
| **Backend** | Node.js, Express, TypeScript | API RESTful com roteamento modular |
| **ORM** | Prisma ORM | Abstração de queries e migrations tipo-seguras |
| **Banco de Dados** | MySQL 8.0 | Banco relacional com integridade referencial |
| **Segurança** | JSON Web Token (JWT), Bcrypt | Autenticação stateless e hashing de senhas |

---

## 3. Requisitos do Sistema

### Requisitos Funcionais (F)
- **F01 - Calendário Interativo:** Calendário mensal navegável mostrando dias com eventos e entregas agendadas.
- **F02 - Sistema de Lembretes:** Criação e controle de lembretes associados a tarefas ou eventos.
- **F03 - Marcadores de Tarefas:** Categorização por disciplina/matéria com seleção de cores personalizadas.
- **F04 - Central de Notificações:** Central visual com badges e contador de notificações não lidas.
- **F05 - Cadastro de Usuários:** Registro de estudantes com validação de e-mail único e hash seguro de senha.
- **F06 - Login de Usuários:** Autenticação com e-mail/senha, emissão de JWT e persistência de sessão.
- **F07 - Organização de Eventos:** Agendamento de compromissos em horários específicos da grade diária (00:00 às 23:00).

### Requisitos Não-Funcionais (NF)
- **NF01 - Interface Responsiva:** Layout adaptável para Desktop, Tablet e Mobile.
- **NF02 - Usabilidade & UX:** Tema dark/neon com feedback visual imediato para ações do usuário.
- **NF03 - Segurança contra Força Bruta:** Bloqueio temporário da conta por 15 minutos após 5 tentativas consecutivas de senha incorreta.

---

## 4. Modelo de Dados & Banco de Dados (MySQL / Prisma)

O schema relacional é composto por 6 entidades principais mapeadas via [schema.prisma](file:///c:/Users/Tiago%20Wagner/Documents/Sistema-de-Grenciamento-Escolar---Siesal-73653b19b90690acf5008a7e989ab024254f53e0/backend/prisma/schema.prisma):

```mermaid
erDiagram
    Usuario ||--o{ Marcador : "possui"
    Usuario ||--o{ Tarefa : "cria"
    Usuario ||--o{ Evento : "agenda"
    Usuario ||--o{ Lembrete : "recebe"
    Usuario ||--o{ Notificacao : "recebe"
    Marcador ||--o{ Tarefa : "categoriza"
    Tarefa ||--o{ Lembrete : "gera"
    Evento ||--o{ Lembrete : "gera"
```

### Descrição das Entidades

1. **`usuario`**: Armazena dados cadastrais do aluno, credenciais e estado de bloqueio de segurança.
   - `id_usuario` (PK, Int, AutoIncrement)
   - `nome`, `email` (Unique), `senha` (Bcrypt Hash), `escola`, `turma`
   - `tentativas_falhas` (Int, default 0), `bloqueado_ate` (DateTime, nullable)
2. **`marcador`**: Representa as matérias/disciplinas e suas cores identificadoras.
   - `id_marcador` (PK), `nome`, `cor`, `id_usuario` (FK)
3. **`tarefa`**: Demandas acadêmicas (trabalhos, provas, exercícios).
   - `id_tarefa` (PK), `titulo`, `descricao`, `data_criacao`, `data_entrega`, `prioridade`, `status`, `dificuldade`, `tipo`, `professor`, `id_usuario` (FK), `id_marcador` (FK nullable)
4. **`evento`**: Compromissos com horário marcado.
   - `id_evento` (PK), `titulo`, `descricao`, `data_inicio`, `data_fim`, `local`, `id_usuario` (FK)
5. **`lembrete`**: Avisos programados vinculados a tarefas ou eventos.
   - `id_lembrete` (PK), `mensagem`, `data_hora`, `enviado`, `id_usuario` (FK), `id_tarefa` (FK nullable), `id_evento` (FK nullable)
6. **`notificacao`**: Alertas do sistema gerados para o usuário.
   - `id_notificacao` (PK), `titulo`, `mensagem`, `data_envio`, `lida`, `id_usuario` (FK)

---

## 5. Documentação da API REST (Backend)

Todas as rotas protegidas exigem o cabeçalho `Authorization: Bearer <TOKEN_JWT>`.

### Autenticação (`/api/auth`)
- `POST /api/auth/register`: Criação de novo usuário.
- `POST /api/auth/login`: Autenticação do usuário. Retorna token JWT e perfil. (Aplica regra **NF03**).
- `GET /api/auth/me`: Retorna os dados do usuário autenticado.

### Demandas / Tarefas (`/api/demands`)
- `GET /api/demands`: Lista todas as tarefas do usuário autenticado.
- `POST /api/demands`: Cadastra nova tarefa.
- `PUT /api/demands/:id`: Atualiza dados/status de uma tarefa existente.
- `DELETE /api/demands/:id`: Exclui uma tarefa.

### Matérias / Marcadores (`/api/subjects`)
- `GET /api/subjects`: Lista todas as matérias com contadores de tarefas associadas.
- `POST /api/subjects`: Cria nova matéria com cor customizada.
- `PUT /api/subjects/:id`: Altera nome ou cor da matéria.
- `DELETE /api/subjects/:id`: Remove uma matéria.

### Agenda / Eventos (`/api/events`)
- `GET /api/events`: Retorna eventos e prazos filtrados por período.
- `POST /api/events`: Cria novo evento com horário de início e fim.
- `DELETE /api/events/:id`: Remove evento.

### Notificações (`/api/notifications`)
- `GET /api/notifications`: Lista as notificações do usuário.
- `PATCH /api/notifications/:id/read`: Marca notificação como lida.
- `DELETE /api/notifications/:id`: Exclui notificação.

### Estatísticas (`/api/stats`)
- `GET /api/stats`: Retorna contadores agregados para os gráficos do Dashboard (tarefas por status, concluidas na semana, pendentes por matéria).

---

## 6. Estrutura e Componentes do Frontend (React + Vite + TypeScript)

O frontend está estruturado em componentes visuais reutilizáveis no diretório [`frontend/src/components`](file:///c:/Users/Tiago%20Wagner/Documents/Sistema-de-Grenciamento-Escolar---Siesal-73653b19b90690acf5008a7e989ab024254f53e0/frontend/src/components):

### Estrutura de Diretórios
```
frontend/src/
├── components/
│   ├── Agenda/          # Visualização em linha do tempo e calendário mensal
│   ├── Dashboard/       # Cards com gráficos estatísticos e resumo do dia
│   ├── Demands/         # Lista de tarefas em formato Kanban / Grid e modal de formulário
│   ├── Layout/          # Barra lateral (Sidebar) e cabeçalho (Header)
│   ├── Notifications/   # Drawer lateral de notificações do aluno
│   └── Subjects/        # Lista e criação de matérias/marcadores
├── context/
│   └── AuthContext.tsx  # Estado global de autenticação JWT e usuário logado
├── services/
│   └── api.ts           # Configuração do Axios com interceptor de Token
├── pages/               # Páginas principais (Dashboard, Demandas, Agenda, Matérias, Login)
└── App.tsx              # Gerenciador de rotas e layout principal
```

---

## 7. Mecanismos de Segurança & Regras de Negócio

1. **Hashing de Senha (Bcrypt):**
   - Nenhuma senha é gravada em texto plano. É utilizado salt aleatório com algoritmo Bcrypt para geração do hash antes de persistir no banco.
2. **Autenticação Stateless (JWT):**
   - Os tokens JWT expiram e contêm o `id_usuario` no payload codificado, verificado pelo middleware [`authMiddleware.ts`](file:///c:/Users/Tiago%20Wagner/Documents/Sistema-de-Grenciamento-Escolar---Siesal-73653b19b90690acf5008a7e989ab024254f53e0/backend/src/middlewares/authMiddleware.ts).
3. **Bloqueio NF03 (Tentativas de Login Incorretas):**
   - Ao errar a senha, o campo `tentativas_falhas` é incrementado.
   - Ao atingir 5 tentativas, o campo `bloqueado_ate` é preenchido para 15 minutos no futuro.
   - Tentativas durante o período de bloqueio retornam erro HTTP 429 (Too Many Requests).
4. **Isolamento de Dados por Usuário:**
   - Todas as consultas ao banco contêm obrigatoriamente a cláusula `WHERE id_usuario = req.userId`, garantindo que um aluno jamais acesse dados de outro.

---

## 8. Guia de Instalação e Execução

### Pré-requisitos
- Node.js (v18+)
- MySQL Server (v8.0+)

### Passo a Passo

1. **Configuração de Variáveis de Ambiente (`backend/.env`):**
   ```env
   DATABASE_URL="mysql://root:suasenha@localhost:3306/siesal_db"
   PORT=3001
   JWT_SECRET="sua_chave_secreta_jwt"
   ```

2. **Instalação de Dependências e Banco de Dados:**
   ```bash
   # No diretório backend:
   cd backend
   npm install
   npm run prisma:generate
   npm run prisma:db:push
   npm run prisma:seed
   ```

3. **Execução Simultânea (Backend + Frontend):**
   Na raiz do projeto:
   ```bash
   npm run dev
   ```
   > Ou execute o script [`iniciar.bat`](file:///c:/Users/Tiago%20Wagner/Documents/Sistema-de-Grenciamento-Escolar---Siesal-73653b19b90690acf5008a7e989ab024254f53e0/iniciar.bat).

---

