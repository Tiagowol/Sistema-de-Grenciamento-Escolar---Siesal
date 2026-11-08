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
  'turmas_disciplinas',
  'vinculos',
  'notas',
  'tarefas',
  'plano_regressivo',
  'comentarios_aluno',
  'avisos',
  'pedidos_informacao',
  'preferencias_acessibilidade',
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
    for (const recurso of ['usuarios', 'turmas_disciplinas', 'vinculos']) {
      for (const perfil of PERFIS) {
        expect(permitido(perfil, recurso, 'administrar')).toBe(
          perfil === 'admin' ? 'instituicao' : null,
        );
      }
    }
  });

  it('as preferências de acessibilidade são só do próprio aluno', () => {
    for (const perfil of PERFIS) {
      expect(permitido(perfil, 'preferencias_acessibilidade', 'administrar')).toBe(
        perfil === 'aluno' ? 'proprio' : null,
      );
    }
  });

  it('só o master cria instituições, liga o login Google da demo e usa acesso excepcional', () => {
    for (const perfil of PERFIS) {
      const so = perfil === 'master' ? 'plataforma' : null;
      expect(permitido(perfil, 'instituicoes', 'criar_suspender')).toBe(so);
      expect(permitido(perfil, 'login_google_demo', 'administrar')).toBe(so);
      expect(permitido(perfil, 'acesso_excepcional', 'usar')).toBe(so);
    }
  });
});
