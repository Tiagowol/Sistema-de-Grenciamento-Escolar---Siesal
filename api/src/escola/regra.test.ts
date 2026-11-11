import { describe, expect, it } from 'vitest';
import {
  arredondar,
  calcularMedias,
  corDaEscolaLegivel,
  periodosValidos,
  type Regra,
  tipoDoLogotipo,
} from './regra.js';

// Regras de notas e identidade (L19): cálculo, validação e logotipo, sem banco
const REGRA: Regra = {
  numero: 1,
  arredondamento: 'decimo',
  periodos: [
    { nome: '1º semestre', inicio: '2026-02-01', fim: '2026-06-30', peso: 1 },
    { nome: '2º semestre', inicio: '2026-08-01', fim: '2026-12-15', peso: 2 },
  ],
};
const nota = (dia: string, valor: number, aluno = 'a1', disc = 'd1') => ({
  aluno_id: aluno,
  disciplina_id: disc,
  disciplina_nome: 'Matemática',
  dia,
  valor,
});

describe('arredondar', () => {
  it('nenhum guarda 2 casas; décimo e meio ponto arredondam para cima no empate', () => {
    expect(arredondar(7.456, 'nenhum')).toBe(7.46);
    expect(arredondar(8.25, 'decimo')).toBe(8.3);
    expect(arredondar(7.75, 'meio')).toBe(8);
    expect(arredondar(7.2, 'meio')).toBe(7);
    expect(arredondar(7.25, 'meio')).toBe(7.5);
  });
});

describe('periodosValidos', () => {
  it('aceita períodos em ordem e recusa sobreposição ou fim antes do início', () => {
    expect(periodosValidos(REGRA.periodos)).toBe(true);
    expect(
      periodosValidos([
        { nome: 'a', inicio: '2026-02-01', fim: '2026-06-30', peso: 1 },
        { nome: 'b', inicio: '2026-06-30', fim: '2026-12-01', peso: 1 },
      ]),
    ).toBe(false);
    expect(periodosValidos([{ nome: 'a', inicio: '2026-03-01', fim: '2026-02-01', peso: 1 }])).toBe(
      false,
    );
  });
});

describe('calcularMedias', () => {
  it('média de cada período e final ponderada, só por aluno e disciplina', () => {
    const [m, ...resto] = calcularMedias(REGRA, [
      nota('2026-03-10', 6),
      nota('2026-04-10', 7),
      nota('2026-09-10', 9),
    ]);
    expect(resto).toHaveLength(0);
    expect(m?.periodos.map((p) => p.media)).toEqual([6.5, 9]);
    // (6,5 x 1 + 9 x 2) / 3 = 8,1666 → 8,2
    expect(m?.final).toBe(8.2);
  });

  it('período sem nota fica vazio e não entra no peso; nota fora dos períodos não conta', () => {
    const [m] = calcularMedias(REGRA, [nota('2026-03-10', 5), nota('2026-07-15', 10)]);
    expect(m?.periodos.map((p) => p.media)).toEqual([5, null]);
    expect(m?.final).toBe(5);
  });

  it('separa alunos e disciplinas sem misturar', () => {
    const r = calcularMedias(REGRA, [
      nota('2026-03-10', 4, 'a1'),
      nota('2026-03-10', 10, 'a2'),
      nota('2026-03-10', 8, 'a1', 'd2'),
    ]);
    expect(r).toHaveLength(3);
    expect(r.find((x) => x.aluno_id === 'a1' && x.disciplina_id === 'd1')?.final).toBe(4);
  });
});

describe('cor da escola', () => {
  it('cor escura passa no tema claro e falha no escuro; cor clara o contrário', () => {
    expect(corDaEscolaLegivel('#155bb4', 'claro')).toBe(true);
    expect(corDaEscolaLegivel('#155bb4', 'escuro')).toBe(false);
    expect(corDaEscolaLegivel('#8cbcff', 'escuro')).toBe(true);
    expect(corDaEscolaLegivel('#8cbcff', 'claro')).toBe(false);
    expect(corDaEscolaLegivel('#ffff00', 'claro')).toBe(false);
  });
});

describe('logotipo', () => {
  it('reconhece PNG e JPEG pelos bytes e recusa o resto (SVG, texto)', () => {
    expect(
      tipoDoLogotipo(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    ).toBe('image/png');
    expect(tipoDoLogotipo(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(tipoDoLogotipo(new TextEncoder().encode('<svg onload="x()"></svg>'))).toBeNull();
    expect(tipoDoLogotipo(new Uint8Array())).toBeNull();
  });
});
