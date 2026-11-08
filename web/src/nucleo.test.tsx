// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { dataLonga, paraTexto, somarDias } from './datas';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const aluno = { nivel: 'completo', usuario: { id: '1', nome: 'Alex Souza', perfil: 'aluno' } };
const tarefa = {
  id: 't1',
  titulo: 'Resumo de História',
  descricao: '',
  disciplina: 'História',
  tipo: 'tarefa',
  prazo: '2099-01-10',
  prioridade: 'alta',
  situacao: 'pendente',
  microetapas: [
    { id: 'm1', texto: 'Ler capítulo 3', feita: false, ordem: 0 },
    { id: 'm2', texto: 'Escrever tópicos', feita: true, ordem: 1 },
  ],
};
const meuDia = {
  hoje: '2026-11-10',
  atrasadas: [],
  para_hoje: [
    {
      id: 't1',
      titulo: 'Resumo de História',
      disciplina: 'História',
      prazo: '2026-11-10',
      prioridade: 'alta',
      situacao: 'pendente',
      etapas: 2,
      etapas_feitas: 1,
    },
  ],
  proximas: [],
  eventos: [
    {
      id: 'e1',
      titulo: 'Aula de Matemática',
      tipo: 'aula',
      origem: 'manual',
      hora_inicio: '07:30',
      minutos: 50,
    },
  ],
  minutos_estudados_hoje: 20,
  sessao_atual: null,
  tarefas_concluidas: 1,
  tarefas_total: 3,
};
const rotas: Record<string, unknown> = {
  'GET /config': { instituicao_padrao: 'x', modo_local: true },
  'GET /auth/eu': aluno,
  'GET /meu-dia': meuDia,
  'GET /tarefas': { tarefas: [tarefa] },
  'GET /sessoes/atual': { sessao: null },
  'GET /notas-pessoais': {
    notas: [
      { id: 'n1', disciplina: 'Matemática', descricao: 'Prova 2', valor: 8.5, dia: '2026-11-06' },
    ],
    medias: [{ disciplina: 'Matemática', media: 8.5, quantidade: 1 }],
  },
  'GET /notificacoes': {
    notificacoes: [
      {
        id: 'a1',
        tipo: 'prazo_hoje',
        titulo: 'Prazo hoje: Resumo de História',
        lida: false,
        quando: '10/11 09:00',
      },
    ],
    nao_lidas: 1,
  },
};

function simular() {
  const chamadas: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const chave = `${init?.method ?? 'GET'} ${url.replace('/api', '').split('?')[0]}`;
      chamadas.push(chave);
      if (chave.startsWith('GET /eventos')) return new Response(JSON.stringify({ eventos: [] }));
      const corpo = rotas[chave];
      return corpo === undefined
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(corpo));
    }),
  );
  return chamadas;
}

async function violacoes(no: Element) {
  const r = await axe.run(no, { rules: { 'color-contrast': { enabled: false } } });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`);
}

async function irPara(nome: string) {
  await screen.findByRole('navigation');
  await userEvent.click(
    within(screen.getByRole('navigation')).getByRole('button', { name: new RegExp(`^${nome}`) }),
  );
}

describe('telas do aluno', () => {
  it('aluno entra no Meu dia e o menu tem as telas do Núcleo', async () => {
    simular();
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: /Olá, Alex/ });
    for (const n of [
      'Meu dia',
      'Atividades',
      'Agenda',
      'Modo foco',
      'Notas',
      'Avisos',
      'Acessibilidade',
    ]) {
      expect(
        within(screen.getByRole('navigation')).getByRole('button', { name: new RegExp(`^${n}`) }),
      ).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Usuários' })).toBeNull();
    expect(await violacoes(container)).toEqual([]);
  });

  it('atividades: mostra etapas e plano e passa no axe', async () => {
    const chamadas = simular();
    const { container } = render(<App />);
    await irPara('Atividades');
    await screen.findByText('Resumo de História');
    await userEvent.click(screen.getByRole('button', { name: /Ver etapas e plano/ }));
    await userEvent.click(await screen.findByLabelText('Ler capítulo 3'));
    expect(chamadas).toContain('PATCH /microetapas/m1');
    expect(screen.getByRole('button', { name: 'Montar plano' })).toBeTruthy();
    expect(await violacoes(container)).toEqual([]);
  });

  it('atividades: singular na contagem e prazo editável com dica (Lote 12, defeitos 2, 3 e 6)', async () => {
    const chamadas = simular();
    render(<App />);
    await irPara('Atividades');
    await screen.findByText('Resumo de História');
    expect(screen.getByText('1 atividade')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Ver etapas e plano/ }));
    const campo = await screen.findByLabelText('Prazo');
    expect(campo.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getAllByText(/dia, mês e ano/i).length).toBeGreaterThan(0);
    fireEvent.change(campo, { target: { value: '2099-02-20' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar prazo' }));
    expect(chamadas).toContain('PATCH /tarefas/t1');
  });

  it('agenda: ao trocar de semana o dia selecionado acompanha (Lote 12, defeito 4)', async () => {
    simular();
    render(<App />);
    await irPara('Agenda');
    await screen.findByRole('heading', { name: /Agenda visual/ });
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    const esperado = dataLonga(somarDias(paraTexto(new Date()), 7));
    expect(screen.getByText(`Será criado em ${esperado}.`)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByText(`Será criado em ${dataLonga(paraTexto(new Date()))}.`)).toBeTruthy();
  });

  it('agenda, foco, notas e avisos passam no axe', async () => {
    simular();
    const { container } = render(<App />);
    for (const [botao, titulo] of [
      ['Agenda', /Agenda visual/],
      ['Modo foco', 'Modo foco'],
      ['Notas', 'Minhas notas'],
      ['Avisos', 'Avisos'],
    ] as const) {
      await irPara(botao);
      await screen.findByRole('heading', { name: titulo });
      await waitFor(async () => expect(await violacoes(container)).toEqual([]));
    }
  });

  it('avisos marca como lido pelo servidor', async () => {
    const chamadas = simular();
    render(<App />);
    await irPara('Avisos');
    await userEvent.click(await screen.findByRole('button', { name: /Marcar como lido/ }));
    expect(chamadas).toContain('POST /notificacoes/a1/lida');
  });
});
