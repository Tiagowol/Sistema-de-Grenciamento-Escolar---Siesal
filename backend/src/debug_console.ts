import readline from 'readline';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { prisma } from './services/prisma';

// Cores ANSI para o terminal
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let serverProcess: ChildProcess | null = null;
let isServerRunning = false;

function banner() {
  console.clear();
  console.log(`${CYAN}${BOLD}`);
  console.log(`========================================================================`);
  console.log(`  🖥️   SIESAL - CONSOLE DE DEBUG & GESTÃO DO SERVIDOR`);
  console.log(`========================================================================${RESET}`);
  console.log(`${YELLOW}Comandos disponíveis:${RESET}`);
  console.log(`  ${BOLD}start${RESET}             - Inicia o servidor backend na porta 3001`);
  console.log(`  ${BOLD}stop${RESET}              - Finaliza o processo do servidor backend`);
  console.log(`  ${BOLD}restart${RESET}           - Reinicia o servidor backend`);
  console.log(`  ${BOLD}status${RESET}            - Exibe status do servidor e conexão com o banco MySQL`);
  console.log(`  ${BOLD}grant-admin <email>${RESET} - ${GREEN}Concede privilégio de ADMINISTRADOR a uma conta${RESET}`);
  console.log(`  ${BOLD}revoke-admin <email>${RESET}- Remove privilégio de administrador de uma conta`);
  console.log(`  ${BOLD}users${RESET}             - Lista todos os usuários cadastrados e privilégios`);
  console.log(`  ${BOLD}clear${RESET}             - Limpa a tela do console`);
  console.log(`  ${BOLD}exit${RESET}              - Encerra o console de debug e desliga o servidor`);
  console.log(`${CYAN}------------------------------------------------------------------------${RESET}\n`);
}

