# SIESAL - Sistema de Gerenciamento Escolar do Aluno

> **Versão 1.0**  
> Autores: Natanael Francisco de Lima, Miquéias Braga, Domingos Tiago Wagner de Oliveira Lopes, Anna Clara Dias.

---

## Sobre o Projeto

O **SIESAL** é uma solução completa para auxiliar estudantes no gerenciamento de suas atividades diárias, ajudando na organização de tarefas, matérias, eventos, lembretes e notificações de prazos importantes.

---

## Arquitetura do Sistema

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
│   │   ├── controllers/                 # Auth, Demandas, Matérias, Eventos, Notificações, Stats
│   │   ├── middlewares/                 # JWT Auth e Error Handler (com bloqueio NF03 de 5 tentativas)
│   │   ├── routes/                      # Rotas Express REST
│   │   ├── services/                    # Instância do Prisma Client
│   │   └── server.ts                    # Inicialização do Servidor Express
│   ├── .env                             # Configuração de conexão do MySQL
│   ├── package.json
│   └── tsconfig.json
├── frontend/                             # Interface Web Moderna e Responsiva em React + Vite + TS + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/               # Gráficos Donut (Prazos/Semana), Avisos, Gráfico por Matéria
│   │   │   ├── Demands/                 # Cards por Matéria, Painel de Detalhes, Modal de Criação
│   │   │   ├── Agenda/                  # Linha do tempo 00:00-23:00 e Calendário Mensal
│   │   │   ├── Subjects/                # Gerenciamento de Matérias e Cores
│   │   │   ├── Notifications/           # Drawer de Avisos e Notificações em Tempo Real
│   │   │   └── Layout/                  # Sidebar e Header
│   │   ├── pages/                       # Dashboard, Demandas, Agenda e Matérias
│   │   ├── services/                    # Cliente HTTP integrado com o Express
│   │   ├── context/                     # Contexto de Autenticação e Usuário
│   │   ├── App.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```

---

## Integração com MySQL Workbench & Banco de Dados

### Opção 1: Executar diretamente no MySQL Workbench
1. Abra o **MySQL Workbench**.
2. Conecte-se à sua instância local do MySQL.
3. Abra o arquivo SQL: `backend/database/siesal_workbench_schema.sql`.
4. Execute o script (ícone de raio ⚡) para criar o banco `siesal_db`, as tabelas e os dados iniciais.

### Opção 2: Utilizando o Prisma ORM
No diretório `backend/`:
1. Configure suas credenciais no arquivo `.env`:
   ```env
   DATABASE_URL="mysql://usuario:senha@localhost:3306/siesal_db"
   PORT=3001
   JWT_SECRET="siesal_secret_jwt_key_2026_super_secure"
   ```
2. Gere o cliente Prisma e aplique o schema:
   ```bash
   cd backend
   npm install
   npm run prisma:generate
   npm run prisma:db:push
   npm run prisma:seed
   ```

---

## Como Executar o Sistema

### Opção Rápida: Iniciar Backend e Frontend Juntos (Recomendado)
Na raiz do projeto:
```bash
npm run dev
```
> Ou dê um **duplo clique** no arquivo [`iniciar.bat`](file:///c:/Users/Tiago%20Wagner/Documents/Sistema%20de%20Grenciamento%20Escolar%20-%20Siesal/iniciar.bat).  
> Ambos os serviços iniciarão simultaneamente no mesmo terminal:
>  **Backend Express**: `http://localhost:3001`
>  **Frontend Vite**: `http://localhost:5173`

---

### Opção Manual (Terminais Separados)

#### 1. Iniciar o Backend (Node.js + Express)
```bash
cd backend
npm install
npm run dev
```
> O servidor Express iniciará em: `http://localhost:3001`  
> Rota de saúde: `http://localhost:3001/api/health`

### 2. Iniciar o Frontend (Vite + React)
Em outro terminal:
```bash
cd frontend
npm install
npm run dev
```
> A aplicação abrirá em: `http://localhost:5173`

---

## Requisitos Implementados

- **F01 (Calendário Interativo)**: Calendário mensal navegável com visualização de dias e eventos.
- **F02 (Sistema de Lembretes)**: Lembretes vinculados a tarefas e compromissos.
- **F03 (Marcadores de Tarefas)**: Categorização com cores customizadas para cada disciplina escolar.
- **F04 (Área de Notificações)**: Central de avisos para atividades vencendo no dia e prioritárias.
- **F05 (Cadastro de Usuários)**: Criação de conta com hash bcrypt seguro.
- **F06 (Login de Usuários)**: Autenticação JWT.
- **F07 (Organização de Eventos)**: Grade horária de 00:00 a 23:00 e compromissos por datas.
- **NF01 (Interface Responsiva)**: Layout adaptável para computadores, tablets e smartphones.
- **NF02 (Facilidade de Uso)**: Visual escuro neon moderno com feedback instantâneo.
- **NF03 (Segurança)**: Bloqueio automático de segurança após 5 tentativas incorretas de senha.
