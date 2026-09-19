import React, { useState } from 'react';
import { Evento, Tarefa } from '../types';
import { HourlyTimeline } from '../components/Agenda/HourlyTimeline';
import { CalendarGrid } from '../components/Agenda/CalendarGrid';

interface AgendaPageProps {
  events: Evento[];
  demands: Tarefa[];
  onOpenAddEvent: () => void;
  onOpenAddDemand: () => void;
}

export const AgendaPage: React.FC<AgendaPageProps> = ({
  events,
  demands,
  onOpenAddEvent,
  onOpenAddDemand,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2026, 8, 1)); // Setembro 2026 como no protótipo
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 8, 19));

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-[640px]">
        {/* Linha do Tempo Horária à Esquerda (Protótipo 5.4) */}
        <div className="lg:col-span-7 h-[640px]">
          <HourlyTimeline
            selectedDate={selectedDate}
            events={events}
            demands={demands}
            onAddEvent={onOpenAddEvent}
            onAddDemand={onOpenAddDemand}
          />
        </div>

        {/* Grade do Calendário Mensal à Direita (Protótipo 5.4) */}
        <div className="lg:col-span-5 h-[640px]">
          <CalendarGrid
            currentMonth={currentMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            selectedDate={selectedDate}
            onSelectDate={(date) => setSelectedDate(date)}
            events={events}
            demands={demands}
            onAddEvent={onOpenAddEvent}
            onAddDemand={onOpenAddDemand}
          />
        </div>
      </div>
    </div>
  );
};