function startServer() {
  if (isServerRunning || serverProcess) {
    console.log(`${YELLOW}[CONSOLE] O servidor já está em execução.${RESET}`);
    return;
  }

  console.log(`${GREEN}[CONSOLE] Iniciando o servidor SIESAL Backend...${RESET}`);

  // Inicia servidor com tsx
  serverProcess = spawn('npx', ['tsx', 'src/server.ts'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  isServerRunning = true;

  serverProcess.stdout?.on('data', (data) => {
    process.stdout.write(`${MAGENTA}[LOG SIESAL]${RESET} ${data.toString()}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    process.stderr.write(`${RED}[ERRO SIESAL]${RESET} ${data.toString()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`${YELLOW}[CONSOLE] O processo do servidor foi encerrado com código ${code}.${RESET}`);
    isServerRunning = false;
    serverProcess = null;
  });
}

function stopServer() {
  if (!isServerRunning || !serverProcess) {
    console.log(`${YELLOW}[CONSOLE] Nenhum servidor está rodando no momento.${RESET}`);
    return;
  }

  console.log(`${RED}[CONSOLE] Encerrando o servidor SIESAL...${RESET}`);
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t']);
  } else {
    serverProcess.kill('SIGTERM');
  }
  isServerRunning = false;
  serverProcess = null;
  console.log(`${GREEN}[CONSOLE] Servidor parado com sucesso.${RESET}`);
}

async function checkStatus() {
  console.log(`${CYAN}--- DIAGNÓSTICO DE STATUS SIESAL ---${RESET}`);
  console.log(`Servidor Backend : ${isServerRunning ? `${GREEN}RODANDO (PID: ${serverProcess?.pid})${RESET}` : `${RED}PARADO${RESET}`}`);

  try {
    const startDb = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startDb;
    const countUsers = await prisma.usuario.count();
    const countAdmins = await prisma.usuario.count({ where: { is_admin: true } });
    const countDemands = await prisma.tarefa.count();

    console.log(`Banco MySQL      : ${GREEN}CONECTADO (${latency}ms)${RESET}`);
    console.log(`Total Usuários   : ${countUsers} (${countAdmins} administrador(es))`);
    console.log(`Total Demandas   : ${countDemands}`);
  } catch (err: any) {
    console.log(`Banco MySQL      : ${RED}DESCONECTADO / ERRO (${err.message.split('\n')[0]})${RESET}`);
  }
  console.log(`${CYAN}------------------------------------${RESET}`);
}

async function grantAdmin(email: string) {
  if (!email || !email.trim()) {
    console.log(`${RED}[ERRO] Informe o e-mail: grant-admin aluno@escola.gov.br${RESET}`);
    return;
  }
  const formattedEmail = email.trim().toLowerCase();
  try {
    const user = await prisma.usuario.findUnique({ where: { email: formattedEmail } });
    if (!user) {
      console.log(`${RED}[ERRO] Usuário com e-mail "${formattedEmail}" não encontrado no banco de dados.${RESET}`);
      return;
    }

    const updated = await prisma.usuario.update({
      where: { id_usuario: user.id_usuario },
      data: { is_admin: true },
    });

    console.log(`\n${GREEN}${BOLD}✔ SUCESSO! A conta "${updated.nome}" (${updated.email}) agora é ADMINISTRADORA DO SIESAL!${RESET}`);
    console.log(`${CYAN}A aba secreta de Administrador será desbloqueada ao recarregar a página.${RESET}\n`);
  } catch (err: any) {
    console.log(`${RED}[ERRO] Falha ao atribuir admin: ${err.message}${RESET}`);
  }
}

async function revokeAdmin(email: string) {
  if (!email || !email.trim()) {
    console.log(`${RED}[ERRO] Informe o e-mail: revoke-admin aluno@escola.gov.br${RESET}`);
    return;
  }
  const formattedEmail = email.trim().toLowerCase();
  try {
    const user = await prisma.usuario.findUnique({ where: { email: formattedEmail } });
    if (!user) {
      console.log(`${RED}[ERRO] Usuário "${formattedEmail}" não encontrado.${RESET}`);
      return;
    }

    await prisma.usuario.update({
      where: { id_usuario: user.id_usuario },
      data: { is_admin: false },
    });

    console.log(`\n${YELLOW}✔ Privilégios de Administrador removidos para ${user.email}.${RESET}\n`);
  } catch (err: any) {
    console.log(`${RED}[ERRO] Falha ao revogar admin: ${err.message}${RESET}`);
  }
}

async function listUsers() {
  try {
    const users = await prisma.usuario.findMany({
      select: {
        id_usuario: true,
        nome: true,
        email: true,
        escola: true,
        turma: true,
        is_admin: true,
        status: true,
      },
      orderBy: { id_usuario: 'asc' },
    });

    console.log(`\n${CYAN}${BOLD}=== LISTA DE USUÁRIOS NO BANCO (${users.length}) ===${RESET}`);
    users.forEach((u) => {
      const adminBadge = u.is_admin ? `${GREEN}[ADMIN]${RESET}` : `${BLUE}[ALUNO]${RESET}`;
      console.log(`ID: ${u.id_usuario} | ${adminBadge} ${BOLD}${u.nome}${RESET} (${u.email}) - ${u.escola || 'Escola não informada'}`);
    });
    console.log(`${CYAN}===========================================${RESET}\n`);
  } catch (err: any) {
    console.log(`${RED}[ERRO ao listar]: ${err.message}${RESET}`);
  }
}

// Inicia Interface de Linha de Comando (CLI)
banner();
startServer();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${CYAN}siesal-debug> ${RESET}`,
});

rl.prompt();

rl.on('line', async (line) => {
  const input = line.trim();
  const [command, ...args] = input.split(' ');

  switch (command.toLowerCase()) {
    case 'start':
      startServer();
      break;

    case 'stop':
      stopServer();
      break;

    case 'restart':
      stopServer();
      setTimeout(startServer, 1000);
      break;

    case 'status':
      await checkStatus();
      break;

    case 'grant-admin':
      await grantAdmin(args[0]);
      break;

    case 'revoke-admin':
      await revokeAdmin(args[0]);
      break;

    case 'users':
      await listUsers();
      break;

    case 'clear':
    case 'cls':
      banner();
      break;

    case 'exit':
    case 'quit':
      console.log(`${YELLOW}Encerrando SIESAL Debug Console...${RESET}`);
      stopServer();
      process.exit(0);
      break;

    case '':
      break;

    default:
      console.log(`${RED}Comando desconhecido: "${command}". Digite "status", "start", "stop", "grant-admin <email>" ou "users".${RESET}`);
      break;
  }

  rl.prompt();
});

rl.on('close', () => {
  stopServer();
  process.exit(0);
});
