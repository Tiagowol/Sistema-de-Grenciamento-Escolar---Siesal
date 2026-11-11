import { describe, expect, it } from 'vitest';
import { PERFIS, type Perfil } from './perfis.js';
import { ESCOPOS, MATRIZ, permitido, todasAsCombinacoes, validarMatriz } from './permissoes.js';

const combinacoes = todasAsCombinacoes();

describe('matriz de permissões (dado)', () => {
  it('foi carregada, validada e tem versão', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(1);
    expect(Object.keys(MATRIZ.recursos).length).toBeGreaterThan(0);
  });

  it('nega por padrão: recurso, ação ou perfil desconhecido', () => {
    expect(permitido('aluno', 'recurso_que_nao_existe', 'ler')).toBeNull();
    expect(permitido('aluno', 'notas', 'acao_que_nao_existe')).toBeNull();
    expect(permitido('perfil_inventado' as Perfil, 'notas', 'ler')).toBeNull();
  });

  it('rejeita matriz com escopo ou perfil inválido', () => {
    const escopoRuim = {
      versao: 1,
      descricao: 'x',
      recursos: { notas: { ler: { aluno: 'todos' } } },
    };
    const perfilRuim = {
      versao: 1,
      descricao: 'x',
      recursos: { notas: { ler: { diretor: 'proprio' } } },
    };
    expect(() => validarMatriz(escopoRuim)).toThrow();
    expect(() => validarMatriz(perfilRuim)).toThrow();
  });
});

// Testes gerados: um caso para cada combinação perfil × recurso × ação
describe.each(combinacoes)('$perfil em $recurso.$acao', ({ perfil, escopo }) => {
  it('tem resposta válida (negado ou um escopo conhecido)', () => {
    expect(escopo === null || (ESCOPOS as readonly string[]).includes(escopo)).toBe(true);
  });

  it('só o master tem escopo de plataforma, e o master não tem outro escopo', () => {
    if (escopo === 'plataforma') expect(perfil).toBe('master');
    if (perfil === 'master' && escopo !== null) expect(escopo).toBe('plataforma');
  });
});

// Regras fixas de MATRIZ-DE-PERMISSOES.md
const RECURSOS_ESCOLARES = [
  'usuarios',
  'turmas',
  'disciplinas',
  'vinculos',
  'notas',
  'pedidos_revisao',
  'tarefas',
  'plano_regressivo',
  'comentarios_aluno',
  'avisos',
  'caixa',
  'avisos_escolares',
  'pedidos_ajuda',
  'calendario',
  'tipos_atividade',
  'conta',
  'conta_menor',
  'pedidos_suporte',
  'pedidos_informacao',
  'preferencias_acessibilidade',
  'catalogo_disciplinas',
  'disciplinas_aluno',
  'preferencias_interface',
  'calendario_escolar',
  'regras_nota',
  'identidade_instituicao',
];

