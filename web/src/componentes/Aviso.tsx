import type { ReactNode } from 'react';

// Mensagem de status: erro vira alerta; informação vira status educado
export function Aviso({
  tipo = 'info',
  children,
}: {
  tipo?: 'info' | 'warn';
  children: ReactNode;
}) {
  return (
    <div className={`notice ${tipo}`} role={tipo === 'warn' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
