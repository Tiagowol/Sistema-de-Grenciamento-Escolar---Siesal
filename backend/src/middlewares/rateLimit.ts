import { Request, Response, NextFunction } from 'express';

/**
 * Rate limiting simples em memória para as rotas de autenticação.
 *
 * Limita cada endereço IP a MAX_REQUESTS por minuto em rotas sensíveis
 * (login, cadastro, troca de senha e troca de códigos OAuth), reduzindo a
 * superfície para ataques de força bruta em adição ao bloqueio NF03.
 */
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;

const hits = new Map<string, { count: number; resetAt: number }>();

// Limpeza periódica do mapa de IPs
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (entry.resetAt < now) hits.delete(ip);
  }
}, WINDOW_MS).unref();

export function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'desconhecido';
  const now = Date.now();

  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Muitas tentativas seguidas. Aguarde 1 minuto antes de tentar novamente.',
    });
  }

  return next();
}
