// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Eu, Evento, Identidade, ItemEscolar, MediaDoAluno, RegraNota } from './api';
import { Shell } from './componentes/Shell';
import { paraTexto } from './datas';
import { corDaEscola, corDaEscolaLegivel } from './identidade';
import { Calendario } from './paginas/Calendario';
import { CalendarioEscola } from './paginas/CalendarioEscola';
import { IdentidadeEscola } from './paginas/IdentidadeEscola';
import { NotasOficiais } from './paginas/NotasOficiais';
import { RegrasNotas } from './paginas/RegrasNotas';
import { aplicarPreferencias, definirEscola, PREFERENCIAS_PADRAO } from './preferencias';

// L19: Admin institucional (calendário da escola, regras de notas, identidade). Só dados fictícios.
const semContraste = { rules: { 'color-contrast': { enabled: false } } };
const hoje = paraTexto(new Date());
const ano = hoje.slice(0, 4);

type Chamada = { metodo: string; url: string; corpo: unknown };
// Responde cada caminho com o objeto dado; POST sem resposta própria = 201 vazio
function simular(respostas: Record<string, unknown>) {
  const chamadas: Chamada[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      const caminho = url.replace('/api', '');
      chamadas.push({
        metodo,
        url: caminho,
        corpo: init?.body ? JSON.parse(String(init.body)) : null,
      });
      const chave = Object.keys(respostas).find(
        (k) => caminho.startsWith(k.split(' ')[1] ?? k) && k.startsWith(metodo),
      );
      if (chave) return new Response(JSON.stringify(respostas[chave]), { status: 200 });
      if (metodo === 'POST') return new Response(JSON.stringify({}), { status: 201 });
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );
  return chamadas;
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  definirEscola(null);
  document.body.removeAttribute('style');
  document.body.className = '';
});

const ITEM: ItemEscolar = {
  id: 'i1',
  tipo: 'feriado',
  titulo: 'Feriado municipal',
  dia_inicio: hoje,
  dia_fim: hoje,
  turma_id: null,
  turma_nome: null,
};

