// Datas como texto AAAA-MM-DD, sempre no fuso de Brasília (o aluno pensa em "hoje" no horário dele)
const FUSO = 'America/Sao_Paulo';

export function hojeBrasilia(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(inicio: string, fim: string): number {
  return Math.round(
    (Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86_400_000,
  );
}
