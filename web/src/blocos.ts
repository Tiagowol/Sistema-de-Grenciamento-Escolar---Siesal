// Duração em blocos: o aluno escolhe o bloco; os minutos ficam só ao lado, pequenos.
export type Bloco = { id: 'curto' | 'medio' | 'longo'; nome: string; minutos: number };

// L20a: os minutos são do aluno (Personalizar, de 5 em 5). Padrão 10, 25 e 45.
export const MINUTOS_PADRAO_DOS_BLOCOS = { curto: 10, medio: 25, longo: 45 } as const;
export type MinutosDosBlocos = { curto: number; medio: number; longo: number };
export const MINUTOS_MINIMO = 5;
export const MINUTOS_MAXIMO = 120;
export const PASSO_DOS_MINUTOS = 5;

// A lista é a mesma de sempre; só os minutos mudam (as telas leem BLOCOS a cada desenho)
export const BLOCOS: Bloco[] = [
  { id: 'curto', nome: 'Curto', minutos: MINUTOS_PADRAO_DOS_BLOCOS.curto },
  { id: 'medio', nome: 'Médio', minutos: MINUTOS_PADRAO_DOS_BLOCOS.medio },
  { id: 'longo', nome: 'Longo', minutos: MINUTOS_PADRAO_DOS_BLOCOS.longo },
];

// Valores fora da regra (de 5 a 120, de 5 em 5, curto < médio < longo) voltam ao padrão
export function minutosValidos(m: MinutosDosBlocos): boolean {
  return (
    [m.curto, m.medio, m.longo].every(
      (v) =>
        Number.isInteger(v) &&
        v >= MINUTOS_MINIMO &&
        v <= MINUTOS_MAXIMO &&
        v % PASSO_DOS_MINUTOS === 0,
    ) &&
    m.curto < m.medio &&
    m.medio < m.longo
  );
}
export function definirMinutosDosBlocos(m: MinutosDosBlocos): void {
  const ok = minutosValidos(m) ? m : MINUTOS_PADRAO_DOS_BLOCOS;
  for (const b of BLOCOS) b.minutos = ok[b.id];
}

// Bloco mais próximo de uma duração já gravada (eventos antigos podem ter outros minutos)
export function blocoDe(minutos: number): Bloco {
  const [curto, medio, longo] = BLOCOS as [Bloco, Bloco, Bloco];
  return minutos <= (curto.minutos + medio.minutos) / 2
    ? curto
    : minutos <= (medio.minutos + longo.minutos) / 2
      ? medio
      : longo;
}
