// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { Acessibilidade } from './paginas/Acessibilidade';
import { Login } from './paginas/Login';
import { PREFERENCIAS_PADRAO } from './preferencias';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Roda o axe-core e devolve só as violações (sem contraste: jsdom não calcula cores)
async function violacoes(no: Element) {
  const r = await axe.run(no, { rules: { 'color-contrast': { enabled: false } } });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`);
}

function responder(rotas: Record<string, { status?: number; corpo?: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const r = rotas[url.replace('/api', '')] ?? { status: 404, corpo: { erro: 'não achei' } };
      return new Response(r.status === 204 ? null : JSON.stringify(r.corpo ?? {}), {
        status: r.status ?? 200,
      });
    }),
  );
}

describe('telas', () => {
  it('login sem violações de acessibilidade e com rótulos', async () => {
    const { container } = render(<Login instituicaoPadrao={null} aoEntrar={() => undefined} />);
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(await violacoes(container)).toEqual([]);
  });

  it('login esconde o código da instituição quando há padrão', () => {
    render(<Login instituicaoPadrao="abc" aoEntrar={() => undefined} />);
    expect(screen.queryByLabelText('Código da instituição')).toBeNull();
  });

  it('acessibilidade: chaves ligam e desligam e não têm violações', async () => {
    const aoMudar = vi.fn();
    const { container } = render(<Acessibilidade valor={PREFERENCIAS_PADRAO} aoMudar={aoMudar} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Tema escuro' }));
    expect(aoMudar).toHaveBeenCalledWith({ ...PREFERENCIAS_PADRAO, escuro: true });
    expect(await violacoes(container)).toEqual([]);
  });

  it('acessibilidade: clicar no texto do rótulo liga a chave (Lote 12, defeito 5)', async () => {
    const aoMudar = vi.fn();
    render(<Acessibilidade valor={PREFERENCIAS_PADRAO} aoMudar={aoMudar} />);
    await userEvent.click(screen.getByText('Alto contraste'));
    expect(aoMudar).toHaveBeenCalledWith({ ...PREFERENCIAS_PADRAO, contraste: true });
  });

  it('login: a marca usa a classe de página clara (Lote 12, defeito 1)', () => {
    const { container } = render(<Login instituicaoPadrao={null} aoEntrar={() => undefined} />);
    expect(container.querySelector('.brand.brand-login')).not.toBeNull();
  });

  it('sem sessão mostra o login; com sessão mostra o menu e o nome', async () => {
    responder({
      '/config': { corpo: { instituicao_padrao: null, modo_local: true } },
      '/auth/eu': { status: 401, corpo: { erro: 'x' } },
    });
    const { unmount } = render(<App />);
    await screen.findByRole('heading', { name: 'Entrar' });
    unmount();

    responder({
      '/config': { corpo: { instituicao_padrao: null, modo_local: true } },
      '/auth/eu': {
        corpo: { nivel: 'completo', usuario: { id: '1', nome: 'Ana Souza', perfil: 'aluno' } },
      },
    });
    const { container } = render(<App />);
    await screen.findByText('Ana Souza');
    expect(screen.queryByRole('button', { name: 'Usuários' })).toBeNull();
    await waitFor(async () => expect(await violacoes(container)).toEqual([]));
  });

  it('administrador vê Usuários; senha provisória pendente pede a troca', async () => {
    responder({
      '/config': { corpo: { instituicao_padrao: null, modo_local: true } },
      '/auth/eu': {
        corpo: {
          nivel: 'trocar_senha',
          usuario: { id: '2', nome: 'Admin Teste', perfil: 'admin' },
        },
      },
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Crie sua senha' });
    expect(screen.getByRole('button', { name: 'Usuários' })).toBeTruthy();
  });
});
