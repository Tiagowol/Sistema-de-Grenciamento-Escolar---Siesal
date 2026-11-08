// Datas como AAAA-MM-DD, lidas no horário local (sem deslocar o dia por fuso)
export function paraData(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a as number, (m as number) - 1, d as number);
}
export function paraTexto(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function somarDias(dia: string, n: number): string {
  const d = paraData(dia);
  d.setDate(d.getDate() + n);
  return paraTexto(d);
}
export function formatar(
  dia: string,
  opcoes: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' },
): string {
  return paraData(dia).toLocaleDateString('pt-BR', opcoes);
}
export function dataLonga(dia: string): string {
  return formatar(dia, { weekday: 'long', day: 'numeric', month: 'long' });
}
// Texto literal, sem pressão: "hoje", "amanhã", "em 3 dias", "há 2 dias"
export function relativo(prazo: string, hoje: string): string {
  const n = Math.round((paraData(prazo).getTime() - paraData(hoje).getTime()) / 86_400_000);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n > 1) return `em ${n} dias`;
  return n === -1 ? 'ontem' : `há ${-n} dias`;
}
// Segunda a domingo da semana que contém o dia
export function semanaDe(dia: string): string[] {
  const d = paraData(dia);
  const inicio = somarDias(dia, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
// Dias inteiros entre hoje e o prazo (negativo se já passou)
export function diasAte(prazo: string, hoje: string): number {
  return Math.round((paraData(prazo).getTime() - paraData(hoje).getTime()) / 86_400_000);
}
export type ParteDoDia = 'manha' | 'tarde' | 'noite';
// Manhã até 11:59, tarde até 17:59, noite depois. Sem hora, não há parte do dia.
export function parteDoDia(hora: string | null): ParteDoDia | null {
  if (!hora) return null;
  const h = Number(hora.slice(0, 2));
  if (!Number.isFinite(h)) return null;
  return h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite';
}
