import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Semeando banco de dados do SIESAL...');

  const hashedPassword = await bcrypt.hash('123456', 10);

  // 1. Criar ou atualizar Usuário Demo (José de Arimatéia)
  const usuario = await prisma.usuario.upsert({
    where: { email: 'jose.arimateia@escola.gov.br' },
    update: {},
    create: {
      nome: 'Jose de Arimatéia',
      email: 'jose.arimateia@escola.gov.br',
      senha: hashedPassword,
      status: true,
      tentativas_falhas: 0,
    },
  });

  console.log(`👤 Usuário criado/encontrado: ${usuario.nome} (${usuario.email})`);

  // 2. Criar Marcadores / Matérias do protótipo
  const marcadoresData = [
    { nome: 'Português', cor: '#F97316' },
    { nome: 'Matemática', cor: '#3B82F6' },
    { nome: 'Ciências', cor: '#22C55E' },
    { nome: 'História', cor: '#EAB308' },
    { nome: 'Geografia', cor: '#06B6D4' },
    { nome: 'Artes', cor: '#A855F7' },
    { nome: 'Inglês', cor: '#EC4899' },
  ];

  const marcadoresMap = new Map<string, number>();

  for (const m of marcadoresData) {
    let existing = await prisma.marcador.findFirst({
      where: { nome: m.nome, id_usuario: usuario.id_usuario },
    });

    if (!existing) {
      existing = await prisma.marcador.create({
        data: {
          nome: m.nome,
          cor: m.cor,
          id_usuario: usuario.id_usuario,
        },
      });
    }
    marcadoresMap.set(m.nome, existing.id_marcador);
  }

  console.log('📚 Matérias criadas com sucesso!');

  // 3. Criar Tarefas / Demandas conforme os protótipos
  const tarefasData = [
    {
      titulo: 'Sujeito e Predicado',
      descricao: 'Estudo detalhado de orações sintáticas e classificação de sujeito determinado/indeterminado.',
      data_entrega: new Date('2026-10-06T14:00:00Z'),
      prioridade: 'Urgente',
      status: 'Pendente',
      dificuldade: 'Difícil',
      tipo: 'Atividade',
      professor: 'Diego Cisne',
      id_marcador: marcadoresMap.get('Português'),
    },
    {
      titulo: 'Trabalho: Vírgula',
      descricao: 'Redação dissertativa aplicando as regras de pontuação e vírgula nos períodos compostos.',
      data_entrega: new Date('2026-10-10T18:00:00Z'),
      prioridade: 'Proximo',
      status: 'Pendente',
      dificuldade: 'Médio',
      tipo: 'Trabalho',
      professor: 'Diego Cisne',
      id_marcador: marcadoresMap.get('Português'),
    },
    {
      titulo: 'Equação Primeiro Grau',
      descricao: 'Resolução da lista de 15 exercícios e problemas de fixação da apostila.',
      data_entrega: new Date('2026-10-07T10:00:00Z'),
      prioridade: 'Proximo',
      status: 'Pendente',
      dificuldade: 'Médio',
      tipo: 'Atividade',
      professor: 'Carlos Silva',
      id_marcador: marcadoresMap.get('Matemática'),
    },
    {
      titulo: 'Função Primeiro Grau',
      descricao: 'Construção de gráficos lineares e análise do coeficiente angular e linear.',
      data_entrega: new Date('2026-10-15T23:59:00Z'),
      prioridade: 'Longe',
      status: 'Pendente',
      dificuldade: 'Difícil',
      tipo: 'Atividade',
      professor: 'Carlos Silva',
      id_marcador: marcadoresMap.get('Matemática'),
    },
    {
      titulo: 'Exercícios Sobre Plantas',
      descricao: 'Questionário sobre organografia vegetal, xilema, floema e fotossíntese.',
      data_entrega: new Date('2026-10-08T16:00:00Z'),
      prioridade: 'Proximo',
      status: 'Concluido',
      dificuldade: 'Fácil',
      tipo: 'Atividade',
      professor: 'Marina Souza',
      id_marcador: marcadoresMap.get('Ciências'),
    },
    {
      titulo: 'Revolução Industrial',
      descricao: 'Resumo com mapa mental dos impactos sociais e econômicos da primeira fase da revolução.',
      data_entrega: new Date('2026-10-18T14:00:00Z'),
      prioridade: 'Longe',
      status: 'Pendente',
      dificuldade: 'Médio',
      tipo: 'Trabalho',
      professor: 'Renato Albuquerque',
      id_marcador: marcadoresMap.get('História'),
    },
  ];

  for (const t of tarefasData) {
    const existing = await prisma.tarefa.findFirst({
      where: { titulo: t.titulo, id_usuario: usuario.id_usuario },
    });

    if (!existing) {
      await prisma.tarefa.create({
        data: {
          ...t,
          id_usuario: usuario.id_usuario,
        },
      });
    }
  }

  console.log('📋 Demandas criadas com sucesso!');

  // 4. Criar Eventos da Agenda (Protótipo 5.4)
  const eventosData = [
    {
      titulo: 'Início das aulas',
      descricao: 'Horário de recepção e aulas do turno matutino',
      data_inicio: new Date('2026-09-19T07:00:00Z'),
      data_fim: new Date('2026-09-19T12:00:00Z'),
      local: 'Sala 4B',
    },
    {
      titulo: 'Laboratório de Ciências',
      descricao: 'Aula prática de microscopia celular',
      data_inicio: new Date('2026-09-22T09:30:00Z'),
      data_fim: new Date('2026-09-22T11:30:00Z'),
      local: 'Laboratório de Biologia',
    },
  ];

  for (const ev of eventosData) {
    const existing = await prisma.evento.findFirst({
      where: { titulo: ev.titulo, id_usuario: usuario.id_usuario },
    });

    if (!existing) {
      await prisma.evento.create({
        data: {
          ...ev,
          id_usuario: usuario.id_usuario,
        },
      });
    }
  }

  // 5. Criar Avisos / Notificações (Protótipo 5.1)
  const avisosData = [
    {
      titulo: 'Avisos',
      mensagem: 'O prazo de uma atividade Acaba Hoje',
      lida: false,
    },
    {
      titulo: 'Avisos',
      mensagem: 'O prazo de uma atividade Prioritária acaba logo',
      lida: false,
    },
  ];

  for (const av of avisosData) {
    const existing = await prisma.notificacao.findFirst({
      where: { mensagem: av.mensagem, id_usuario: usuario.id_usuario },
    });

    if (!existing) {
      await prisma.notificacao.create({
        data: {
          ...av,
          id_usuario: usuario.id_usuario,
        },
      });
    }
  }

  console.log('🎉 Seed concluído com sucesso no SIESAL!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
