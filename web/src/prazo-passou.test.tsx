// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

// L16d (F-040): prazo que passou não usa vermelho de alarme nem a palavra "Atrasada" como alerta
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const aluno = { nivel: 'completo', usuario: { id: '1', nome: 'Alex Souza', perfil: 'aluno' } };
const velha = {
  id: 't9',
  titulo: 'Lista de exercícios',
  descricao: '',
  disciplina: 'Matemática',
  tipo: 'tarefa',
  prazo: '2020-01-10',
  prioridade: 'media',
  situacao: 'pendente',
  microetapas: [],
};
const rotas: Record<string, unknown> = {
  'GET /config': { instituicao_padrao: 'x', modo_local: true },
  'GET /auth/eu': aluno,
  'GET /meu-dia': {
    hoje: '2026-11-10',
    atrasadas: [{ ...velha, etapas: 0, etapas_feitas: 0 }],
    para_hoje: [],
    proximas: [],
    eventos: [],
    minutos_estudados_hoje: 0,
    sessao_atual: null,
    tarefas_concluidas: 0,
    tarefas_total: 1,
  },
  'GET /tarefas': { tarefas: [velha] },
  'GET /sessoes/atual': { sessao: null },
  'GET /caixa': { itens: [], nao_vistos: 0 },
};

function simular() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const chave = `${init?.method ?? 'GET'} ${url.replace('/api', '').split('?')[0]}`;
      const corpo = rotas[chave];
      return corpo === undefined
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(corpo));
    }),
  );
}

const semAlarme = (no: Element) => {
  expect(no.querySelector('.t-red')).toBeNull();
  expect(no.textContent).not.toMatch(/atrasad/i);
};

describe('prazo que passou, sem vermelho nem "atrasada"', () => {
  it('Meu dia: etiqueta, cartão e ícone usam cor calma e a frase "Prazo passou"', async () => {
    simular();
    const { container } = render(<App />);
    await screen.findAllByText('Lista de exercícios');
    expect(screen.getAllByText('Prazo passou').length).toBeGreaterThanOrEqual(2);
    semAlarme(container);
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it('Atividades: etiqueta e filtro usam "Prazo passou" e nenhuma classe vermelha', async () => {
    simular();
    const { container } = render(<App />);
    await screen.findByRole('navigation');
    await userEvent.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: /^Atividades/ }),
    );
    await screen.findAllByText('Lista de exercícios');
    expect(screen.getByRole('button', { name: /Prazo passou/ })).toBeTruthy();
    semAlarme(container);
  });
});
