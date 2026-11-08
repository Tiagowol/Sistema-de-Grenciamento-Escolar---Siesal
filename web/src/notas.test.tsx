// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Shell } from './componentes/Shell';
import { NotasOficiais } from './paginas/NotasOficiais';
import { NotasProfessor } from './paginas/NotasProfessor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const NOTA = {
  id: 'n1',
  aluno_id: 'a1',
  aluno_nome: 'Aluna Fictícia',
  turma_id: 't1',
  turma_nome: '7º A',
  disciplina_id: 'd1',
  disciplina_nome: 'Matemática',
  descricao: 'Prova 1',
  dia: '2026-11-05',
  versao: 2,
  valor: 8.3,
  atualizada_em: '2026-11-07',
  pode_revisar: true,
  pedido_aberto_meu: false,
  versoes: [
    {
      numero: 2,
      valor: 8.3,
      motivo: 'Somei um item.',
      autor_nome: 'Professora Fictícia',
      dia: '2026-11-07',
    },
    { numero: 1, valor: 7.5, motivo: '', autor_nome: 'Professora Fictícia', dia: '2026-11-05' },
  ],
};
const PEDIDO = {
  id: 'p1',
  nota_id: 'n1',
  perfil_pedinte: 'aluno',
  pedinte_nome: 'Aluna Fictícia',
  texto: 'Acho que faltou somar a questão 4.',
  estado: 'aberto',
  criado_em: '2026-11-06',
  motivo_resposta: '',
  respondido_em: null,
  aluno_nome: 'Aluna Fictícia',
  turma_nome: '7º A',
  disciplina_nome: 'Matemática',
  nota_descricao: 'Prova 1',
  nota_dia: '2026-11-05',
  valor_atual: 8.3,
  versao_atual: 2,
  pode_responder: true,
};
const TURMAS = [
  {
    turma_id: 't1',
    turma_nome: '7º A',
    ano_letivo: 2026,
    disciplina_id: 'd1',
    disciplina_nome: 'Matemática',
    alunos: [{ id: 'a1', nome: 'Aluna Fictícia' }],
  },
];

// Responde às rotas das telas e guarda as chamadas de escrita
function simular(dados: Record<string, unknown>) {
  const escritas: { url: string; corpo: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const caminho = url.replace('/api', '');
      if (init?.method === 'POST') {
        escritas.push({ url: caminho, corpo: init.body ? JSON.parse(String(init.body)) : null });
        const semCorpo = caminho.endsWith('/manter');
        return new Response(semCorpo ? null : JSON.stringify({ id: 'novo', versao: 3 }), {
          status: semCorpo ? 204 : 201,
        });
      }
      return new Response(JSON.stringify(dados[caminho] ?? {}), {
        status: dados[caminho] ? 200 : 404,
      });
    }),
  );
  return escritas;
}

const rotasProfessor = {
  '/professor/turmas': { turmas: TURMAS },
  '/notas-oficiais': { notas: [NOTA] },
  '/pedidos-revisao': { pedidos: [PEDIDO] },
};

