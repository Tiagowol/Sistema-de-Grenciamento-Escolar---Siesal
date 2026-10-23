import React, { useState } from 'react';
import { SubjectDistribution } from '../../types';
import { BarChart3, PieChart, LineChart, AlignLeft, Sparkles, Layers } from 'lucide-react';

interface SubjectDistributionChartProps {
  data: SubjectDistribution[];
}

type ChartType = 'bar' | 'pie' | 'donut' | 'horizontal' | 'line';

export const SubjectDistributionChart: React.FC<SubjectDistributionChartProps> = ({ data }) => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [hoveredSubject, setHoveredSubject] = useState<SubjectDistribution | null>(null);

  const totalActivities = data.reduce((acc, curr) => acc + curr.total, 0);
  const maxTotal = Math.max(...data.map((d) => d.total), 6);

  const getSubjectColor = (nome: string, cor: string) => {
    if (cor) return cor;
    switch (nome.toLowerCase()) {
      case 'português':
        return '#f97316';
      case 'matemática':
        return '#3b82f6';
      case 'ciências':
        return '#22c55e';
      case 'geografia':
        return '#06b6d4';
      default:
        return '#a855f7';
    }
  };

  // Renderizador: Gráfico de Barras Verticais
  const renderVerticalBars = () => (
    <div className="h-64 w-full flex items-end justify-between gap-4 pt-8 pb-3 px-6 bg-slate-950/40 rounded-2xl border border-white/5 animate-fade-in">
      {data.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
          Nenhuma matéria cadastrada ainda.
        </div>
      ) : (
        data.map((subject) => {
          const heightPercent = maxTotal > 0 ? (subject.total / maxTotal) * 100 : 0;
          const barColor = getSubjectColor(subject.nome, subject.cor);

          return (
            <div
              key={subject.id_marcador}
              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
              onMouseEnter={() => setHoveredSubject(subject)}
              onMouseLeave={() => setHoveredSubject(null)}
            >
              <div className="absolute -top-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform -translate-y-1 bg-slate-800 text-cyan-300 text-[11px] font-bold px-2 py-0.5 rounded-md shadow-md border border-white/10 pointer-events-none">
                {subject.total} {subject.total === 1 ? 'demanda' : 'demandas'}
              </div>

              <div className="w-full max-w-[42px] h-full flex items-end">
                <div
                  className="w-full rounded-t-xl transition-all duration-500 ease-out group-hover:brightness-110 group-hover:scale-y-[1.02] origin-bottom relative overflow-hidden"
                  style={{
                    height: `${Math.max(heightPercent, 8)}%`,
                    backgroundColor: barColor,
                    boxShadow: `0 4px 16px ${barColor}40`,
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/20" />
                </div>
              </div>

              <span
                className="text-xs font-semibold text-slate-300 mt-3 truncate max-w-[80px] text-center group-hover:text-cyan-300 transition-colors"
                title={subject.nome}
              >
                {subject.nome}
              </span>
            </div>
          );
        })
      )}
    </div>
  );

  // Renderizador: Gráfico de Pizza / Setores
  const renderPieChart = (isDonut: boolean = false) => {
    let cumulativePercent = 0;
    const radius = 60;
    const circumference = 2 * Math.PI * radius;

    return (
      <div className="h-64 w-full flex flex-col sm:flex-row items-center justify-around gap-6 p-6 bg-slate-950/40 rounded-2xl border border-white/5 animate-fade-in">
        <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)]" viewBox="0 0 160 160">
            {totalActivities === 0 ? (
              <circle cx="80" cy="80" r={radius} stroke="#1b3472" strokeWidth={isDonut ? "18" : "55"} fill="transparent" />
            ) : (
              data.map((subj) => {
                const percent = (subj.total / totalActivities) * 100;
                if (percent === 0) return null;
                const strokeDashoffset = circumference - (circumference * percent) / 100;
                const rotation = (cumulativePercent / 100) * 360;
                cumulativePercent += percent;
                const color = getSubjectColor(subj.nome, subj.cor);

                return (
                  <circle
                    key={subj.id_marcador}
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke={color}
                    strokeWidth={isDonut ? "20" : "55"}
                    strokeLinecap="round"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(${rotation} 80 80)`}
                    className="transition-all duration-700 ease-out hover:opacity-80 hover:stroke-[22px] cursor-pointer"
                    onMouseEnter={() => setHoveredSubject(subj)}
                    onMouseLeave={() => setHoveredSubject(null)}
                  />
                );
              })
            )}
          </svg>

          {isDonut && (
            <div className="absolute flex flex-col items-center justify-center select-none pointer-events-none">
              <span className="text-2xl font-black text-white glow-cyan">{totalActivities}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Total</span>
            </div>
          )}
        </div>

        {/* Legendas Dinâmicas */}
        <div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto max-h-52 pr-2 w-full">
          {data.map((subj) => (
            <div
              key={subj.id_marcador}
              className="p-2.5 rounded-xl bg-slate-900/40 border border-white/5 hover:border-cyan-500/30 flex items-center justify-between text-xs transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: getSubjectColor(subj.nome, subj.cor) }}
                />
                <span className="text-slate-200 font-medium truncate">{subj.nome}</span>
              </div>
              <span className="font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded text-[11px]">
                {subj.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Renderizador: Gráfico de Barras Horizontais
  const renderHorizontalBars = () => (
    <div className="h-64 w-full p-6 bg-slate-950/40 rounded-2xl border border-white/5 overflow-y-auto space-y-3.5 animate-fade-in">
      {data.map((subj) => {
        const percent = maxTotal > 0 ? (subj.total / maxTotal) * 100 : 0;
        const color = getSubjectColor(subj.nome, subj.cor);

        return (
          <div key={subj.id_marcador} className="space-y-1.5 group">
            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                <span className="text-slate-200 group-hover:text-cyan-300 transition-colors">{subj.nome}</span>
              </div>
              <span className="text-cyan-400 font-bold">{subj.total} {subj.total === 1 ? 'demanda' : 'demandas'}</span>
            </div>

            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110"
                style={{
                  width: `${Math.max(percent, 4)}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 12px ${color}60`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  // Renderizador: Gráfico de Linhas / Tendência
  const renderLineChart = () => {
    const points = data.map((subj, index) => {
      const x = data.length > 1 ? (index / (data.length - 1)) * 300 + 30 : 180;
      const y = 140 - (maxTotal > 0 ? (subj.total / maxTotal) * 100 : 0);
      return { x, y, subj };
    });

    const pathData = points.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
      ''
    );

    return (
      <div className="h-64 w-full p-6 bg-slate-950/40 rounded-2xl border border-white/5 flex flex-col justify-between animate-fade-in">
        <svg className="w-full h-44" viewBox="0 0 360 160">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00b4d8" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade de Fundo Sutis */}
          <line x1="20" y1="30" x2="340" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <line x1="20" y1="80" x2="340" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <line x1="20" y1="130" x2="340" y2="130" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

          {/* Linha de Conexão */}
          {points.length > 1 && (
            <path
              d={pathData}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_4px_10px_rgba(0,180,216,0.5)]"
            />
          )}

          {/* Pontos Interativos */}
          {points.map((p, i) => (
            <g key={i} className="cursor-pointer group">
              <circle
                cx={p.x}
                cy={p.y}
                r="5"
                fill={getSubjectColor(p.subj.nome, p.subj.cor)}
                stroke="#ffffff"
                strokeWidth="2.5"
                className="transition-transform group-hover:scale-150 duration-200"
              />
              <text
                x={p.x}
                y={p.y - 12}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="bold"
                className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900"
              >
                {p.subj.total}
              </text>
            </g>
          ))}
        </svg>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-4">
          {data.map((subj) => (
            <span key={subj.id_marcador} className="truncate max-w-[60px] text-center font-medium">
              {subj.nome}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="siesal-card rounded-3xl p-6 flex flex-col">
      {/* Cabeçalho com Seletores de Tipo de Gráfico */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Distribuição de Demandas por Matéria
            </h2>
            <p className="text-xs text-slate-400">
              Total de <span className="text-cyan-400 font-semibold">{totalActivities}</span> atividades catalogadas
            </p>
          </div>
        </div>

        {/* Botões Minimalistas de Seleção do Gráfico */}
        <div className="flex items-center p-1 rounded-2xl bg-slate-950/60 border border-white/5">
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
              chartType === 'bar' ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25' : 'text-slate-400 hover:text-white'
            }`}
            title="Gráfico de Barras Vertical"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Barras</span>
          </button>

          <button
            onClick={() => setChartType('pie')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
              chartType === 'pie' ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25' : 'text-slate-400 hover:text-white'
            }`}
            title="Gráfico de Pizza"
          >
            <PieChart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pizza</span>
          </button>

          <button
            onClick={() => setChartType('donut')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
              chartType === 'donut' ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25' : 'text-slate-400 hover:text-white'
            }`}
            title="Gráfico Donut"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Donut</span>
          </button>

          <button
            onClick={() => setChartType('horizontal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
              chartType === 'horizontal' ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25' : 'text-slate-400 hover:text-white'
            }`}
            title="Gráfico de Barras Horizontal"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Horizontal</span>
          </button>

          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
              chartType === 'line' ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25' : 'text-slate-400 hover:text-white'
            }`}
            title="Gráfico de Linha"
          >
            <LineChart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Linha</span>
          </button>
        </div>
      </div>

      {/* Exibição do Gráfico Escolhido */}
      {chartType === 'bar' && renderVerticalBars()}
      {chartType === 'pie' && renderPieChart(false)}
      {chartType === 'donut' && renderPieChart(true)}
      {chartType === 'horizontal' && renderHorizontalBars()}
      {chartType === 'line' && renderLineChart()}
    </div>
  );
};
