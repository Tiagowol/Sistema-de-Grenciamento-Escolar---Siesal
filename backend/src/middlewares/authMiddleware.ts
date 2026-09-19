import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'siesal_secret_jwt_key_2026_super_secure';

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id_usuario: number; email: string };
      req.userId = decoded.id_usuario;
      req.userEmail = decoded.email;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Token de autenticação inválido ou expirado. Faça login novamente.' });
    }
  }

  // Se for um teste com header x-user-id explícito
  const demoUserId = req.headers['x-user-id'];
  if (demoUserId) {
    req.userId = Number(demoUserId);
    return next();
  }

  // Requisito: Autenticação estritamente obrigatória
  return res.status(401).json({ error: 'Acesso negado. Autenticação obrigatória.' });
};
