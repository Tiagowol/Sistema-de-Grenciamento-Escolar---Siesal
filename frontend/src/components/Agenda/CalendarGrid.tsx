import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Evento, Tarefa } from '../../types';

interface CalendarGridProps {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  events: Evento[];
  demands: Tarefa[];
  onAddEvent: () => void;
  onAddDemand: () => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentMonth,
  onPrevMonth,
  onNextMonth,
  selectedDate,
  onSelectDate,
  events,
  demands,
  onAddEvent,
  onAddDemand,
}) => {
  const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long' });
  const year = currentMonth.getFullYear();

  const daysInMonth = new Date(year, currentMonth.getMonth() + 1, 0).getDate();
  const firstDayIndex = new Date(year, currentMonth.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);

  // Dias da semana fiéis ao protótipo: D S T Q QI SX SB (ou D S T Q Q S S)
  const weekDays = ['D', 'S', 'T', 'Q', 'QI', 'SX', 'SB'];

  const hasItemOnDay = (day: number) => {
    const formattedDate = `${year}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasEvent = events.some((e) => e.data_inicio.startsWith(formattedDate));
    const hasDemand = demands.some((d) => d.data_entrega.startsWith(formattedDate));
    return { hasEvent, hasDemand };
  };

  return (
    <div className="siesal-card rounded-3xl p-6 flex flex-col justify-between h-full">
      <div>
        {/* Cabeçalho do Mês e Navegação (Fiel ao Protótipo 5.4) */}
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-[#1b3472]">
          <h2 className="text-xl font-black text-white capitalize tracking-wide">
            {monthName} - {year}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrevMonth}
              className="p-2 rounded-xl bg-[#102049] text-cyan-300 hover:bg-cyan-500 hover:text-white transition-all border border-[#1d3c80]"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onNextMonth}
              className="p-2 rounded-xl bg-[#102049] text-cyan-300 hover:bg-cyan-500 hover:text-white transition-all border border-[#1d3c80]"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-xs text-cyan-400 mb-3">
          {weekDays.map((wd, i) => (
            <div key={i} className="py-1">
              {wd}
            </div>
          ))}
        </div>

        {/* Grade de Dias do Mês */}
        <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold">
          {blanks.map((b) => (
            <div key={`blank-${b}`} className="p-2.5 opacity-0"></div>
          ))}

          {days.map((day) => {
            const isSelected =
              selectedDate.getDate() === day &&
              selectedDate.getMonth() === currentMonth.getMonth() &&
              selectedDate.getFullYear() === year;

            const isToday =
              new Date().getDate() === day &&
              new Date().getMonth() === currentMonth.getMonth() &&
              new Date().getFullYear() === year;

            const { hasEvent, hasDemand } = hasItemOnDay(day);

            return (
              <button
                key={day}
                onClick={() => onSelectDate(new Date(year, currentMonth.getMonth(), day))}
                className={`p-2.5 rounded-2xl relative transition-all duration-200 flex flex-col items-center justify-center font-bold ${
                  isSelected
                    ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/40 scale-105'
                    : isToday
                    ? 'bg-[#152e68] text-cyan-300 border border-cyan-400'
                    : 'text-slate-300 hover:bg-[#122452] hover:text-white'
                }`}
              >
                <span>{day}</span>

                {/* Marcadores de compromissos no dia */}
                <div className="flex items-center gap-1 mt-0.5">
                  {hasEvent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm"></span>
                  )}
                  {hasDemand && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-sm"></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Botões de Ação Rápidos (Fiéis ao Protótipo 5.4) */}
      <div className="pt-6 border-t border-[#1b3472] grid grid-cols-2 gap-3">
        <button
          onClick={onAddEvent}
          className="px-4 py-3 rounded-xl bg-[#112454] hover:bg-[#1a3880] text-cyan-300 border border-[#21438e] text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Evento</span>
        </button>

        <button
          onClick={onAddDemand}
          className="px-4 py-3 rounded-xl siesal-button-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Demanda</span>
        </button>
      </div>
    </div>
  );
};
