// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Evento } from './api';
import { paraTexto, somarDias } from './datas';
import { andar, Calendario, intervalo } from './paginas/Calendario';

// L17a: calendário do aluno (dia, semana, mês, ano), criação, edição, ocultação. Dados fictícios.
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const semContraste = { rules: { 'color-contrast': { enabled: false } } };
const hoje = paraTexto(new Date());
const evento = (o: Partial<Evento>): Evento => ({
  id: 'e1',
  titulo: 'Prova de Ciências',
  tipo: 'prova',
  origem: 'manual',
  dia: hoje,
  hora_inicio: '08:00',
  minutos: null,
  ...o,
});

function simular(eventos: Evento[]) {
  const chamadas: { metodo: string; url: string; corpo: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      chamadas.push({
        metodo,
        url: url.replace('/api', ''),
        corpo: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (metodo === 'GET') return new Response(JSON.stringify({ eventos }), { status: 200 });
      if (metodo === 'POST' && url.endsWith('/ocultar')) return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ evento: eventos[0] }), { status: 201 });
    }),
  );
  return chamadas;
}

describe('intervalos e navegação do calendário', () => {
  it('cada visão carrega só o que mostra', () => {
    expect(intervalo('dia', '2026-11-10')).toEqual(['2026-11-10', '2026-11-10']);
    expect(intervalo('semana', '2026-11-10')).toEqual(['2026-11-09', '2026-11-15']);
    expect(intervalo('mes', '2026-11-10')).toEqual(['2026-10-26', '2026-12-06']);
    expect(intervalo('ano', '2026-11-10')).toEqual(['2026-01-01', '2026-12-31']);
  });
  it('anda uma unidade da visão', () => {
    expect(andar('dia', '2026-11-10', 1)).toBe('2026-11-11');
    expect(andar('semana', '2026-11-10', -1)).toBe('2026-11-03');
    expect(andar('mes', '2026-01-31', 1)).toBe('2026-02-01');
    expect(andar('ano', '2026-11-10', 1)).toBe('2027-11-10');
  });
});

describe('tela Calendário', () => {
  it('mostra as 4 visões, anuncia a visão ativa e não tem violações do axe', async () => {
    simular([evento({})]);
    const { container } = render(<Calendario />);
    for (const nome of ['Dia', 'Semana', 'Mês', 'Ano'])
      expect(screen.getByRole('button', { name: nome })).toBeTruthy();
    await screen.findAllByText('Prova de Ciências');
    const usuario = userEvent.setup();
    for (const nome of ['Dia', 'Semana', 'Ano', 'Mês']) {
      await usuario.click(screen.getByRole('button', { name: nome }));
      expect(screen.getByRole('button', { name: nome }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('status').textContent).toContain(`Visão ${nome.toLowerCase()}`);
    }
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('o tempo é concreto: palavra, data e quadrados', async () => {
    simular([evento({ dia: somarDias(hoje, 1) })]);
    render(<Calendario />);
    await usuario().click(screen.getByRole('button', { name: 'Semana' }));
    await waitFor(() => expect(screen.getAllByText('amanhã').length).toBeGreaterThan(0));
  });

  it('evento importado só pode ser ocultado, nunca editado nem removido', async () => {
    const chamadas = simular([
      evento({ id: 'g1', origem: 'google_agenda', titulo: 'Aula Google' }),
    ]);
    render(<Calendario />);
    await usuario().click(screen.getByRole('button', { name: 'Dia' }));
    await screen.findAllByText('Aula Google');
    expect(screen.getByText('do Google Agenda')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull();
    await usuario().click(screen.getByRole('button', { name: /Ocultar/ }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.metodo === 'POST' && c.url === '/eventos/g1/ocultar')).toBe(
        true,
      ),
    );
  });

  it('cria e edita entrada própria pelo teclado', async () => {
    const chamadas = simular([evento({})]);
    render(<Calendario />);
    const u = usuario();
    await u.click(screen.getByRole('button', { name: 'Dia' }));
    await screen.findAllByText('Prova de Ciências');
    await u.click(screen.getByRole('button', { name: /Editar/ }));
    expect(screen.getByRole('heading', { name: 'Editar entrada' })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Médio (25 min)' }));
    await u.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(true));
    const patch = chamadas.find((c) => c.metodo === 'PATCH') as {
      url: string;
      corpo: { minutos: number };
    };
    expect(patch.url).toBe('/eventos/e1');
    expect(patch.corpo.minutos).toBe(25);
  });

  it('recusa nome vazio com mensagem literal', async () => {
    simular([]);
    render(<Calendario />);
    await usuario().click(screen.getByRole('button', { name: 'Salvar entrada' }));
    expect(await screen.findByText('Escreva o nome da entrada.')).toBeTruthy();
  });
});

function usuario() {
  return userEvent.setup();
}
