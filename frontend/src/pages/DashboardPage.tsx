import React from 'react';
import { DashboardStats } from '../types';
import { PieProgressWidget } from '../components/Dashboard/PieProgressWidget';
import { SubjectDistributionChart } from '../components/Dashboard/SubjectDistributionChart';
import { AlertsList } from '../components/Dashboard/AlertsList';

interface DashboardPageProps {
  stats: DashboardStats;
  onMarkAlertRead?: (id: number) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ stats, onMarkAlertRead }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Seção Superior do Início (Fiel ao Protótipo 5.1) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Widget 1: Todos os Prazos */}
        <div className="md:col-span-4">
          <PieProgressWidget
            title="todos os Prazos"
            stats={stats.todosOsPrazos}
          />
        </div>

        {/* Widget 2: Essa Semana */}
        <div className="md:col-span-4">
          <PieProgressWidget
            title="Essa Semana"
            stats={stats.essaSemana}
          />
        </div>

        {/* Widget 3: Avisos */}
        <div className="md:col-span-4">
          <AlertsList
            alerts={stats.avisos}
            onMarkRead={onMarkAlertRead}
          />
        </div>
      </div>

      {/* Seção Inferior: Gráfico de Barras de Demandas por Matéria (Fiel ao Protótipo 5.1) */}
      <div className="w-full">
        <SubjectDistributionChart data={stats.distribuicaoMaterias} />
      </div>
    </div>
  );
};