describe('tela do Professor: notas da turma', () => {
  it('mostra pedidos abertos, notas lançadas e versões em dia/mês, sem violações do axe', async () => {
    simular(rotasProfessor);
    const { container } = render(<NotasProfessor />);
    await screen.findByText(/Acho que faltou somar a questão 4/);
    expect(screen.getByText(/Pedir revisão não obriga a mudar a nota/)).toBeTruthy();
    expect(screen.getAllByText(/05\/11/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ver versões anteriores \(1\)/)).toBeTruthy();
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it('não mostra ranking, média da turma nem linguagem de correção', async () => {
    simular(rotasProfessor);
    const { container } = render(<NotasProfessor />);
    await screen.findByText(/Acho que faltou somar/);
    expect(container.textContent).not.toMatch(/ranking|média da turma|posição|correção|corrigir/i);
  });

  it('lança nota pelo formulário com os campos certos', async () => {
    const escritas = simular(rotasProfessor);
    render(<NotasProfessor />);
    await screen.findByText(/Acho que faltou somar/);
    await userEvent.click(screen.getByRole('button', { name: /Lançar nota/ }));
    await screen.findByText(/Escolha o aluno e informe uma nota/);
    expect(escritas.length).toBe(0);
    await userEvent.selectOptions(screen.getByLabelText('Aluno'), 'a1');
    await userEvent.type(screen.getByLabelText('Nota (0 a 10)'), '9,5');
    await userEvent.click(screen.getByRole('button', { name: /Lançar nota/ }));
    await waitFor(() => expect(escritas.length).toBe(1));
    expect(escritas[0]?.url).toBe('/notas-oficiais');
    expect(escritas[0]?.corpo).toMatchObject({
      aluno_id: 'a1',
      turma_id: 't1',
      disciplina_id: 'd1',
      valor: 9.5,
    });
    await screen.findByText('Nota lançada.');
  });

  it('revisa a nota ligada ao pedido: exige motivo e envia o pedido_id', async () => {
    const escritas = simular(rotasProfessor);
    render(<NotasProfessor />);
    const pedido = (await screen.findByText(/Acho que faltou somar/)).closest('li') as HTMLElement;
    await userEvent.click(within(pedido).getByRole('button', { name: /Revisar a nota/ }));
    await userEvent.type(screen.getByLabelText('Nova nota (0 a 10)'), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar revisão' }));
    await screen.findByText('Escreva o motivo da revisão.');
    expect(escritas.length).toBe(0);
    await userEvent.type(screen.getByLabelText('Motivo da revisão'), 'Somei a questão 4.');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar revisão' }));
    await waitFor(() => expect(escritas.length).toBe(1));
    expect(escritas[0]?.url).toBe('/notas-oficiais/n1/revisoes');
    expect(escritas[0]?.corpo).toEqual({ valor: 9, motivo: 'Somei a questão 4.', pedido_id: 'p1' });
  });

  it('manter a nota exige motivo', async () => {
    const escritas = simular(rotasProfessor);
    render(<NotasProfessor />);
    const pedido = (await screen.findByText(/Acho que faltou somar/)).closest('li') as HTMLElement;
    await userEvent.click(within(pedido).getByRole('button', { name: /Manter a nota/ }));
    await userEvent.click(screen.getByRole('button', { name: /Responder: manter a nota/ }));
    await screen.findByText('Escreva o motivo para manter a nota.');
    expect(escritas.length).toBe(0);
    await userEvent.type(
      screen.getByLabelText('Motivo para manter a nota'),
      'A questão 4 estava em branco.',
    );
    await userEvent.click(screen.getByRole('button', { name: /Responder: manter a nota/ }));
    await waitFor(() => expect(escritas.length).toBe(1));
    expect(escritas[0]?.url).toBe('/pedidos-revisao/p1/manter');
    expect(escritas[0]?.corpo).toEqual({ motivo: 'A questão 4 estava em branco.' });
  });

  it('pedido de nota lançada por outro professor não oferece resposta', async () => {
    simular({
      ...rotasProfessor,
      '/pedidos-revisao': { pedidos: [{ ...PEDIDO, pode_responder: false }] },
      '/notas-oficiais': { notas: [{ ...NOTA, pode_revisar: false }] },
    });
    render(<NotasProfessor />);
    await screen.findByText(/Outro professor lançou esta nota/);
    expect(screen.queryByRole('button', { name: /Manter a nota/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Revisar/ })).toBeNull();
  });
});

describe('tela de notas oficiais (aluno, responsável, Admin, Pedagógico)', () => {
  const NOTA_ALUNO = { ...NOTA, pode_revisar: false, versoes: undefined };
  const rotas = {
    '/notas-oficiais': { notas: [NOTA_ALUNO] },
    '/pedidos-revisao': { pedidos: [] },
  };

  it('aluno vê a nota com número e barra, data em dia/mês, sem violações do axe', async () => {
    simular(rotas);
    const { container } = render(<NotasOficiais perfil="aluno" />);
    await screen.findByText('Matemática');
    expect(screen.getAllByText('8,3').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: /Nota de Matemática/ })).toBeTruthy();
    expect(screen.getAllByText(/05\/11/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Ver versões anteriores/)).toBeNull();
    expect(container.textContent).not.toMatch(/ranking|média da turma|posição|correção/i);
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it('pede revisão: texto obrigatório e envio à nota certa', async () => {
    const escritas = simular(rotas);
    render(<NotasOficiais perfil="aluno" />);
    await screen.findByText('Matemática');
    await userEvent.click(screen.getByRole('button', { name: /Pedir revisão/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido de revisão' }));
    await screen.findByText(/Escreva o que você gostaria/);
    expect(escritas.length).toBe(0);
    await userEvent.type(screen.getByLabelText(/O que você gostaria/), 'Pode olhar a questão 4?');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido de revisão' }));
    await waitFor(() => expect(escritas.length).toBe(1));
    expect(escritas[0]?.url).toBe('/notas-oficiais/n1/pedidos');
    expect(escritas[0]?.corpo).toEqual({ texto: 'Pode olhar a questão 4?' });
    await screen.findByText(/Pedido enviado/);
  });

  it('nota com pedido aberto não oferece outro pedido', async () => {
    simular({
      ...rotas,
      '/notas-oficiais': { notas: [{ ...NOTA_ALUNO, pedido_aberto_meu: true }] },
    });
    render(<NotasOficiais perfil="aluno" />);
    await screen.findByText(/Pedido aberto. Aguardando o professor/);
    expect(screen.queryByRole('button', { name: /Pedir revisão/ })).toBeNull();
  });

  it('quem pediu vê o estado e a resposta', async () => {
    simular({
      ...rotas,
      '/pedidos-revisao': {
        pedidos: [
          {
            ...PEDIDO,
            estado: 'mantida',
            motivo_resposta: 'A questão 4 estava em branco.',
            respondido_em: '2026-11-08',
            pode_responder: false,
          },
        ],
      },
    });
    const { container } = render(<NotasOficiais perfil="responsavel" />);
    await screen.findByText('Nota mantida');
    expect(screen.getByText(/A questão 4 estava em branco/)).toBeTruthy();
    expect(screen.getByText(/08\/11/)).toBeTruthy();
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it('o Admin vê as versões anteriores', async () => {
    simular({ ...rotas, '/notas-oficiais': { notas: [NOTA] } });
    render(<NotasOficiais perfil="admin" />);
    await screen.findByText(/Ver versões anteriores \(1\)/);
  });
});

describe('menu por perfil', () => {
  const eu = (perfil: string) =>
    ({ nivel: 'completo', usuario: { id: 'u', nome: 'Pessoa Fictícia', perfil } }) as never;
  it.each([
    ['professor', 'Notas da turma'],
    ['aluno', 'Notas oficiais'],
    ['responsavel', 'Notas oficiais'],
    ['admin', 'Notas oficiais'],
    ['pedagogico', 'Notas oficiais'],
  ])('%s vê "%s"', (perfil, rotulo) => {
    render(
      <Shell eu={eu(perfil)} pagina="inicio" aoIr={() => undefined} aoSair={() => undefined}>
        <p>x</p>
      </Shell>,
    );
    expect(screen.getByRole('button', { name: rotulo })).toBeTruthy();
  });
  it('o professor não vê "Notas oficiais" e o responsável não vê "Notas da turma"', () => {
    render(
      <Shell eu={eu('professor')} pagina="inicio" aoIr={() => undefined} aoSair={() => undefined}>
        <p>x</p>
      </Shell>,
    );
    expect(screen.queryByRole('button', { name: 'Notas oficiais' })).toBeNull();
    cleanup();
    render(
      <Shell eu={eu('responsavel')} pagina="inicio" aoIr={() => undefined} aoSair={() => undefined}>
        <p>x</p>
      </Shell>,
    );
    expect(screen.queryByRole('button', { name: 'Notas da turma' })).toBeNull();
  });
});
