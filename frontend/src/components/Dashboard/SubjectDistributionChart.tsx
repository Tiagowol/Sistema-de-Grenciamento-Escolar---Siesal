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
    <div className="h-60 w-full flex items-end justify-between gap-3 pt-6 pb-2 px-4 bg-[#0a1533]/90 rounded-2xl border border-[#1b3472]/60 animate-fade-in">
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
              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
              onMouseEnter={() => setHoveredSubject(subject)}
              onMouseLeave={() => setHoveredSubject(null)}
            >
              <span className="text-xs font-bold text-white mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity transform -translate-y-1">
                {subject.total}
              </span>

              <div
                className="w-full max-w-[50px] rounded-t-xl transition-all duration-500 ease-out group-hover:brightness-125 group-hover:scale-y-105 origin-bottom shadow-lg"
                style={{
                  height: `${Math.max(heightPercent, 10)}%`,
                  backgroundColor: barColor,
                  boxShadow: `0 0 16px ${barColor}50`,
                }}
              />

              <span
                className="text-xs font-medium text-slate-300 mt-3 truncate max-w-[70px] text-center group-hover:text-cyan-300 transition-colors"
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
      <div className="h-60 w-full flex flex-col sm:flex-row items-center justify-around gap-6 p-4 bg-[#0a1533]/90 rounded-2xl border border-[#1b3472]/60 animate-fade-in">
        <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            {totalActivities === 0 ? (
              <circle cx="80" cy="80" r={radius} stroke="#1b3472" strokeWidth={isDonut ? "20" : "60"} fill="transparent" />
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
                    strokeWidth={isDonut ? "22" : "60"}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(${rotation} 80 80)`}
                    className="transition-all duration-700 ease-out hover:opacity-80 cursor-pointer"
                    onMouseEnter={() => setHoveredSubject(subj)}
                    onMouseLeave={() => setHoveredSubject(null)}
                  />
                );
              })
            )}
          </svg>

          {isDonut && (
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white glow-cyan">{totalActivities}</span>
              <span className="text-[10px] text-cyan-300 uppercase font-semibold">Total</span>
            </div>
          )}
        </div>

        {/* Legendas Dinâmicas */}
        <div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto max-h-48 pr-2 w-full">
          {data.map((subj) => (
            <div
              key={subj.id_marcador}
              className="p-2 rounded-xl bg-[#0e1c44]/70 border border-[#1c397c] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: getSubjectColor(subj.nome, subj.cor) }}
                />
                <span className="text-slate-200 truncate">{subj.nome}</span>
              </div>
              <span className="font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded text-[11px]">
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
    <div className="h-60 w-full p-4 bg-[#0a1533]/90 rounded-2xl border border-[#1b3472]/60 overflow-y-auto space-y-3 animate-fade-in">
      {data.map((subj) => {
        const percent = maxTotal > 0 ? (subj.total / maxTotal) * 100 : 0;
        const color = getSubjectColor(subj.nome, subj.cor);

        return (
          <div key={subj.id_marcador} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-slate-200">{subj.nome}</span>
              </div>
              <span className="text-cyan-400 font-bold">{subj.total} demandas</span>
            </div>

            <div className="w-full h-3 bg-[#0e1d44] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(percent, 4)}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${color}80`,
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
      <div className="h-60 w-full p-4 bg-[#0a1533]/90 rounded-2xl border border-[#1b3472]/60 flex flex-col justify-between animate-fade-in">
        <svg className="w-full h-44" viewBox="0 0 360 160">
          {/* Linhas de Grade de Fundo */}
          <line x1="20" y1="30" x2="340" y2="30" stroke="#172b5c" strokeDasharray="4 4" />
          <line x1="20" y1="80" x2="340" y2="80" stroke="#172b5c" strokeDasharray="4 4" />
          <line x1="20" y1="130" x2="340" y2="130" stroke="#172b5c" strokeDasharray="4 4" />

          {/* Linha de Conexão */}
          {points.length > 1 && (
            <path
              d={pathData}
              fill="none"
              stroke="#00b4d8"
              strokeWidth="3"
              className="drop-shadow-[0_0_8px_rgba(0,180,216,0.6)]"
            />
          )}

          {/* Pontos Interativos */}
          {points.map((p, i) => (
            <g key={i} className="cursor-pointer group">
              <circle
                cx={p.x}
                cy={p.y}
                r="6"
                fill={getSubjectColor(p.subj.nome, p.subj.cor)}
                stroke="#ffffff"
                strokeWidth="2"
                className="transition-transform group-hover:scale-150"
              />
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="bold"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {p.subj.total}
              </text>
            </g>
          ))}
        </svg>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-4">
          {data.map((subj) => (
            <span key={subj.id_marcador} className="truncate max-w-[60px] text-center">
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
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Distribuição de Demandas por Matéria
            </h2>
            <p className="text-xs text-slate-400">
              Total de <span className="text-cyan-400 font-bold">{totalActivities}</span> atividades cadastradas
            </p>
          </div>
        </div>

        {/* Botões de Seleção do Tipo de Gráfico */}
        <div className="flex items-center p-1 rounded-xl bg-[#0a1430] border border-[#1d3b7d]">
          <button
            onClick={() => setChartType('bar')}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              chartType === 'bar' ? 'bg-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
            title="Gráfico de Barras Vertical"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Barras</span>
          </button>

          <button
            onClick={() => setChartType('pie')}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              chartType === 'pie' ? 'bg-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
            title="Gráfico de Pizza"
          >
            <PieChart className="w-4 h-4" />
            <span className="hidden sm:inline">Pizza</span>
          </button>

          <button
            onClick={() => setChartType('donut')}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              chartType === 'donut' ? 'bg-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
            title="Gráfico Donut"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Donut</span>
          </button>

          <button
            onClick={() => setChartType('horizontal')}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              chartType === 'horizontal' ? 'bg-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
            title="Gráfico de Barras Horizontal"
          >
            <AlignLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Horizontal</span>
          </button>

          <button
            onClick={() => setChartType('line')}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              chartType === 'line' ? 'bg-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
            title="Gráfico de Linha"
          >
            <LineChart className="w-4 h-4" />
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
