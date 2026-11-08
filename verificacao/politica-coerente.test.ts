import { describe, expect, it } from 'vitest';
import { PERFIS_CADASTRAVEIS, podeAdministrarUsuarios } from '../api/src/auth/politica.js';
import { PERFIS } from '../shared/src/perfis.js';
import { permitido } from '../shared/src/permissoes.js';

// A regra local da api não pode divergir da matriz de permissões
describe('política de cadastro x matriz de permissões', () => {
  it.each(PERFIS)('perfil %s: mesma resposta da matriz', (perfil) => {
    expect(podeAdministrarUsuarios(perfil)).toBe(
      permitido(perfil, 'usuarios', 'administrar') === 'instituicao',
    );
  });

  it('os perfis cadastráveis são exatamente os escolares', () => {
    expect([...PERFIS_CADASTRAVEIS].sort()).toEqual(PERFIS.filter((p) => p !== 'master').sort());
  });
});
