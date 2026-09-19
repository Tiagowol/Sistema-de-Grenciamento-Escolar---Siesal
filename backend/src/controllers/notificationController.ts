import { Response } from 'express';
import { prisma } from '../services/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

export const notificationController = {
  // Listar notificações do usuário (F04, Protótipo Avisos)
  async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId || 1;

      const notifications = await prisma.notificacao.findMany({
        where: { id_usuario: userId },
        orderBy: { data_envio: 'desc' },
      });

      return res.json(notifications);
    } catch (err) {
      console.error('Erro ao listar notificações:', err);
      return res.status(500).json({ error: 'Erro ao listar notificações.' });
    }
  },

  // Marcar como lida
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId || 1;
      const { id } = req.params;

      const existing = await prisma.notificacao.findFirst({
        where: { id_notificacao: Number(id), id_usuario: userId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Notificação não encontrada.' });
      }

      const updated = await prisma.notificacao.update({
        where: { id_notificacao: Number(id) },
        data: { lida: true },
      });

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar notificação.' });
    }
  },

  // Marcar todas como lidas
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId || 1;

      await prisma.notificacao.updateMany({
        where: { id_usuario: userId, lida: false },
        data: { lida: true },
      });

      return res.json({ message: 'Todas as notificações foram marcadas como lidas.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao marcar notificações.' });
    }
  },
};
