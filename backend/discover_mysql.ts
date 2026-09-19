import { PrismaClient } from '@prisma/client';

const passwordsToTry = [
  '',
  'root',
  '123456',
  '1234',
  '12345678',
  'password',
  'mysql',
  'admin',
  'tiago',
  'Tiago',
  'tiago123',
  'siesal',
  'root123',
];

async function findWorkingPassword() {
  for (const pwd of passwordsToTry) {
    const url = pwd
      ? `mysql://root:${encodeURIComponent(pwd)}@localhost:3306/siesal_db`
      : `mysql://root@localhost:3306/siesal_db`;

    const prisma = new PrismaClient({
      datasources: {
        db: { url },
      },
    });

    try {
      await prisma.$connect();
      console.log(`\n🎉 ENCONTRADO! Senha do MySQL root é: "${pwd}"`);
      console.log(`URL de Conexão válida: ${url}\n`);
      await prisma.$disconnect();
      return pwd;
    } catch (e: any) {
      if (e.message.includes('Unknown database') || e.message.includes('database `siesal_db` does not exist')) {
        console.log(`\n🎉 ENCONTRADO! Senha do MySQL root é: "${pwd}" (O banco siesal_db precisa ser criado)`);
        console.log(`URL de Conexão válida: ${url}\n`);
        await prisma.$disconnect();
        return pwd;
      }
      console.log(`Tentativa senha "${pwd}": falhou`);
      await prisma.$disconnect().catch(() => {});
    }
  }
  console.log('Nenhuma das senhas padrão funcionou automaticamente.');
  return null;
}

findWorkingPassword();
