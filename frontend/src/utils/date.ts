/**
 * Utilitários de data locais.
 *
 * Todos os componentes do frontend devem formatar datas usando o fuso horário
 * LOCAL do navegador em vez de `toISOString()` (que converte para UTC e pode
 * deslocar eventos do fim do dia para o dia anterior/posterior).
 */

/** Converte uma data para a string local "YYYY-MM-DD". */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Extrai a parte "YYYY-MM-DD" de uma string ISO respeitando o fuso local. */
export function isoToLocalDateString(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return toLocalDateString(d);
}

/** Converte uma data para o formato local de input datetime-local ("YYYY-MM-DDTHH:mm"). */
export function toLocalDateTimeInput(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${toLocalDateString(date)}T${hh}:${mm}`;
}