describe('regras fixas da matriz', () => {
  it('o master não tem nenhuma permissão sobre dado escolar', () => {
    for (const { perfil, recurso, escopo } of combinacoes) {
      if (perfil === 'master' && RECURSOS_ESCOLARES.includes(recurso))
        expect(escopo, recurso).toBeNull();
    }
  });

  it('só o professor lança notas, e só nas suas turmas', () => {
    for (const perfil of PERFIS) {
      const escopo = permitido(perfil, 'notas', 'lancar');
      expect(escopo).toBe(perfil === 'professor' ? 'vinculo' : null);
    }
  });

  it('o aluno não altera usuários, vínculos, notas nem auditoria', () => {
    expect(permitido('aluno', 'usuarios', 'administrar')).toBeNull();
    expect(permitido('aluno', 'vinculos', 'administrar')).toBeNull();
    expect(permitido('aluno', 'notas', 'lancar')).toBeNull();
    expect(permitido('aluno', 'auditoria', 'ler')).toBeNull();
  });

  it('o responsável só lê, e só do aluno vinculado', () => {
    for (const recurso of ['notas', 'tarefas', 'plano_regressivo', 'comentarios_aluno']) {
      expect(permitido('responsavel', recurso, 'ler'), recurso).toBe('vinculo');
    }
    for (const acao of ['lancar', 'administrar', 'escrever']) {
      for (const recurso of ['notas', 'tarefas', 'plano_regressivo', 'comentarios_aluno']) {
        expect(permitido('responsavel', recurso, acao), `${recurso}.${acao}`).toBeNull();
      }
    }
  });

  it('só o admin administra usuários, turmas e vínculos', () => {
    for (const recurso of ['usuarios', 'turmas', 'disciplinas', 'vinculos']) {
      for (const perfil of PERFIS) {
        expect(permitido(perfil, recurso, 'administrar')).toBe(
          perfil === 'admin' ? 'instituicao' : null,
        );
      }
    }
  });

  it('versão 3: turmas, disciplinas e vínculos só o admin administra; responsável e aluno leem só o próprio vínculo', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(3);
    expect(MATRIZ.recursos.turmas_disciplinas).toBeUndefined();
    expect(permitido('responsavel', 'vinculos', 'ler')).toBe('proprio');
    expect(permitido('aluno', 'vinculos', 'ler')).toBe('proprio');
    expect(permitido('responsavel', 'turmas', 'ler')).toBeNull();
    expect(permitido('professor', 'turmas', 'administrar')).toBeNull();
  });

  it('versão 4: só o professor lança e revisa nota; ninguém mais altera nota', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(4);
    for (const perfil of PERFIS) {
      for (const acao of ['lancar', 'revisar']) {
        expect(permitido(perfil, 'notas', acao), `${perfil}.${acao}`).toBe(
          perfil === 'professor' ? 'vinculo' : null,
        );
      }
    }
  });

  it('versão 4: leitura de notas; o Pedagógico lê a nota atual da instituição, sem histórico', () => {
    expect(permitido('aluno', 'notas', 'ler')).toBe('proprio');
    expect(permitido('responsavel', 'notas', 'ler')).toBe('vinculo');
    expect(permitido('pedagogico', 'notas', 'ler')).toBe('instituicao');
    expect(permitido('admin', 'notas', 'ler')).toBe('instituicao');
    for (const perfil of PERFIS) {
      const historico = permitido(perfil, 'notas', 'ler_historico');
      expect(historico, perfil).toBe(
        perfil === 'professor' ? 'vinculo' : perfil === 'admin' ? 'instituicao' : null,
      );
    }
  });

  it('versão 4: pedido de revisão; aluno só o próprio, responsável só do vinculado, Master nunca', () => {
    expect(permitido('aluno', 'pedidos_revisao', 'pedir')).toBe('proprio');
    expect(permitido('responsavel', 'pedidos_revisao', 'pedir')).toBe('vinculo');
    expect(permitido('admin', 'pedidos_revisao', 'pedir')).toBe('instituicao');
    expect(permitido('pedagogico', 'pedidos_revisao', 'pedir')).toBe('instituicao');
    expect(permitido('professor', 'pedidos_revisao', 'pedir')).toBeNull();
    expect(permitido('master', 'pedidos_revisao', 'pedir')).toBeNull();
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'pedidos_revisao', 'responder')).toBe(
        perfil === 'professor' ? 'vinculo' : null,
      );
    }
  });

  it('versão 5: caixa do sino por perfil escolar; Master nunca; só Admin e Pedagógico publicam aviso', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(5);
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'caixa', 'ler') !== null, `caixa ${perfil}`).toBe(
        perfil !== 'master',
      );
      expect(permitido(perfil, 'avisos_escolares', 'publicar') !== null, `publicar ${perfil}`).toBe(
        perfil === 'admin' || perfil === 'pedagogico',
      );
      expect(permitido(perfil, 'avisos_escolares', 'ler') !== null, `ler ${perfil}`).toBe(
        perfil === 'aluno' || perfil === 'responsavel',
      );
    }
    // O professor só vê, na caixa, o que é das turmas dele
    expect(permitido('professor', 'caixa', 'ler')).toBe('vinculo');
  });

  it('versão 6: só o aluno pede ajuda; professor (vínculo) e Pedagógico atendem; responsável e Admin não leem', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(6);
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'pedidos_ajuda', 'pedir'), `pedir ${perfil}`).toBe(
        perfil === 'aluno' ? 'proprio' : null,
      );
      expect(permitido(perfil, 'pedidos_ajuda', 'atender') !== null, `atender ${perfil}`).toBe(
        perfil === 'professor' || perfil === 'pedagogico',
      );
      expect(permitido(perfil, 'pedidos_ajuda', 'ler') !== null, `ler ${perfil}`).toBe(
        ['aluno', 'professor', 'pedagogico'].includes(perfil),
      );
    }
    expect(permitido('professor', 'pedidos_ajuda', 'atender')).toBe('vinculo');
  });

  it('as preferências de acessibilidade são do próprio usuário, nos 5 perfis escolares (v13, L20a)', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(13);
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'preferencias_acessibilidade', 'administrar')).toBe(
        perfil === 'master' ? null : 'proprio',
      );
    }
  });

  it('as disciplinas do aluno e o catálogo são só do aluno (v14, L20b)', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(14);
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'disciplinas_aluno', 'administrar')).toBe(
        perfil === 'aluno' ? 'proprio' : null,
      );
      expect(permitido(perfil, 'catalogo_disciplinas', 'ler')).toBe(
        perfil === 'aluno' ? 'instituicao' : null,
      );
    }
  });

  it('o Master só lê a quantidade de espaços individuais (v15, 20c-1)', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(15);
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'espacos_individuais', 'ler')).toBe(
        perfil === 'master' ? 'plataforma' : null,
      );
      expect(permitido(perfil, 'convites_individuais', 'administrar')).toBe(
        perfil === 'master' ? 'plataforma' : null,
      );
    }
  });

  it('só o master cria instituições, liga o login Google da demo e usa acesso excepcional', () => {
    for (const perfil of PERFIS) {
      const so = perfil === 'master' ? 'plataforma' : null;
      expect(permitido(perfil, 'instituicoes', 'administrar')).toBe(so);
      expect(permitido(perfil, 'login_google_demo', 'administrar')).toBe(so);
      expect(permitido(perfil, 'acesso_excepcional', 'usar')).toBe(so);
    }
  });
});

