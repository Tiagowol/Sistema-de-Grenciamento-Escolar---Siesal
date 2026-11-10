import type { ReactNode } from 'react';
import { Icone, type NomeIcone } from '../icones';

export type Tom = 'blue' | 'teal' | 'amber' | 'red' | 'purple';

export function Titulo({
  olho,
  titulo,
  sub,
  acoes,
}: {
  olho: string;
  titulo: string;
  sub: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{olho}</div>
        <h1>{titulo}</h1>
        <p>{sub}</p>
      </div>
      {acoes ? <div className="actions">{acoes}</div> : null}
    </div>
  );
}

export function Kpi({
  numero,
  rotulo,
  nota,
  icone,
  tom,
}: {
  numero: ReactNode;
  rotulo: string;
  nota: string;
  icone: NomeIcone;
  tom: Tom;
}) {
  return (
    <div className="card kpi">
      <div className="kpi-title">{rotulo}</div>
      <div className={`kpi-icon t-${tom}`}>
        <Icone nome={icone} />
      </div>
      <div className="num">{numero}</div>
      <div className="kpi-note">{nota}</div>
    </div>
  );
}

// A etiqueta sempre tem texto: a cor nunca é a única informação (WCAG 1.4.1)
export function Pill({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <span className={`pill t-${tom}`}>
      <span className="pill-dot" />
      {children}
    </span>
  );
}

export function Progresso({ percentual, rotulo }: { percentual: number; rotulo: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={rotulo}
      aria-valuenow={percentual}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ marginTop: 10, maxWidth: 420 }}
    >
      <span style={{ width: `${percentual}%` }} />
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="timeline-empty">{children}</div>;
}

// Estado "carregando": diferente de "vazio" e de "erro". Texto literal, sem número nem contagem.
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <p role="status" className="carregando muted">
      {texto}
    </p>
  );
}
