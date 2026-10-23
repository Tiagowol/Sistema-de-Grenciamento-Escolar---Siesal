import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { errorHandler } from './middlewares/errorHandler';

dotenv.config();

(global as any).serverStartTime = Date.now();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares essenciais
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Cabeçalhos de segurança HTTP (proteção contra clickjacking, MIME-sniffing etc.)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'SIESAL - Sistema de Gerenciamento Escolar do Aluno',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Rotas da API REST
app.use('/api', apiRouter);

// Tratador global de erros
app.use(errorHandler);

// Inicialização do servidor
const server = app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 SIESAL Backend Server rodando com Express na porta ${PORT}`);
  console.log(`📡 URL da API: http://localhost:${PORT}/api`);
  console.log(`🛠️  Health check: http://localhost:${PORT}/api/health`);

  // Verificação da Conexão com o MySQL
  try {
    const { prisma } = await import('./services/prisma');
    await prisma.$connect();
    console.log(`🗄️  Banco de Dados: Conectado ao MySQL com SUCESSO!`);
  } catch (err: any) {
    console.log(`⚠️  Aviso de Conexão MySQL:`);
    console.log(`   ${err.message.split('\n')[0]}`);
    console.log(`   👉 Para conectar ao seu MySQL Workbench:`);
    console.log(`   1. Verifique sua senha no arquivo backend/.env (ex: DATABASE_URL="mysql://root:SUA_SENHA@localhost:3306/siesal_db")`);
    console.log(`   2. Ou execute o script backend/database/siesal_workbench_schema.sql no MySQL Workbench.`);
  }
  console.log(`====================================================`);
});

// Erro amigável quando a porta já está ocupada (antes era um crash críptico EADDRINUSE)
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`❌  NÃO FOI POSSÍVEL INICIAR: a porta ${PORT} já está em uso.`);
    console.error(`    👉 Provavelmente já existe outro SIESAL Backend rodando (outro terminal,`);
    console.error(`       o Console de Debug ou uma instância antiga que não foi fechada).`);
    console.error(`    ✅ Solução:`);
    console.error(`       1. Feche os outros terminais onde o backend está rodando; ou`);
    console.error(`       2. Encerre o processo que ocupa a porta:`);
    console.error(`          PowerShell: Get-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess | Stop-Process -Force`);
    console.error(`       3. Depois execute "npm run dev" novamente.`);
    console.error('');
    process.exit(1);
  }
  throw err;
});

export default app;
