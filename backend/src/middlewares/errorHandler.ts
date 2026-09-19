import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error Handler]', err);

  const status = err.statusCode || 500;
  const message = err.message || 'Erro interno no servidor.';

  res.status(status).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
