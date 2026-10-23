import { Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

export const adminController = {
  // Informações de diagnóstico do servidor e banco de dados
  async getSystemStats(req: AuthRequest, res: Response) {
    try {
      const startTime = (global as any).serverStartTime || Date.now();
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Teste de conexão ativa com o banco de dados
      let dbConnected = false;
      let dbLatencyMs = 0;
      let totalUsers = 0;
      let totalDemands = 0;
      let totalEvents = 0;
      let totalNotifications = 0;
      let demandsOverdue = 0;
      let activeUsers = 0;
      let newSignups7d = 0;

      try {
        const startDb = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        dbLatencyMs = Date.now() - startDb;
        dbConnected = true;

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        [totalUsers, totalDemands, totalEvents, totalNotifications] = await Promise.all([
          prisma.usuario.count(),
          prisma.tarefa.count(),
          prisma.evento.count(),
          prisma.notificacao.count(),
        ]);

        // Métricas extras de administração (v2)
        [demandsOverdue, activeUsers, newSignups7d] = await Promise.all([
          prisma.tarefa.count({
            where: { data_entrega: { lt: new Date() }, status: { not: 'Concluido' } },
          }),
          prisma.usuario.count({ where: { status: true } }),
          prisma.usuario.count({ where: { data_cadastro: { gte: weekAgo } } }),
        ]);
      } catch (dbErr) {
        dbConnected = false;
      }

      const memUsage = process.memoryUsage();

      return res.json({
        status: 'online',
        uptimeSeconds,
        uptimeFormatted: formatUptime(uptimeSeconds),
        database: {
          connected: dbConnected,
          latencyMs: dbLatencyMs,
          engine: 'MySQL (Prisma ORM)',
          totalUsers,
          totalDemands,
          totalEvents,
          totalNotifications,
          demandsOverdue,
          activeUsers,
          newSignups7d,
        },
        server: {
          nodeVersion: process.version,
          platform: process.platform,
          memoryRssMb: (memUsage.rss / 1024 / 1024).toFixed(2),
          memoryHeapMb: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao obter métricas de administrador.' });
    }
  },

  // Listar usuários do sistema com contadores de dados
  async listUsers(req: AuthRequest, res: Response) {
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
          data_cadastro: true,
          tentativas_falhas: true,
          bloqueado_ate: true,
          _count: {
            select: {
              tarefas: true,
              marcadores: true,
              eventos: true,
            },
          },
        },
        orderBy: { id_usuario: 'asc' },
      });

      return res.json(users);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
  },

  // Ativar/desativar a conta de um usuário (contas desativadas não conseguem logar)
  async setUserStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { ativo } = req.body;

      if (typeof ativo !== 'boolean') {
        return res.status(400).json({ error: 'Informe "ativo" (true/false).' });
      }

      const user = await prisma.usuario.findUnique({ where: { id_usuario: Number(id) } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      if (user.id_usuario === req.userId) {
        return res.status(400).json({ error: 'Você não pode alterar o status da sua própria conta.' });
      }

      const updated = await prisma.usuario.update({
        where: { id_usuario: user.id_usuario },
        data: { status: ativo },
        select: { id_usuario: true, nome: true, status: true },
      });

      console.log(`[ADMIN] Usuário ID ${user.id_usuario} (${user.email}) ${ativo ? 'reativado' : 'desativado'} por admin ID ${req.userId}.`);

      return res.json({
        message: `Conta de ${updated.nome} ${ativo ? 'reativada' : 'desativada'} com sucesso.`,
        usuario: updated,
      });
    } catch (err) {
      console.error('Erro ao alterar status do usuário:', err);
      return res.status(500).json({ error: 'Erro ao alterar status do usuário.' });
    }
  },

  // Desbloquear conta bloqueada pelo NF03 (zera tentativas e libera o acesso)
  async unlockUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.usuario.findUnique({ where: { id_usuario: Number(id) } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const updated = await prisma.usuario.update({
        where: { id_usuario: user.id_usuario },
        data: { tentativas_falhas: 0, bloqueado_ate: null },
        select: { id_usuario: true, nome: true, tentativas_falhas: true, bloqueado_ate: true },
      });

      console.log(`[ADMIN] Conta ${user.email} desbloqueada (NF03) por admin ID ${req.userId}.`);

      return res.json({
        message: `Conta de ${updated.nome} desbloqueada com sucesso.`,
        usuario: updated,
      });
    } catch (err) {
      console.error('Erro ao desbloquear usuário:', err);
      return res.status(500).json({ error: 'Erro ao desbloquear usuário.' });
    }
  },

  // Excluir permanentemente um usuário e todos os seus dados (LGPD)
  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.usuario.findUnique({ where: { id_usuario: Number(id) } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      if (user.id_usuario === req.userId) {
        return res.status(400).json({ error: 'Você não pode excluir sua própria conta por aqui. Use Configurações → Gestão de Dados.' });
      }

      if (user.is_admin) {
        return res.status(400).json({ error: 'Não é possível excluir uma conta de administrador. Revogue o acesso primeiro pelo console (revoke-admin).' });
      }

      // Cascade remove tarefas, eventos, notificações, marcadores e lembretes
      await prisma.usuario.delete({ where: { id_usuario: user.id_usuario } });

      console.log(`[ADMIN] Usuário ID ${user.id_usuario} (${user.email}) excluído por admin ID ${req.userId}.`);

      return res.json({ message: `Conta de ${user.nome} e todos os dados associados foram excluídos.` });
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      return res.status(500).json({ error: 'Erro ao excluir usuário.' });
    }
  },

  // Enviar aviso global ou aviso de manutenção para todos os alunos
  async broadcastMaintenanceNotice(req: AuthRequest, res: Response) {
    try {
      const { titulo, mensagem } = req.body;

      if (!titulo || !mensagem) {
        return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
      }

      const users = await prisma.usuario.findMany({ select: { id_usuario: true } });

      const notificationsData = users.map((u) => ({
        titulo: String(titulo).trim(),
        mensagem: String(mensagem).trim(),
        id_usuario: u.id_usuario,
      }));

      await prisma.notificacao.createMany({
        data: notificationsData,
      });

      console.log(`[ADMIN BROADCAST] Aviso enviado para ${users.length} usuário(s): "${titulo}"`);

      return res.json({
        message: `Aviso transmitido com sucesso para ${users.length} estudante(s)!`,
        count: users.length,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao transmitir aviso de manutenção.' });
    }
  },

  // Limpeza de cache de notificações antigas
  async purgeOldNotifications(req: AuthRequest, res: Response) {
    try {
      const deleted = await prisma.notificacao.deleteMany({
        where: { lida: true },
      });

      return res.json({
        message: `${deleted.count} notificações lidas foram removidas.`,
        purged: deleted.count,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao limpar notificações antigas.' });
    }
  },
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
