import { Response } from 'express';
import { prisma } from '../services/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { calculateDynamicPriority } from '../utils/priorityCalculator';

export const statsController = {
  // Obter todas as estatísticas para o Dashboard com prioridades recalculadas
  async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId || 1;

      // Buscar todas as tarefas do usuário
      const rawDemands = await prisma.tarefa.findMany({
        where: { id_usuario: userId },
        include: { marcador: true },
      });

      // Recalcula prioridade dinâmica para todas as demandas
      const allDemands = rawDemands.map((d) => ({
        ...d,
        prioridade: calculateDynamicPriority(d.data_entrega, d.dificuldade || 'Médio'),
      }));

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Métricas globais ("Todos os Prazos")
      const totalPrazos = {
        total: allDemands.length,
        urgente: allDemands.filter((d) => d.prioridade === 'Urgente' && d.status !== 'Concluido').length,
        proximo: allDemands.filter((d) => d.prioridade === 'Proximo' && d.status !== 'Concluido').length,
        longe: allDemands.filter((d) => d.prioridade === 'Longe' && d.status !== 'Concluido').length,
        concluido: allDemands.filter((d) => d.status === 'Concluido').length,
      };

      // Métricas da semana ("Essa Semana")
      const weekDemands = allDemands.filter((d) => {
        const entrega = new Date(d.data_entrega);
        return entrega >= startOfWeek && entrega <= endOfWeek;
      });

      const essaSemana = {
        total: weekDemands.length,
        urgente: weekDemands.filter((d) => d.prioridade === 'Urgente' && d.status !== 'Concluido').length,
        proximo: weekDemands.filter((d) => d.prioridade === 'Proximo' && d.status !== 'Concluido').length,
        longe: weekDemands.filter((d) => d.prioridade === 'Longe' && d.status !== 'Concluido').length,
        concluido: weekDemands.filter((d) => d.status === 'Concluido').length,
      };

      // Distribuição por Matéria (Gráfico)
      const marcadores = await prisma.marcador.findMany({
        where: { id_usuario: userId },
        include: {
          tarefas: true,
        },
      });

      const distribuicaoMaterias = marcadores.map((m) => ({
        id_marcador: m.id_marcador,
        nome: m.nome,
        cor: m.cor,
        total: m.tarefas.length,
        pendentes: m.tarefas.filter((t) => t.status !== 'Concluido').length,
        concluidas: m.tarefas.filter((t) => t.status === 'Concluido').length,
      }));

      // Avisos rápidos para o painel de Avisos
      const avisos = await prisma.notificacao.findMany({
        where: { id_usuario: userId },
        orderBy: { data_envio: 'desc' },
        take: 5,
      });

      return res.json({
        todosOsPrazos: totalPrazos,
        essaSemana,
        distribuicaoMaterias,
        avisos,
      });
    } catch (err) {
      console.error('Erro ao gerar estatísticas do dashboard:', err);
      return res.status(500).json({ error: 'Erro ao obter estatísticas.' });
    }
  },
};
