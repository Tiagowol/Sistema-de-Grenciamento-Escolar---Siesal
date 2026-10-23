import React from 'react';
import { StatsGroup } from '../../types';

interface PieProgressWidgetProps {
  title: string;
  stats: StatsGroup;
}

export const PieProgressWidget: React.FC<PieProgressWidgetProps> = ({ title, stats }) => {
  // Corrigido: cada fatia agora ocupa exatamente a sua proporção da rosca,
  // posicionada em sequência (antes os arcos se sobrepunham a partir do topo).
  const total = stats.total || 0;
  const urgentePct = total > 0 ? (stats.urgente / total) * 100 : 0;
  const proximoPct = total > 0 ? (stats.proximo / total) * 100 : 0;
  const longePct = total > 0 ? (stats.longe / total) * 100 : 0;
  const concluidoPct = total > 0 ? (stats.concluido / total) * 100 : 0;

  // Cálculo das fatias SVG estilo donut (dasharray = [comprimento, resto])
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  const makeSegments = () => {
    const segments = [
      { pct: urgentePct, offset: 0, gradient: 'urgenteGrad', key: 'urgente' },
      { pct: proximoPct, offset: urgentePct, gradient: 'proximoGrad', key: 'proximo' },
      { pct: longePct, offset: urgentePct + proximoPct, gradient: 'longeGrad', key: 'longe' },
      { pct: concluidoPct, offset: urgentePct + proximoPct + longePct, gradient: 'concluidoGrad', key: 'concluido' },
    ];
    return segments.map((seg) => ({
      ...seg,
      dashLength: (seg.pct / 100) * circumference,
      dashOffset: -(seg.offset / 100) * circumference,
    }));
  };

  const segments = makeSegments();

  return (
    <div className="siesal-card rounded-2xl p-5 flex flex-col items-center relative overflow-hidden group">
      <div className="w-full flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">{title}</h2>
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8] animate-pulse-glow"></span>
      </div>

      {/* Gráfico Donut Central com Gradientes Sutis */}
      <div className="relative w-40 h-40 flex items-center justify-center my-0.5">
        <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]" viewBox="0 0 140 140">
          <defs>
            <linearGradient id="concluidoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#00b4d8" />
            </linearGradient>
            <linearGradient id="longeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="proximoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="urgenteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>

          {/* Fundo sutil do círculo */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="12"
            fill="transparent"
          />

          {/* Fatias do donut calculadas individualmente (Urgente → Próximo → Longe → Concluído) */}
          {segments.map((seg) =>
            seg.pct > 0 ? (
              <circle
                key={seg.key}
                cx="70"
                cy="70"
                r={radius}
                stroke={`url(#${seg.gradient})`}
                strokeWidth="12"
                strokeLinecap="butt"
                fill="transparent"
                strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
                strokeDashoffset={seg.dashOffset}
                className="transition-all duration-1000 ease-out"
              />
            ) : null
          )}
        </svg>

        {/* Total no centro */}
        <div className="absolute flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span className="text-3xl font-extrabold text-white tracking-tight glow-cyan group-hover:scale-110 transition-transform duration-300">
            {stats.total}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
            Demandas
          </span>
        </div>
      </div>

      {/* Legendas com Contadores Minimalistas */}
      <div className="w-full grid grid-cols-2 gap-2.5 mt-5 text-xs font-medium">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-white/5 hover:border-orange-500/30 transition-colors">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 shadow-sm shadow-orange-500/50"></span>
            <span className="text-slate-300 text-xs">Urgente</span>
          </div>
          <span className="font-bold text-orange-400 text-xs px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20">
            {stats.urgente}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-white/5 hover:border-sky-500/30 transition-colors">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-blue-500 to-sky-400 shadow-sm shadow-blue-500/50"></span>
            <span className="text-slate-300 text-xs">Próximo</span>
          </div>
          <span className="font-bold text-sky-400 text-xs px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">
            {stats.proximo}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-white/5 hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50"></span>
            <span className="text-slate-300 text-xs">Longe</span>
          </div>
          <span className="font-bold text-emerald-400 text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            {stats.longe}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-white/5 hover:border-cyan-500/30 transition-colors">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-sm shadow-cyan-400/50"></span>
            <span className="text-slate-300 text-xs">Concluído</span>
          </div>
          <span className="font-bold text-cyan-300 text-xs px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">
            {stats.concluido}
          </span>
        </div>
      </div>
    </div>
  );
};
