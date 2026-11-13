import { describe, expect, it } from 'vitest';
import {
  PERFIS_CADASTRAVEIS,
  podeAcompanharAlunos,
  podeAcompanharPorInstituicao,
  podeAdministrarAcompanhamento,
  podeAdministrarConta,
  podeAdministrarDificuldade,
  podeAdministrarEscola,
  podeAdministrarInterface,
  podeAdministrarPreferencias,
  podeAdministrarTurmas,
  podeAdministrarUsuarios,
  podeAtenderAjuda,
  podeAtenderSuporte,
  podeDecidirContaDeMenor,
  podeGerirCodigoAcompanhamento,
  podeGerirVinculosInstituicao,
  podeLancarNota,
  podeLerAjuda,
  podeLerAvisoEscolar,
  podeLerCaixa,
  podeLerDificuldade,
  podeLerEscola,
  podeLerNotas,
  podeOcultarItemEscolar,
  podePedirAjuda,
  podePedirRevisao,
  podePedirSuporte,
  podePublicarAviso,
  podeResponderPedido,
  podeUsarCalendario,
  podeUsarCartoes,
  podeUsarNucleo,
  podeUsarTiposAtividade,
  podeVerComoRepresentante,
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

describe('política do pedido de ajuda (L17) x matriz de permissões (v6)', () => {
  it.each(PERFIS)('perfil %s: pedir, atender e ler batem com a matriz', (perfil) => {
    expect(podePedirAjuda(perfil)).toBe(permitido(perfil, 'pedidos_ajuda', 'pedir') !== null);
    expect(podeAtenderAjuda(perfil)).toBe(permitido(perfil, 'pedidos_ajuda', 'atender') !== null);
    expect(podeLerAjuda(perfil)).toBe(permitido(perfil, 'pedidos_ajuda', 'ler') !== null);
  });
});

describe('política do calendário (L17a) x matriz de permissões (v7)', () => {
  it.each(PERFIS)('perfil %s: usar o calendário bate com a matriz', (perfil) => {
    expect(podeUsarCalendario(perfil)).toBe(
      permitido(perfil, 'calendario', 'administrar') !== null,
    );
  });
});

describe('política dos tipos de atividade (L17b) x matriz de permissões (v8)', () => {
  it.each(PERFIS)('perfil %s: administrar tipos bate com a matriz', (perfil) => {
    expect(podeUsarTiposAtividade(perfil)).toBe(
      permitido(perfil, 'tipos_atividade', 'administrar') !== null,
    );
  });
});

describe('política da conta e do suporte (L17c) x matriz de permissões (v9)', () => {
  it.each(PERFIS)('perfil %s: conta, decisão pelo menor e suporte batem com a matriz', (perfil) => {
    expect(podeAdministrarConta(perfil)).toBe(permitido(perfil, 'conta', 'administrar') !== null);
    expect(podeDecidirContaDeMenor(perfil)).toBe(
      permitido(perfil, 'conta_menor', 'decidir') !== null,
    );
    expect(podePedirSuporte(perfil)).toBe(permitido(perfil, 'pedidos_suporte', 'pedir') !== null);
    expect(podeAtenderSuporte(perfil)).toBe(
      permitido(perfil, 'pedidos_suporte', 'atender') !== null,
    );
  });
});

describe('política das preferências de interface (L17d) x matriz de permissões (v10)', () => {
  it.each(PERFIS)('perfil %s: rótulos e VLibras batem com a matriz', (perfil) => {
    expect(podeAdministrarInterface(perfil)).toBe(
      permitido(perfil, 'preferencias_interface', 'administrar') === 'proprio',
    );
  });
});

describe('política das preferências de acessibilidade (L20a) x matriz de permissões (v13)', () => {
  it.each(PERFIS)('perfil %s: preferências na conta batem com a matriz', (perfil) => {
    expect(podeAdministrarPreferencias(perfil)).toBe(
      permitido(perfil, 'preferencias_acessibilidade', 'administrar') === 'proprio',
    );
  });
});

describe('política das disciplinas do aluno (L20b) x matriz de permissões (v14)', () => {
  it.each(PERFIS)('perfil %s: disciplinas e catálogo batem com a matriz', (perfil) => {
    expect(podeUsarNucleo(perfil)).toBe(
      permitido(perfil, 'disciplinas_aluno', 'administrar') === 'proprio',
    );
    expect(podeUsarNucleo(perfil)).toBe(permitido(perfil, 'catalogo_disciplinas', 'ler') !== null);
  });
});

describe('política do Admin institucional (L19) x matriz de permissões (v11)', () => {
  it.each(PERFIS)(
    'perfil %s: calendário da escola, regras e identidade batem com a matriz',
    (perfil) => {
      for (const recurso of ['calendario_escolar', 'regras_nota', 'identidade_instituicao']) {
        expect(podeAdministrarEscola(perfil), recurso).toBe(
          permitido(perfil, recurso, 'administrar') === 'instituicao',
        );
        expect(podeLerEscola(perfil), recurso).toBe(permitido(perfil, recurso, 'ler') !== null);
      }
      expect(podeOcultarItemEscolar(perfil)).toBe(
        permitido(perfil, 'calendario_escolar', 'ocultar') === 'proprio',
      );
    },
  );
});

describe('política da dificuldade e dos cards (20d) x matriz de permissões (v18)', () => {
  it.each(PERFIS)('perfil %s: dificuldade e cards batem com a matriz', (perfil) => {
    expect(podeAdministrarDificuldade(perfil)).toBe(
      permitido(perfil, 'dificuldade', 'administrar') !== null,
    );
    expect(podeLerDificuldade(perfil)).toBe(permitido(perfil, 'dificuldade', 'ler') !== null);
    expect(podeUsarCartoes(perfil)).toBe(
      permitido(perfil, 'cartoes_resumo', 'administrar') !== null,
    );
    expect(podeUsarCartoes(perfil)).toBe(permitido(perfil, 'cartoes_resumo', 'ler') !== null);
    expect(podeAcompanharAlunos(perfil)).toBe(
      permitido(perfil, 'dificuldade', 'ler') === 'instituicao',
    );
  });
  it('só o aluno e o Pedagógico leem a dificuldade; só o aluno administra', () => {
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'dificuldade', 'ler')).toBe(
        perfil === 'aluno' ? 'proprio' : perfil === 'pedagogico' ? 'instituicao' : null,
      );
    }
  });
});

