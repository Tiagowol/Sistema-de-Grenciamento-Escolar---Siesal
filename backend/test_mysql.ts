import { PrismaClient } from '@prisma/client';

async function testConnection() {
  console.log('🔍 Testando conexão com o MySQL na porta 3306...');
  console.log('DATABASE_URL configurada:', process.env.DATABASE_URL);

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('✅ Conexão com o MySQL realizada com SUCESSO!');
    const usersCount = await prisma.usuario.count();
    console.log(`📊 Usuários encontrados no banco: ${usersCount}`);
  } catch (err: any) {
    console.error('❌ Falha ao conectar ao MySQL:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
