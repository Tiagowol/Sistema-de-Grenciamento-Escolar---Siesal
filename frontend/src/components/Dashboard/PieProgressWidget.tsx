import React from 'react';
import { StatsGroup } from '../../types';

interface PieProgressWidgetProps {
  title: string;
  stats: StatsGroup;
}

export const PieProgressWidget: React.FC<PieProgressWidgetProps> = ({ title, stats }) => {
  const total = stats.total || 1;
  const urgentePct = (stats.urgente / total) * 100;
  const proximoPct = (stats.proximo / total) * 100;
  const longePct = (stats.longe / total) * 100;
  const concluidoPct = (stats.concluido / total) * 100;

  // Calculando fatias SVG estilo donut
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  const strokeDashoffsetUrgente = 0;
  const strokeDashoffsetProximo = circumference * (1 - urgentePct / 100);
  const strokeDashoffsetLonge = circumference * (1 - (urgentePct + proximoPct) / 100);
  const strokeDashoffsetConcluido = circumference * (1 - (urgentePct + proximoPct + longePct) / 100);

  return (
    <div className="siesal-card rounded-3xl p-6 flex flex-col items-center relative overflow-hidden">
      <div className="w-full text-center mb-4">
        <h2 className="text-base font-bold text-slate-100 tracking-wide">{title}</h2>
      </div>

      {/* Gráfico Donut Central */}
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
          {/* Fundo do círculo */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            stroke="#13275c"
            strokeWidth="14"
            fill="transparent"
          />

          {/* Concluído (Azul / Verde Escuro) */}
          {stats.concluido > 0 && (
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="#00b4d8"
              strokeWidth="14"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffsetConcluido}
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Longe (Verde) */}
          {stats.longe > 0 && (
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="#10b981"
              strokeWidth="14"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffsetLonge}
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Próximo (Ciano / Laranja Claro) */}
          {stats.proximo > 0 && (
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="#38bdf8"
              strokeWidth="14"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffsetProximo}
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Urgente (Laranja Avermelhado) */}
          {stats.urgente > 0 && (
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="#f97316"
              strokeWidth="14"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * urgentePct) / 100}
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>

        {/* Total no centro */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-black text-white glow-cyan">{stats.total}</span>
          <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider">Demandas</span>
        </div>
      </div>

      {/* Legendas com Contadores Fiéis ao Protótipo */}
      <div className="w-full grid grid-cols-2 gap-2 mt-5 text-xs font-medium">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#0e1c44]/80 border border-[#1b3472]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#f97316]"></span>
            <span className="text-slate-300">Urgente</span>
          </div>
          <span className="font-bold text-orange-400 bg-orange-950/60 px-2 py-0.5 rounded-lg">
            {stats.urgente}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-[#0e1c44]/80 border border-[#1b3472]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#38bdf8]"></span>
            <span className="text-slate-300">Próximo</span>
          </div>
          <span className="font-bold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded-lg">
            {stats.proximo}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-[#0e1c44]/80 border border-[#1b3472]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#10b981]"></span>
            <span className="text-slate-300">Longe</span>
          </div>
          <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg">
            {stats.longe}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-[#0e1c44]/80 border border-[#1b3472]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#00b4d8]"></span>
            <span className="text-slate-300">Concluído</span>
          </div>
          <span className="font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-lg">
            {stats.concluido}
          </span>
        </div>
      </div>
    </div>
  );
};
