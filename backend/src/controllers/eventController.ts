import { Response } from 'express';
import { prisma } from '../services/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

/**
 * Constrói limites de dia/mês usando o horário LOCAL do servidor (e não UTC),
 * evitando que eventos do fim do dia sejam filtrados no dia errado por
 * diferenças de fuso horário.
 */
function localDayRange(dateStr: string): { start: Date; end: Date } {
  // Aceita "YYYY-MM-DD" (com ou sem hora)
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  const end = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
  return { start, end };
}

function localMonthRange(year: number, month1to12: number): { start: Date; end: Date } {
  const start = new Date(year, month1to12 - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month1to12, 0, 23, 59, 59, 999);
  return { start, end };
}

export const eventController = {
  // Listar eventos (F07, Protótipo 5.4)
  async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId || 1;
      const { month, year, date } = req.query;

      let whereClause: any = {
        id_usuario: userId,
      };

      if (date) {
        const { start, end } = localDayRange(String(date));
        whereClause.data_inicio = { gte: start, lte: end };
      } else if (month && year) {
        const { start, end } = localMonthRange(Number(year), Number(month));
        whereClause.data_inicio = { gte: start, lte: end };
      }

      const events = await prisma.evento.findMany({
        where: whereClause,
        orderBy: { data_inicio: 'asc' },
      });

      return res.json(events);
    } catch (err) {
      console.error('Erro ao listar eventos:', err);
      return res.status(500).json({ error: 'Erro ao listar eventos.' });
    }
  },

  // Criar evento
  async create(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId || 1;
      const { titulo, descricao, data_inicio, data_fim, local } = req.body;

      if (!titulo || !data_inicio || !data_fim) {
        return res.status(400).json({ error: 'Título, data de início e término são obrigatórios.' });
      }

      const event = await prisma.evento.create({
        data: {
          titulo,
          descricao: descricao || null,
          data_inicio: new Date(data_inicio),
          data_fim: new Date(data_fim),
          local: local || null,
          id_usuario: userId,
        },
      });

      return res.status(201).json(event);
    } catch (err) {
      console.error('Erro ao criar evento:', err);
      return res.status(500).json({ error: 'Erro ao criar evento.' });
    }
  },

  // Atualizar evento
  async update(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId || 1;
      const { id } = req.params;
      const { titulo, descricao, data_inicio, data_fim, local } = req.body;

      const existing = await prisma.evento.findFirst({
        where: { id_evento: Number(id), id_usuario: userId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      const updated = await prisma.evento.update({
        where: { id_evento: Number(id) },
        data: {
          titulo: titulo || existing.titulo,
          descricao: descricao !== undefined ? descricao : existing.descricao,
          data_inicio: data_inicio ? new Date(data_inicio) : existing.data_inicio,
          data_fim: data_fim ? new Date(data_fim) : existing.data_fim,
          local: local !== undefined ? local : existing.local,
        },
      });

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar evento.' });
    }
  },

  // Excluir evento
  async delete(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId || 1;
      const { id } = req.params;

      const existing = await prisma.evento.findFirst({
        where: { id_evento: Number(id), id_usuario: userId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      await prisma.evento.delete({
        where: { id_evento: Number(id) },
      });

      return res.json({ message: 'Evento excluído com sucesso!' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao excluir evento.' });
    }
  },
};
