import { describe, expect, it } from 'vitest';
import { planoRegressivo } from './plano.js';

const soma = (b: { minutos: number }[]) => b.reduce((s, x) => s + x.minutos, 0);

describe('plano regressivo', () => {
  it('termina na véspera do prazo e não perde minutos', () => {
    const p = planoRegressivo({
      hoje: '2026-11-08',
      prazo: '2026-11-18',
      minutosTotal: 150,
      minutosPorSessao: 30,
    });
    expect(p).toHaveLength(5);
    expect(p.at(-1)?.dia).toBe('2026-11-17');
    expect(soma(p)).toBe(150);
  });
  it('dias distintos e em ordem crescente', () => {
    const p = planoRegressivo({
      hoje: '2026-11-08',
      prazo: '2026-11-30',
      minutosTotal: 240,
      minutosPorSessao: 30,
    });
    const dias = p.map((b) => b.dia);
    expect(new Set(dias).size).toBe(dias.length);
    expect([...dias].sort()).toEqual(dias);
    expect(dias[0] >= '2026-11-08').toBe(true);
  });
  it('com poucos dias, junta minutos em menos blocos', () => {
    const p = planoRegressivo({
      hoje: '2026-11-08',
      prazo: '2026-11-10',
      minutosTotal: 120,
      minutosPorSessao: 25,
    });
    expect(p.map((b) => b.dia)).toEqual(['2026-11-08', '2026-11-09']);
    expect(soma(p)).toBe(120);
  });
  it('prazo hoje ou amanhã usa só hoje', () => {
    expect(
      planoRegressivo({
        hoje: '2026-11-08',
        prazo: '2026-11-08',
        minutosTotal: 60,
        minutosPorSessao: 30,
      }),
    ).toEqual([{ dia: '2026-11-08', minutos: 60 }]);
    expect(
      planoRegressivo({
        hoje: '2026-11-08',
        prazo: '2026-11-09',
        minutosTotal: 60,
        minutosPorSessao: 30,
      }),
    ).toEqual([{ dia: '2026-11-08', minutos: 60 }]);
  });
  it('entrada inválida devolve vazio', () => {
    expect(
      planoRegressivo({
        hoje: '2026-11-08',
        prazo: '2026-11-10',
        minutosTotal: 0,
        minutosPorSessao: 30,
      }),
    ).toEqual([]);
  });
});
