import { diasAte, somarDias } from './datas';

// Prévia do plano antes de salvar. Segue a mesma regra de api/src/nucleo/plano.ts:
// no máximo um compromisso por dia; se faltam dias, os blocos do dia ficam juntos num compromisso maior.
export type CompromissoPrevia = { dia: string; blocos: number; minutos: number };
export type Previa = {
  blocos: number;
  minutosTotal: number;
  diasDisponiveis: number;
  agrupado: boolean;
  compromissos: CompromissoPrevia[];
};

export function previaPlano(
  hoje: string,
  prazo: string,
  blocos: number,
  minutosPorBloco: number,
): Previa {
  const ultimo = diasAte(prazo, hoje) > 1 ? somarDias(prazo, -1) : hoje;
  const dias = diasAte(ultimo, hoje) + 1;
  const quantos = Math.max(1, Math.min(blocos, dias));
  const base = Math.floor(blocos / quantos);
  const resto = blocos - base * quantos;
  const compromissos: CompromissoPrevia[] = [];
  for (let i = 0; i < quantos; i++) {
    const recuo = Math.floor(((quantos - 1 - i) * dias) / quantos);
    const n = base + (i < resto ? 1 : 0);
    compromissos.push({ dia: somarDias(ultimo, -recuo), blocos: n, minutos: n * minutosPorBloco });
  }
  return {
    blocos,
    minutosTotal: blocos * minutosPorBloco,
    diasDisponiveis: dias,
    agrupado: blocos > dias,
    compromissos,
  };
}
