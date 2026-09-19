/**
 * Calcula a prioridade dinâmica de uma demanda de acordo com a data de entrega e o nível de dificuldade.
 * 
 * Regras:
 * - Prazo <= 1 dia ou vencido: "Urgente"
 * - Prazo <= 3 dias:
 *     - Difícil ou Médio: "Urgente"
 *     - Fácil: "Proximo"
 * - Prazo <= 7 dias:
 *     - Difícil: "Urgente"
 *     - Médio ou Fácil: "Proximo"
 * - Prazo <= 14 dias:
 *     - Difícil ou Médio: "Proximo"
 *     - Fácil: "Longe"
 * - Prazo > 14 dias:
 *     - Difícil: "Proximo"
 *     - Outros: "Longe"
 */
export function calculateDynamicPriority(
  dataEntrega: string | Date,
  dificuldade: string = 'Médio'
): 'Urgente' | 'Proximo' | 'Longe' {
  const deadline = new Date(dataEntrega);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const diffNormalized = (dificuldade || 'Médio').toLowerCase();

  // Vencido ou vence em menos de 24h
  if (diffHours <= 24) {
    return 'Urgente';
  }

  // Menos de 3 dias
  if (diffDays <= 3) {
    if (diffNormalized === 'difícil' || diffNormalized === 'dificil' || diffNormalized === 'médio' || diffNormalized === 'medio') {
      return 'Urgente';
    }
    return 'Proximo';
  }

  // Menos de 7 dias (Essa semana)
  if (diffDays <= 7) {
    if (diffNormalized === 'difícil' || diffNormalized === 'dificil') {
      return 'Urgente';
    }
    return 'Proximo';
  }

  // Menos de 14 dias (Próximas 2 semanas)
  if (diffDays <= 14) {
    if (diffNormalized === 'difícil' || diffNormalized === 'dificil' || diffNormalized === 'médio' || diffNormalized === 'medio') {
      return 'Proximo';
    }
    return 'Longe';
  }

  // Mais de 14 dias
  if (diffNormalized === 'difícil' || diffNormalized === 'dificil') {
    return 'Proximo';
  }

  return 'Longe';
}
