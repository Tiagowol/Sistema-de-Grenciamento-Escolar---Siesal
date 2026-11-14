// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Perfil } from './api';
import { PrimeirosPassos, topicosDosPrimeirosPassos } from './componentes/PrimeirosPassos';
import { Usuarios } from './paginas/Usuarios';

// L22c: Admin desativa e reativa (com confirmação em texto) e "Primeiros passos" no primeiro acesso. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
beforeEach(() => localStorage.clear());
const semContraste = { rules: { 'color-contrast': { enabled: false } } };

type Chamada = { metodo: string; url: string };
function simular(
  usuarios: unknown[],
  extra: Record<string, { status?: number; corpo?: unknown }> = {},
) {
  const chamadas: Chamada[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      const caminho = url.replace('/api', '');
      chamadas.push({ metodo, url: caminho });
      if (metodo === 'GET' && caminho === '/usuarios')
        return new Response(JSON.stringify({ usuarios }), { status: 200 });
      const r = extra[`${metodo} ${caminho}`] ?? { status: 204 };
      return new Response(r.status === 204 ? null : JSON.stringify(r.corpo ?? {}), {
        status: r.status ?? 200,
      });
    }),
  );
  return chamadas;
}
const gente = [
  {
    id: 'a1',
    perfil: 'professor',
    nome: 'Professora Fictícia',
    email: 'p@x.exemplo',
    situacao: 'ativo',
    senhaProvisoria: false,
  },
  {
    id: 'a2',
    perfil: 'aluno',
    nome: 'Aluno Desativado',
    email: 'd@x.exemplo',
    situacao: 'inativo',
    senhaProvisoria: false,
  },
  {
    id: 'a3',
    perfil: 'aluno',
    nome: 'Aluno Espera',
    email: 'e@x.exemplo',
    situacao: 'aguardando_responsavel',
    senhaProvisoria: false,
  },
];

describe('Usuários: desativar e reativar (L22c)', () => {
  it('desativar pede confirmação em texto e só então chama a API; mostra a situação em palavra', async () => {
    const chamadas = simular(gente);
    const { container } = render(<Usuarios />);
    await screen.findByRole('cell', { name: 'Professora Fictícia' });
    expect(screen.getByText('Desativada')).toBeTruthy();
    expect(screen.getByText('Espera o responsável')).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /^Desativar Professora Fictícia/ }));
    expect(screen.getByText(/A pessoa deixa de entrar\. Nada é apagado\./)).toBeTruthy();
    expect(chamadas.some((c) => c.url.includes('/desativar'))).toBe(false);
    await u.click(screen.getByRole('button', { name: 'Sim, desativar' }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.url === '/usuarios/a1/desativar')).toBe(true),
    );
    expect(await screen.findByText('A conta de Professora Fictícia foi desativada.')).toBeTruthy();
  });

  it('"Não" cancela; conta desativada tem Reativar; quem espera o responsável não tem botão', async () => {
    const chamadas = simular(gente);
    render(<Usuarios />);
    await screen.findByRole('cell', { name: 'Professora Fictícia' });
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /^Desativar Professora Fictícia/ }));
    await u.click(screen.getByRole('button', { name: 'Não' }));
    expect(screen.queryByRole('button', { name: 'Sim, desativar' })).toBeNull();
    expect(chamadas.some((c) => c.url.includes('/desativar'))).toBe(false);
    expect(screen.queryByRole('button', { name: /Desativar Aluno Espera/ })).toBeNull();
    await u.click(screen.getByRole('button', { name: /^Reativar Aluno Desativado/ }));
    await waitFor(() => expect(chamadas.some((c) => c.url === '/usuarios/a2/reativar')).toBe(true));
    expect(await screen.findByText('A conta de Aluno Desativado foi reativada.')).toBeTruthy();
  });

  it('mostra a mensagem da API quando não pode desativar (a própria conta)', async () => {
    simular(gente, {
      'POST /usuarios/a1/desativar': {
        status: 409,
        corpo: { erro: 'Você não pode desativar a sua própria conta.' },
      },
    });
    render(<Usuarios />);
    await screen.findByRole('cell', { name: 'Professora Fictícia' });
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /^Desativar Professora Fictícia/ }));
    await u.click(screen.getByRole('button', { name: 'Sim, desativar' }));
    expect(await screen.findByText('Você não pode desativar a sua própria conta.')).toBeTruthy();
  });
});

describe('Primeiros passos (L22c)', () => {
  const perfis: Perfil[] = ['aluno', 'professor', 'pedagogico', 'admin', 'responsavel'];
  it.each([...perfis, 'master'])(
    '%s: no máximo 5 tópicos, só do manual do próprio perfil',
    (perfil) => {
      const t = topicosDosPrimeirosPassos(perfil);
      expect(t.length).toBeGreaterThan(0);
      expect(t.length).toBeLessThanOrEqual(5);
      for (const x of t) expect(x.perfis.length === 0 || x.perfis.includes(perfil)).toBe(true);
    },
  );

  it('aparece uma vez por perfil, some ao fechar e fica fechado neste aparelho', async () => {
    const aoIr = vi.fn();
    const { container, unmount } = render(<PrimeirosPassos perfil="professor" aoIr={aoIr} />);
    expect(screen.getByRole('heading', { name: 'Primeiros passos' })).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ver o passo a passo na Ajuda' }));
    expect(aoIr).toHaveBeenCalledWith('ajuda');
    await u.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('heading', { name: 'Primeiros passos' })).toBeNull();
    unmount();
    render(<PrimeirosPassos perfil="professor" aoIr={aoIr} />);
    expect(screen.queryByRole('heading', { name: 'Primeiros passos' })).toBeNull();
    // Outro perfil neste aparelho ainda vê o seu
    cleanup();
    render(<PrimeirosPassos perfil="admin" aoIr={aoIr} />);
    expect(screen.getByRole('heading', { name: 'Primeiros passos' })).toBeTruthy();
  });

  it('sem armazenamento (bloqueado) ainda mostra e fecha nesta visita', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    render(<PrimeirosPassos perfil="aluno" aoIr={() => undefined} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('heading', { name: 'Primeiros passos' })).toBeNull();
  });
});
