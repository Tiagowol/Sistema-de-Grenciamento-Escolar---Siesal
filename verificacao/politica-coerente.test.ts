import { describe, expect, it } from 'vitest';
import {
  PERFIS_CADASTRAVEIS,
  podeAdministrarTurmas,
  podeAdministrarUsuarios,
  podeLancarNota,
  podeLerAvisoEscolar,
  podeLerCaixa,
  podeLerNotas,
  podePedirRevisao,
  podePublicarAviso,
  podeResponderPedido,
  podeUsarNucleo,
  podeVerHistoricoNotas,
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

describe('política de notas oficiais x matriz de permissões (v4)', () => {
  it.each(PERFIS)(
    'perfil %s: lançar, revisar, ler, pedir e responder batem com a matriz',
    (perfil) => {
      expect(podeLancarNota(perfil)).toBe(permitido(perfil, 'notas', 'lancar') !== null);
      expect(podeLancarNota(perfil)).toBe(permitido(perfil, 'notas', 'revisar') !== null);
      expect(podeLerNotas(perfil)).toBe(permitido(perfil, 'notas', 'ler') !== null);
      expect(podeVerHistoricoNotas(perfil)).toBe(
        permitido(perfil, 'notas', 'ler_historico') !== null,
      );
      expect(podePedirRevisao(perfil)).toBe(permitido(perfil, 'pedidos_revisao', 'pedir') !== null);
      expect(podeResponderPedido(perfil)).toBe(
        permitido(perfil, 'pedidos_revisao', 'responder') !== null,
      );
    },
  );
});

describe('política da caixa e dos avisos (L16) x matriz de permissões (v5)', () => {
  it.each(PERFIS)('perfil %s: caixa, publicar e ler aviso batem com a matriz', (perfil) => {
    expect(podeLerCaixa(perfil)).toBe(permitido(perfil, 'caixa', 'ler') !== null);
    expect(podePublicarAviso(perfil)).toBe(
      permitido(perfil, 'avisos_escolares', 'publicar') !== null,
    );
    expect(podeLerAvisoEscolar(perfil)).toBe(permitido(perfil, 'avisos_escolares', 'ler') !== null);
  });
});
