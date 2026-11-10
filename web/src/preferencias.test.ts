import { describe, expect, it } from 'vitest';
import { carregarPreferencias, PREFERENCIAS_PADRAO } from './preferencias';

const armazem = (v: string | null) => ({ getItem: () => v });

describe('preferências de acessibilidade', () => {
  it('usa o padrão quando não há nada salvo ou o dado é inválido', () => {
    expect(carregarPreferencias(armazem(null))).toEqual(PREFERENCIAS_PADRAO);
    expect(carregarPreferencias(armazem('{quebrado'))).toEqual(PREFERENCIAS_PADRAO);
  });
  it('limita a fonte entre 90 e 150 e arredonda de 10 em 10', () => {
    expect(carregarPreferencias(armazem('{"fonte":500}')).fonte).toBe(150);
    expect(carregarPreferencias(armazem('{"fonte":10}')).fonte).toBe(90);
    expect(carregarPreferencias(armazem('{"fonte":113}')).fonte).toBe(110);
  });
  it('só aceita true de verdade nas chaves', () => {
    expect(carregarPreferencias(armazem('{"escuro":"sim"}')).escuro).toBe(false);
    expect(carregarPreferencias(armazem('{"linguagemCurta":"sim"}')).linguagemCurta).toBe(false);
  });
  it('L17: linguagem curta vem desligada e o cartão de escolha vem ligado; o aluno muda os dois', () => {
    expect(PREFERENCIAS_PADRAO.linguagemCurta).toBe(false);
    expect(PREFERENCIAS_PADRAO.escolhaAgora).toBe(true);
    const p = carregarPreferencias(armazem('{"linguagemCurta":true,"escolhaAgora":false}'));
    expect(p.linguagemCurta).toBe(true);
    expect(p.escolhaAgora).toBe(false);
  });
});
