// Duração em blocos: o aluno escolhe o bloco; os minutos ficam só ao lado, pequenos.
export type Bloco = { id: 'curto' | 'medio' | 'longo'; nome: string; minutos: number };

export const BLOCOS: Bloco[] = [
  { id: 'curto', nome: 'Curto', minutos: 10 },
  { id: 'medio', nome: 'Médio', minutos: 25 },
  { id: 'longo', nome: 'Longo', minutos: 45 },
];

// Bloco mais próximo de uma duração já gravada (eventos antigos podem ter outros minutos)
export function blocoDe(minutos: number): Bloco {
  const [curto, medio, longo] = BLOCOS as [Bloco, Bloco, Bloco];
  return minutos <= 17 ? curto : minutos <= 35 ? medio : longo;
}
