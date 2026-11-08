// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { BLOCOS, blocoDe } from './blocos';
import { TempoVisual } from './componentes/TempoVisual';
import { diasAte, paraTexto, parteDoDia } from './datas';
import { carregarPreferencias, PREFERENCIAS_PADRAO } from './preferencias';

// Lote 13: tempo concreto (palavra, data e forma; blocos; parte do dia)

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const desligarVisual = () =>
  localStorage.setItem(
    'siesal-preferencias-v1',
    JSON.stringify({ ...PREFERENCIAS_PADRAO, tempoVisual: false }),
  );

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
  microetapas: [],
};
const hoje = paraTexto(new Date());
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
  eventos: [],
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
  'POST /tarefas/t1/plano': { blocos: [{ dia: '2098-12-01', minutos: 45 }] },
  'POST /sessoes': { sessao: null },
};

// Simula o servidor e guarda o corpo enviado em cada chamada
function simular(eventos: unknown[] = []) {
  const corpos: Record<string, unknown> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const chave = `${init?.method ?? 'GET'} ${url.replace('/api', '').split('?')[0]}`;
      if (init?.body) corpos[chave] = JSON.parse(String(init.body));
      if (chave.startsWith('GET /eventos')) return new Response(JSON.stringify({ eventos }));
      const corpo = rotas[chave];
      return corpo === undefined
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(corpo));
    }),
  );
  return corpos;
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

describe('funções de tempo', () => {
  it('conta dias até o prazo e define a parte do dia', () => {
    expect(diasAte('2026-11-12', '2026-11-10')).toBe(2);
    expect(diasAte('2026-11-09', '2026-11-10')).toBe(-1);
    expect(parteDoDia('07:30')).toBe('manha');
    expect(parteDoDia('11:59')).toBe('manha');
    expect(parteDoDia('12:00')).toBe('tarde');
    expect(parteDoDia('17:59')).toBe('tarde');
    expect(parteDoDia('18:00')).toBe('noite');
    expect(parteDoDia(null)).toBeNull();
  });
  it('os blocos têm minutos fixos e blocoDe acha o mais próximo', () => {
    expect(BLOCOS.map((b) => b.minutos)).toEqual([10, 25, 45]);
    expect(blocoDe(5).id).toBe('curto');
    expect(blocoDe(25).id).toBe('medio');
    expect(blocoDe(50).id).toBe('longo');
  });
  it('preferência tempoVisual: ligada por padrão, desligada só com false', () => {
    expect(PREFERENCIAS_PADRAO.tempoVisual).toBe(true);
    expect(carregarPreferencias({ getItem: () => null }).tempoVisual).toBe(true);
    expect(carregarPreferencias({ getItem: () => '{"tempoVisual":false}' }).tempoVisual).toBe(
      false,
    );
    expect(carregarPreferencias({ getItem: () => '{"tempoVisual":"nao"}' }).tempoVisual).toBe(true);
  });
});

describe('item 1: TempoVisual', () => {
  it('mostra palavra, data dia/mês e a faixa de dias', () => {
    const { container } = render(<TempoVisual prazo="2026-11-11" hoje="2026-11-10" />);
    expect(screen.getByText('amanhã')).toBeTruthy();
    expect(screen.getByText('11/11')).toBeTruthy();
    expect(container.querySelectorAll('.tempo-blocos span').length).toBe(7);
    expect(container.querySelectorAll('.tempo-blocos span.cheio').length).toBe(1);
  });
  it('prazo que passou não enche a faixa e sem prazo diz "sem prazo"', () => {
    const { container, rerender } = render(<TempoVisual prazo="2026-11-08" hoje="2026-11-10" />);
    expect(screen.getByText('há 2 dias')).toBeTruthy();
    expect(container.querySelectorAll('.tempo-blocos span.cheio').length).toBe(0);
    rerender(<TempoVisual prazo={null} hoje="2026-11-10" />);
    expect(screen.getByText('sem prazo')).toBeTruthy();
  });
  it('com a preferência desligada volta ao texto simples, sem faixa', () => {
    desligarVisual();
    const { container } = render(<TempoVisual prazo="2026-11-11" hoje="2026-11-10" />);
    expect(screen.getByText('11/11 · amanhã')).toBeTruthy();
    expect(container.querySelector('.tempo-blocos')).toBeNull();
  });
  it('Meu dia usa o componente e passa no axe', async () => {
    simular();
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: /Olá, Alex/ });
    await screen.findAllByText('Resumo de História');
    expect(screen.getAllByText('hoje').length).toBeGreaterThan(0);
    expect(container.querySelector('.tempo-visual')).toBeTruthy();
    expect(await violacoes(container)).toEqual([]);
  });
  it('Atividades mostra o prazo com palavra, data e faixa', async () => {
    simular();
    const { container } = render(<App />);
    await irPara('Atividades');
    await screen.findByText('Resumo de História');
    expect(screen.getByText('10/01')).toBeTruthy();
    expect(container.querySelector('.tempo-blocos')).toBeTruthy();
  });
});