describe('matriz v7 (L17a: calendário)', () => {
  it('só o aluno administra o calendário, e só o próprio; o master não tem acesso', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(7);
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'calendario', 'administrar'), perfil).toBe(
        perfil === 'aluno' ? 'proprio' : null,
      );
    }
  });
});

describe('matriz v8 (L17b: tipos de atividade do aluno)', () => {
  it('só o aluno administra os próprios tipos; o master não tem acesso', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(8);
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'tipos_atividade', 'administrar'), perfil).toBe(
        perfil === 'aluno' ? 'proprio' : null,
      );
    }
  });
});

describe('matriz v9 (L17c: conta e suporte)', () => {
  it('todo perfil escolar cuida da própria conta e pede suporte; o master não tem acesso', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(9);
    for (const perfil of PERFIS) {
      const escolar = perfil !== 'master';
      expect(permitido(perfil, 'conta', 'administrar'), `conta ${perfil}`).toBe(
        escolar ? 'proprio' : null,
      );
      expect(permitido(perfil, 'pedidos_suporte', 'pedir'), `pedir ${perfil}`).toBe(
        escolar ? 'proprio' : null,
      );
    }
  });

  it('só o Responsável (vínculo) e o Admin decidem pelo aluno menor; só Admin e Pedagógico atendem o suporte', () => {
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'conta_menor', 'decidir') !== null, `decidir ${perfil}`).toBe(
        perfil === 'responsavel' || perfil === 'admin',
      );
      expect(permitido(perfil, 'pedidos_suporte', 'atender') !== null, `atender ${perfil}`).toBe(
        perfil === 'admin' || perfil === 'pedagogico',
      );
    }
    expect(permitido('responsavel', 'conta_menor', 'decidir')).toBe('vinculo');
  });
});

describe('matriz v10 (L17d: rótulos e VLibras)', () => {
  it('todo perfil escolar escolhe a própria interface; o master não tem acesso', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(10);
    for (const perfil of PERFIS)
      expect(permitido(perfil, 'preferencias_interface', 'administrar'), perfil).toBe(
        perfil === 'master' ? null : 'proprio',
      );
  });
});

describe('matriz v11 (L19: Admin institucional)', () => {
  it('só o Admin administra calendário da escola, regras de notas e identidade', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(11);
    for (const recurso of ['calendario_escolar', 'regras_nota', 'identidade_instituicao'])
      for (const perfil of PERFIS)
        expect(permitido(perfil, recurso, 'administrar'), `${perfil} ${recurso}`).toBe(
          perfil === 'admin' ? 'instituicao' : null,
        );
  });

  it('os 5 perfis escolares leem; aluno e responsável só pelo vínculo no calendário; o master não lê', () => {
    for (const recurso of ['calendario_escolar', 'regras_nota', 'identidade_instituicao'])
      for (const perfil of PERFIS)
        expect(permitido(perfil, recurso, 'ler') === null, `${perfil} ${recurso}`).toBe(
          perfil === 'master',
        );
    for (const perfil of ['aluno', 'responsavel', 'professor'] as const)
      expect(permitido(perfil, 'calendario_escolar', 'ler')).toBe('vinculo');
  });

  it('só o aluno oculta item da escola, e só para si', () => {
    for (const perfil of PERFIS)
      expect(permitido(perfil, 'calendario_escolar', 'ocultar')).toBe(
        perfil === 'aluno' ? 'proprio' : null,
      );
  });
});

describe('matriz v12 (L20: painel Master real)', () => {
  it('só o master administra situação e módulos das instituições e lê as contagens da plataforma', () => {
    expect(MATRIZ.versao).toBeGreaterThanOrEqual(12);
    for (const perfil of PERFIS) {
      const so = perfil === 'master' ? 'plataforma' : null;
      expect(permitido(perfil, 'instituicoes', 'administrar'), perfil).toBe(so);
      expect(permitido(perfil, 'modulos', 'administrar'), perfil).toBe(so);
      expect(permitido(perfil, 'metricas_plataforma', 'ler'), perfil).toBe(so);
    }
  });

  it('a ação antiga "criar_suspender" não existe mais (virou "administrar")', () => {
    for (const perfil of PERFIS)
      expect(permitido(perfil, 'instituicoes', 'criar_suspender')).toBeNull();
  });
});
