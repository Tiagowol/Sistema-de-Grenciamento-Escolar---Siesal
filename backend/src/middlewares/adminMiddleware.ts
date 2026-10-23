import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { prisma } from '../services/prisma';

export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Acesso negado. Autenticação obrigatória.' });
    }

    const user = await prisma.usuario.findUnique({
      where: { id_usuario: req.userId },
      select: { is_admin: true },
    });

    if (!user || !user.is_admin) {
      return res.status(403).json({
        error: 'Acesso restrito. Esta área é exclusiva para administradores credenciados via Console.',
      });
    }

    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao validar privilégios de administrador.' });
  }
};
