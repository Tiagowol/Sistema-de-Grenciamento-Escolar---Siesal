import { describe, expect, it } from 'vitest';
import { previaPlano } from './plano';

// Mesmos casos de api/src/nucleo/plano.test.ts: a prévia mostra o que a API vai gravar
describe('prévia do plano (blocos agrupados)', () => {
  it('4 blocos médios em 1 dia viram 1 compromisso de 100 min (caso OBS-01)', () => {
    const p = previaPlano('2026-11-08', '2026-11-09', 4, 25);
    expect(p.diasDisponiveis).toBe(1);
    expect(p.agrupado).toBe(true);
    expect(p.minutosTotal).toBe(100);
    expect(p.compromissos).toEqual([{ dia: '2026-11-08', blocos: 4, minutos: 100 }]);
  });
  it('com dias de sobra, um bloco por dia, sem agrupar', () => {
    const p = previaPlano('2026-11-08', '2026-11-20', 4, 25);
    expect(p.agrupado).toBe(false);
    expect(p.compromissos.map((c) => c.blocos)).toEqual([1, 1, 1, 1]);
    expect(p.compromissos.at(-1)?.dia).toBe('2026-11-19');
  });
  it('agrupa só o que falta: 5 blocos em 3 dias', () => {
    const p = previaPlano('2026-11-08', '2026-11-11', 5, 10);
    expect(p.diasDisponiveis).toBe(3);
    expect(p.compromissos.map((c) => c.blocos)).toEqual([2, 2, 1]);
    expect(p.compromissos.reduce((a, c) => a + c.minutos, 0)).toBe(50);
  });
});
