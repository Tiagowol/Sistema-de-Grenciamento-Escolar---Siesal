import { describe, expect, it } from 'vitest';
import { PERFIS, PERFIS_ESCOLARES } from './perfis.js';

describe('perfis', () => {
  it('tem exatamente 6 perfis, sem repetição', () => {
    expect(PERFIS).toHaveLength(6);
    expect(new Set(PERFIS).size).toBe(6);
  });

  it('o master não é um perfil escolar', () => {
    expect(PERFIS_ESCOLARES).not.toContain('master');
    expect(PERFIS_ESCOLARES).toHaveLength(5);
  });
});
