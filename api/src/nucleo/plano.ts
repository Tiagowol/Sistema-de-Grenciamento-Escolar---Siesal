import { diasEntre, somarDias } from './datas.js';

export type BlocoPlano = { dia: string; minutos: number };

type Entrada = { hoje: string; prazo: string; minutosTotal: number; minutosPorSessao: number };

// Plano regressivo: parte do prazo e volta no tempo. Os dias de estudo vão de hoje até a véspera do prazo.
// Há no máximo um bloco por dia; se faltam dias, o bloco do dia fica maior. O último bloco cai na véspera.
export function planoRegressivo({
  hoje,
  prazo,
  minutosTotal,
  minutosPorSessao,
}: Entrada): BlocoPlano[] {
  if (minutosTotal <= 0 || minutosPorSessao <= 0) return [];
  const ultimo = diasEntre(hoje, prazo) > 1 ? somarDias(prazo, -1) : hoje;
  const dias = diasEntre(hoje, ultimo) + 1;
  const sessoes = Math.ceil(minutosTotal / minutosPorSessao);
  const quantos = Math.min(sessoes, dias);
  // Distribui os minutos pelos blocos sem perder nenhum minuto (os primeiros recebem o resto)
  const base = Math.floor(minutosTotal / quantos);
  const resto = minutosTotal - base * quantos;
  const blocos: BlocoPlano[] = [];
  for (let i = 0; i < quantos; i++) {
    // Espaça os blocos de forma uniforme, ancorados no último dia e contando para trás
    const recuo = Math.floor(((quantos - 1 - i) * dias) / quantos);
    blocos.push({ dia: somarDias(ultimo, -recuo), minutos: base + (i < resto ? 1 : 0) });
  }
  return blocos;
}
