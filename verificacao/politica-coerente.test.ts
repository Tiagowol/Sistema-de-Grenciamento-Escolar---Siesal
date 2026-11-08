import { describe, expect, it } from 'vitest';
import {
  PERFIS_CADASTRAVEIS,
  podeAdministrarTurmas,
  podeAdministrarUsuarios,
  podeUsarNucleo,
} from '../api/src/auth/politica.js';
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

describe('política do Núcleo x matriz de permissões', () => {
  it.each(PERFIS)('perfil %s: tarefas, plano e notas pessoais batem com a matriz', (perfil) => {
    const esperado = permitido(perfil, 'tarefas', 'administrar') === 'proprio';
    expect(podeUsarNucleo(perfil)).toBe(esperado);
    expect(permitido(perfil, 'plano_regressivo', 'administrar') === 'proprio').toBe(esperado);
    expect(permitido(perfil, 'notas_pessoais', 'administrar') === 'proprio').toBe(esperado);
  });
});

describe('política de turmas x matriz de permissões', () => {
  it.each(PERFIS)('perfil %s: turmas, disciplinas e vínculos batem com a matriz', (perfil) => {
    const esperado = permitido(perfil, 'turmas', 'administrar') === 'instituicao';
    expect(podeAdministrarTurmas(perfil)).toBe(esperado);
    expect(permitido(perfil, 'disciplinas', 'administrar') === 'instituicao').toBe(esperado);
    expect(permitido(perfil, 'vinculos', 'administrar') === 'instituicao').toBe(esperado);
  });
});