describe('item 2: duração em blocos', () => {
  it('plano: o aluno escolhe o bloco e a quantidade, sem digitar minutos', async () => {
    const corpos = simular();
    const { container } = render(<App />);
    await irPara('Atividades');
    await screen.findByText('Resumo de História');
    await userEvent.click(screen.getByRole('button', { name: /Ver etapas e plano/ }));
    expect(screen.queryByLabelText(/minutos\)/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Longo/ }));
    await userEvent.selectOptions(screen.getByLabelText('Quantos blocos de estudo'), '2');
    expect(await violacoes(container)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Montar plano' }));
    await waitFor(() =>
      expect(corpos['POST /tarefas/t1/plano']).toEqual({
        minutos_total: 90,
        minutos_por_sessao: 45,
      }),
    );
  });
  it('foco: botões curto, médio e longo com minutos ao lado; inicia com o bloco escolhido', async () => {
    const corpos = simular();
    render(<App />);
    await irPara('Modo foco');
    const grupo = await screen.findByRole('group', { name: 'Tamanho do bloco' });
    const botoes = within(grupo).getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['Curto10 min', 'Médio25 min', 'Longo45 min']);
    await userEvent.click(within(grupo).getByRole('button', { name: /Médio/ }));
    await userEvent.click(screen.getByRole('button', { name: /Iniciar foco/ }));
    await waitFor(() => expect(corpos['POST /sessoes']).toMatchObject({ minutos_planejados: 25 }));
  });
});

describe('item 3: preferência, foco que diminui e agenda por parte do dia', () => {
  it('Acessibilidade: o controle existe, vem ligado e grava no aparelho', async () => {
    simular();
    const { container } = render(<App />);
    await irPara('Acessibilidade');
    const chave = await screen.findByRole('switch', { name: 'Mostrar tempo de forma visual' });
    expect(chave.getAttribute('aria-checked')).toBe('true');
    expect(await violacoes(container)).toEqual([]);
    await userEvent.click(chave);
    expect(chave.getAttribute('aria-checked')).toBe('false');
    expect(JSON.parse(localStorage.getItem('siesal-preferencias-v1') ?? '{}').tempoVisual).toBe(
      false,
    );
  });
  it('foco: por padrão há uma forma e nenhum número; o aluno pode mostrar os números', async () => {
    simular();
    const { container } = render(<App />);
    await irPara('Modo foco');
    await screen.findByRole('group', { name: 'Tamanho do bloco' });
    expect(container.querySelector('.focusdisc')).toBeTruthy();
    expect(container.querySelector('.progress')).toBeNull();
    expect(screen.getByRole('timer').textContent).toBe('Bloco curto');
    expect(screen.queryByText(/\d\d:\d\d/)).toBeNull();
    expect(await violacoes(container)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar os números' }));
    expect(screen.getByRole('timer').textContent).toBe('10:00');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar os números' }));
    expect(screen.getByRole('timer').textContent).toBe('Bloco curto');
  });
  it('foco: a forma encolhe com o tempo e a frase muda', async () => {
    const sessao = {
      id: 's1',
      tarefa_id: null,
      tarefa_titulo: null,
      minutos_planejados: 10,
      segundos_decorridos: 420,
    };
    rotas['GET /sessoes/atual'] = { sessao };
    try {
      simular();
      const { container } = render(<App />);
      await irPara('Modo foco');
      await screen.findByRole('button', { name: /Concluir bloco/ });
      expect(screen.getByRole('timer').textContent).toBe('Falta menos da metade');
      const forma = container.querySelector('.focusdisc') as HTMLElement;
      expect(forma.style.transform).toMatch(/^scale\(0\.3/);
    } finally {
      rotas['GET /sessoes/atual'] = { sessao: null };
    }
  });
  it('foco com a preferência desligada: números e barra, como antes', async () => {
    desligarVisual();
    simular();
    const { container } = render(<App />);
    await irPara('Modo foco');
    await screen.findByRole('group', { name: 'Tamanho do bloco' });
    expect(container.querySelector('.focusdisc')).toBeNull();
    expect(container.querySelector('.progress')).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('10:00');
  });
  it('agenda: parte do dia com ícone e hora só como detalhe; bloco no lugar dos minutos', async () => {
    simular([
      {
        id: 'e1',
        titulo: 'Aula de Matemática',
        tipo: 'aula',
        origem: 'manual',
        dia: hoje,
        hora_inicio: '07:30',
        minutos: 50,
      },
      {
        id: 'e2',
        titulo: 'Estudar',
        tipo: 'estudo',
        origem: 'plano',
        dia: hoje,
        hora_inicio: '19:00',
        minutos: 25,
      },
      {
        id: 'e3',
        titulo: 'Sem hora',
        tipo: 'pessoal',
        origem: 'manual',
        dia: hoje,
        hora_inicio: null,
        minutos: null,
      },
    ]);
    const { container } = render(<App />);
    await irPara('Agenda');
    await screen.findByText('Aula de Matemática', { selector: '.event-title' });
    expect(screen.getByText('Manhã')).toBeTruthy();
    expect(screen.getByText('Noite')).toBeTruthy();
    expect(screen.getByText('07:30').tagName).toBe('SMALL');
    expect(screen.getByText(/Bloco longo \(50 min\)/)).toBeTruthy();
    expect(screen.getByText(/Bloco médio \(25 min\)/)).toBeTruthy();
    expect(container.querySelectorAll('.event-time.parte svg').length).toBe(2);
    expect(await violacoes(container)).toEqual([]);
  });
  it('agenda com a preferência desligada: só a hora, como antes', async () => {
    desligarVisual();
    simular([
      {
        id: 'e1',
        titulo: 'Aula de Matemática',
        tipo: 'aula',
        origem: 'manual',
        dia: hoje,
        hora_inicio: '07:30',
        minutos: 50,
      },
    ]);
    render(<App />);
    await irPara('Agenda');
    await screen.findByText('Aula de Matemática', { selector: '.event-title' });
    expect(screen.queryByText('Manhã')).toBeNull();
    expect(screen.getByText('07:30').className).toBe('event-time');
  });
});
