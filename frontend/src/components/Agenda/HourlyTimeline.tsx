import React from 'react';
import { Evento, Tarefa } from '../../types';
import { Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { isoToLocalDateString, toLocalDateString } from '../../utils/date';

interface HourlyTimelineProps {
  selectedDate: Date;
  events: Evento[];
  demands: Tarefa[];
  onAddEvent: () => void;
  onAddDemand: () => void;
}

export const HourlyTimeline: React.FC<HourlyTimelineProps> = ({
  selectedDate,
  events,
  demands,
  onAddEvent,
  onAddDemand,
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Data local do dia selecionado (comparações sem deslocamento de fuso UTC)
  const dateStr = toLocalDateString(selectedDate);
  const dayEvents = events.filter((ev) => isoToLocalDateString(ev.data_inicio) === dateStr);
  const dayDemands = demands.filter((d) => isoToLocalDateString(d.data_entrega) === dateStr);

  // Corrigido: retorna TODOS os eventos daquela hora (antes só exibia o primeiro)
  const getEventsForHour = (hour: number) =>
    dayEvents.filter((ev) => new Date(ev.data_inicio).getHours() === hour);

  const getDemandsForHour = (hour: number) =>
    dayDemands.filter((d) => new Date(d.data_entrega).getHours() === hour);

  return (
    <div className="siesal-card rounded-3xl p-6 flex flex-col h-full" data-tutorial="linha-do-tempo">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1c3674]">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">
            Horários do Dia • {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
        </div>
      </div>

      {/* Linha do Tempo 00:00 - 23:00 (Fiel ao Protótipo 5.4) */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {hours.map((hour) => {
          const formattedHour = `${String(hour).padStart(2, '0')}:00`;
          const hourEvents = getEventsForHour(hour);
          const hourDemands = getDemandsForHour(hour);

          return (
            <div
              key={hour}
              className="flex items-center gap-4 py-2 border-b border-dashed border-[#1a336e]/60 group hover:bg-[#11234f]/40 px-2 rounded-xl transition-colors"
            >
              {/* Horário */}
              <span className="w-14 text-xs font-mono font-bold text-cyan-400 shrink-0">
                {formattedHour}
              </span>

              {/* Divisor pontilhado */}
              <div className="h-px flex-1 border-t border-[#1e3b7b]/80 relative flex items-center">
                {/* Eventos Escolares (todos do horário, empilhados) */}
                {hourEvents.map((event, i) => (
                  <div
                    key={event.id_evento}
                    className="absolute bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold px-4 py-1.5 rounded-xl shadow-lg flex items-center gap-2 z-10"
                    style={{ left: `${i * 12}px` }}
                  >
                    <span>{event.titulo}</span>
                    {event.local && (
                      <span className="text-[10px] opacity-90 flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {event.local}
                      </span>
                    )}
                  </div>
                ))}

                {/* Entregas de Demandas do horário */}
                {hourDemands.map((dem) => (
                  <div
                    key={dem.id_tarefa}
                    className="absolute right-0 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs font-bold px-3 py-1 rounded-xl shadow-lg flex items-center gap-1.5 z-10"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Entrega: {dem.titulo}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
