import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { errorHandler } from './middlewares/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares essenciais
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'SIESAL - Sistema de Gerenciamento Escolar do Aluno',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Rotas da API REST
app.use('/api', apiRouter);

// Tratador global de erros
app.use(errorHandler);

// Inicialização do servidor
app.listen(PORT, async () => {
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

export default app;