describe('Calendário da escola', () => {
  it('Admin: lista com palavra, data e faixa; cadastra item; axe sem violações', async () => {
    const chamadas = simular({
      'GET /escola/calendario': { itens: [ITEM] },
      'GET /turmas': {
        turmas: [{ id: 't1', nome: '7º A', ano_letivo: 2026, turno: 'manha', ativa: true }],
      },
    });
    const { container } = render(<CalendarioEscola perfil="admin" />);
    await screen.findAllByText('Feriado municipal');
    expect(screen.getAllByText('Escola toda').length).toBeGreaterThan(0);
    // Tempo concreto: palavra ("hoje") e a faixa de quadrados
    expect(screen.getAllByText('hoje').length).toBeGreaterThan(0);
    expect(chamadas[0]?.url).toBe(`/escola/calendario?de=${ano}-01-01&ate=${ano}-12-31`);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Nome'), 'Feira de ciências');
    await u.selectOptions(await screen.findByLabelText('Para quem'), 'Só a turma 7º A');
    await u.click(screen.getByRole('button', { name: 'Cadastrar' }));
    await waitFor(() =>
      expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
        tipo: 'evento',
        titulo: 'Feira de ciências',
        dia_inicio: hoje,
        dia_fim: hoje,
        turma_id: 't1',
      }),
    );
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('Admin: último dia antes do primeiro não é enviado', async () => {
    const chamadas = simular({ 'GET /escola/calendario': { itens: [] } });
    render(<CalendarioEscola perfil="admin" />);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Nome'), 'Recesso');
    const fim = screen.getByLabelText('Último dia') as HTMLInputElement;
    await u.clear(fim);
    await u.type(fim, '2000-01-01');
    await u.click(screen.getByRole('button', { name: 'Cadastrar' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('Professor: só lê (sem formulário nem botões de editar); axe sem violações', async () => {
    simular({
      'GET /escola/calendario': { itens: [{ ...ITEM, turma_id: 't1', turma_nome: '7º A' }] },
    });
    const { container } = render(<CalendarioEscola perfil="professor" />);
    await screen.findByText('Turma 7º A');
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(screen.queryByLabelText('Nome')).toBeNull();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('Aluno: o item da escola aparece no Calendário com selo e "Ocultar" usa o item', async () => {
    const escolar: Evento = {
      id: `escola-i1-${hoje}`,
      item_id: 'i1',
      titulo: 'Feriado municipal',
      tipo: 'feriado',
      origem: 'calendario_escolar',
      dia: hoje,
      hora_inicio: null,
      minutos: null,
      turma_nome: null,
    };
    const chamadas = simular({ 'GET /eventos': { eventos: [escolar] } });
    const { container } = render(<Calendario />);
    await userEvent.click(screen.getByRole('button', { name: 'Dia' }));
    await screen.findAllByText('Feriado municipal');
    expect(screen.getAllByText('do calendário da escola').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Editar Feriado/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Ocultar/ }));
    await waitFor(() =>
      expect(
        chamadas.some((c) => c.metodo === 'POST' && c.url === '/escola/calendario/i1/ocultar'),
      ).toBe(true),
    );
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });
});

const REGRA: RegraNota = {
  numero: 2,
  vigente_desde: '2026-08-01',
  arredondamento: 'meio',
  periodos: [
    { nome: '1º semestre', inicio: '2026-02-01', fim: '2026-06-30', peso: 1 },
    { nome: '2º semestre', inicio: '2026-08-01', fim: '2026-12-15', peso: 2 },
  ],
};

describe('Regras de notas', () => {
  it('mostra a regra de hoje em texto literal e grava nova versão; axe sem violações', async () => {
    const chamadas = simular({
      'GET /escola/regras-notas': {
        vigente: REGRA,
        versoes: [{ ...REGRA, autor_nome: 'Admin Fictício', criada_em: '2026-08-01' }],
      },
      'POST /escola/regras-notas': { numero: 3 },
    });
    const { container } = render(<RegrasNotas />);
    await screen.findByText(/Versão 2, vale desde 01\/08/);
    expect(screen.getByText(/meio ponto/)).toBeTruthy();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Começar pela regra de hoje' }));
    await u.click(screen.getByRole('button', { name: 'Gravar nova versão' }));
    await waitFor(() =>
      expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toMatchObject({
        arredondamento: 'meio',
        periodos: REGRA.periodos,
      }),
    );
    expect(await screen.findByText(/Versão 3 gravada/)).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('período sem datas não é enviado', async () => {
    const chamadas = simular({ 'GET /escola/regras-notas': { vigente: null, versoes: [] } });
    render(<RegrasNotas />);
    await screen.findByText('A escola ainda não tem regra de notas.');
    await userEvent.click(screen.getByRole('button', { name: 'Gravar nova versão' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });
});

const IDENT: Identidade = {
  numero: 1,
  nome_exibicao: 'Escola Municipal Exemplo',
  cor_claro: '#155bb4',
  cor_escuro: '#8cbcff',
  tem_logotipo: false,
};

describe('Identidade da escola', () => {
  it('avisa contraste ruim antes de enviar e não envia; axe sem violações', async () => {
    const chamadas = simular({ 'GET /escola/identidade': { identidade: IDENT, versoes: [] } });
    const { container } = render(<IdentidadeEscola />);
    const campo = (await screen.findByLabelText('Cor para o tema claro')) as HTMLInputElement;
    await waitFor(() => expect(campo.value).toBe('#155bb4'));
    expect(screen.getAllByText('Contraste bom: pode ser usada.').length).toBe(2);
    const u = userEvent.setup();
    await u.clear(campo);
    await u.type(campo, '#ffff00');
    expect(screen.getByText('Pouco contraste: escolha uma cor mais escura.')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Gravar nova versão' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('a mesma regra de contraste da API: escura no claro, clara no escuro', () => {
    expect(corDaEscolaLegivel('#155bb4', 'claro')).toBe(true);
    expect(corDaEscolaLegivel('#155bb4', 'escuro')).toBe(false);
    expect(corDaEscolaLegivel('#8cbcff', 'escuro')).toBe(true);
    expect(corDaEscola(IDENT, 'alto_contraste')).toBeNull();
  });

  it('a cor da escola vale sem cor do aluno; a cor do aluno sempre vence', () => {
    definirEscola(IDENT);
    aplicarPreferencias({ ...PREFERENCIAS_PADRAO });
    expect(document.body.style.getPropertyValue('--primary')).toBe('#155bb4');
    aplicarPreferencias({ ...PREFERENCIAS_PADRAO, escuro: true });
    expect(document.body.style.getPropertyValue('--primary')).toBe('#8cbcff');
    aplicarPreferencias({ ...PREFERENCIAS_PADRAO, cor: 'rosa' });
    expect(document.body.style.getPropertyValue('--primary')).toBe('#a02c6b');
    aplicarPreferencias({ ...PREFERENCIAS_PADRAO, contraste: true });
    expect(document.body.style.getPropertyValue('--primary')).toBe('');
  });
});

const euDe = (perfil: Eu['usuario']['perfil']): Eu => ({
  nivel: 'completo',
  usuario: { id: 'u1', nome: 'Pessoa Fictícia', perfil },
});

describe('menu e marca da escola', () => {
  it.each([
    ['admin', ['Calendário da escola', 'Regras de notas', 'Identidade da escola']],
    ['professor', ['Calendário da escola']],
    ['pedagogico', ['Calendário da escola']],
    ['responsavel', ['Calendário da escola']],
    ['aluno', []],
  ] as const)('%s vê só os itens do L19 permitidos', (perfil, esperados) => {
    simular({});
    render(
      <Shell eu={euDe(perfil)} pagina="inicio" aoIr={() => undefined} aoSair={() => undefined}>
        <p>x</p>
      </Shell>,
    );
    const menu = screen.getByRole('complementary', { name: 'Menu principal' });
    for (const nome of ['Calendário da escola', 'Regras de notas', 'Identidade da escola'])
      expect(within(menu).queryAllByText(nome).length > 0, nome).toBe(
        (esperados as readonly string[]).includes(nome),
      );
  });

  it('o menu mostra o nome da escola no lugar de SIESAL; o logotipo é decorativo', async () => {
    simular({});
    const { container } = render(
      <Shell
        eu={euDe('admin')}
        pagina="inicio"
        aoIr={() => undefined}
        aoSair={() => undefined}
        escola={{
          nome: 'Escola Municipal Exemplo',
          logotipo: '/api/escola/identidade/logotipo?v=1',
        }}
      >
        <p>x</p>
      </Shell>,
    );
    expect(screen.getByText('Escola Municipal Exemplo')).toBeTruthy();
    expect(container.querySelector('.brand-logo')?.getAttribute('alt')).toBe('');
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });
});

const MEDIA: MediaDoAluno = {
  aluno_id: 'a1',
  disciplina_id: 'd1',
  disciplina_nome: 'Matemática',
  periodos: [
    { ...(REGRA.periodos[0] as RegraNota['periodos'][0]), media: 7 },
    { ...(REGRA.periodos[1] as RegraNota['periodos'][0]), media: null },
  ],
  final: 7,
};

describe('Notas oficiais com a regra (L19)', () => {
  it('aluno vê a regra e as próprias médias, com "sem nota ainda"; axe sem violações', async () => {
    simular({
      'GET /notas-oficiais': { notas: [], regra: REGRA, medias: [MEDIA] },
      'GET /pedidos-revisao': { pedidos: [] },
    });
    const { container } = render(<NotasOficiais perfil="aluno" />);
    await screen.findByRole('heading', { name: 'Médias pela regra de hoje' });
    expect(screen.getByText(/1º semestre \(peso 1\): 7,0/)).toBeTruthy();
    expect(screen.getByText(/2º semestre \(peso 2\): sem nota ainda/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Regra de notas da escola' })).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('Admin não recebe médias e a tela não mostra a seção', async () => {
    simular({
      'GET /notas-oficiais': { notas: [], regra: REGRA },
      'GET /pedidos-revisao': { pedidos: [] },
    });
    render(<NotasOficiais perfil="admin" />);
    await screen.findByRole('heading', { name: 'Regra de notas da escola' });
    expect(screen.queryByRole('heading', { name: 'Médias pela regra de hoje' })).toBeNull();
  });
});