describe('política do acompanhamento (L22a-2) x matriz de permissões (v19)', () => {
  it.each(PERFIS)('perfil %s: acompanhamento bate com a matriz', (perfil) => {
    expect(podeAdministrarAcompanhamento(perfil)).toBe(
      permitido(perfil, 'acompanhamento', 'administrar') !== null,
    );
    expect(podeAdministrarAcompanhamento(perfil)).toBe(
      permitido(perfil, 'acompanhamento', 'ler') !== null,
    );
  });
  it('só o aluno (próprio) e o representante (vínculo) entram; professor, pedagógico e admin não', () => {
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'acompanhamento', 'administrar')).toBe(
        perfil === 'aluno' ? 'proprio' : perfil === 'responsavel' ? 'vinculo' : null,
      );
    }
  });
});

describe('política do acompanhamento por código da instituição (L22a-2b) x matriz de permissões (v20)', () => {
  it.each(PERFIS)('perfil %s: código, vínculos e leitura batem com a matriz', (perfil) => {
    expect(podeGerirCodigoAcompanhamento(perfil)).toBe(
      permitido(perfil, 'acompanhamento_codigo', 'administrar') !== null,
    );
    expect(podeGerirVinculosInstituicao(perfil)).toBe(
      permitido(perfil, 'acompanhamento_instituicao', 'administrar') !== null,
    );
    expect(podeGerirVinculosInstituicao(perfil)).toBe(
      permitido(perfil, 'acompanhamento_instituicao', 'ler') !== null,
    );
    expect(podeAcompanharPorInstituicao(perfil)).toBe(
      permitido(perfil, 'acompanhamento_externo', 'administrar') !== null,
    );
    expect(podeAcompanharPorInstituicao(perfil)).toBe(
      permitido(perfil, 'acompanhamento_externo', 'ler') !== null,
    );
  });
  it('só o Admin gera o código; só o Pedagógico lê, no escopo do vínculo; o professor não entra', () => {
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'acompanhamento_codigo', 'administrar')).toBe(
        perfil === 'admin' ? 'instituicao' : null,
      );
      expect(permitido(perfil, 'acompanhamento_externo', 'ler')).toBe(
        perfil === 'pedagogico' ? 'vinculo' : null,
      );
    }
    expect(permitido('professor', 'acompanhamento_instituicao', 'ler')).toBeNull();
  });
});

describe('política "Meu aluno" (L22a-3) x matriz de permissões (v21)', () => {
  it('só o representante (responsável) lê, no escopo do vínculo; nenhum perfil escreve', () => {
    for (const perfil of PERFIS) {
      expect(podeVerComoRepresentante(perfil), perfil).toBe(
        permitido(perfil, 'representado', 'ler') !== null,
      );
      expect(permitido(perfil, 'representado', 'ler'), perfil).toBe(
        perfil === 'responsavel' ? 'vinculo' : null,
      );
      for (const acao of ['administrar', 'escrever', 'criar', 'alterar', 'apagar'])
        expect(permitido(perfil, 'representado', acao), `${perfil}/${acao}`).toBeNull();
    }
  });
});
