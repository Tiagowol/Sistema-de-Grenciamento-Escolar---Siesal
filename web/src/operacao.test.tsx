// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Operacao } from './paginas/Operacao';

// L18: entrada dos Masters (/operacao): entrar, primeiro acesso, TOTP e painel de instituições. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const semContraste = { rules: { 'color-contrast': { enabled: false } } };
type Rota = { status?: number; corpo?: unknown };

function simular(rotas: Record<string, Rota>) {
  const chamadas: { metodo: string; url: string; corpo: unknown }[] = [];
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
      const r = rotas[`${metodo} ${caminho}`] ?? {
        status: 401,
        corpo: { erro: 'Sessão inválida ou vencida.' },
      };
      return new Response(r.status === 204 ? null : JSON.stringify(r.corpo ?? {}), {
        status: r.status ?? 200,
      });
    }),
  );
  return chamadas;
}

const instituicoes = [
  {
    id: 'i1',
    nome: 'Escola A (fictícia)',
    situacao: 'ativa',
    criado_em: '2026-11-10T12:00:00.000Z',
  },
  {
    id: 'i2',
    nome: 'Escola B (fictícia)',
    situacao: 'suspensa',
    criado_em: '2026-11-09T12:00:00.000Z',
  },
];

describe('tela /operacao', () => {
  it('sem sessão mostra o login do Master, com rótulos e sem violações do axe', async () => {
    simular({});
    const { container } = render(<Operacao />);
    await screen.findByRole('heading', { name: 'Entrar na operação' });
    for (const rotulo of ['Usuário', 'Senha', 'Código do aplicativo de autenticação'])
      expect(screen.getByLabelText(rotulo)).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('entrar exige o código de 6 números e envia usuário, senha e código', async () => {
    const chamadas = simular({
      'POST /operacao/login': { corpo: { nivel: 'completo', usuario: 'master_um' } },
      'GET /operacao/instituicoes': { corpo: { instituicoes } },
    });
    render(<Operacao />);
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Usuário'), 'master_um');
    await u.type(screen.getByLabelText('Senha'), 'senha-ficticia');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/Escreva o código de 6 números/)).toBeTruthy();
    expect(chamadas.some((c) => c.url === '/operacao/login')).toBe(false);
    await u.type(screen.getByLabelText('Código do aplicativo de autenticação'), '123456');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Instituições' });
    expect(chamadas.find((c) => c.url === '/operacao/login')?.corpo).toEqual({
      usuario: 'master_um',
      senha: 'senha-ficticia',
      codigo: '123456',
    });
  });

  it('primeiro acesso pede convite e senha nova e leva ao segundo fator', async () => {
    const chamadas = simular({
      'POST /operacao/primeiro-acesso': {
        corpo: { nivel: 'configurar_totp', usuario: 'master_um' },
      },
      'POST /operacao/totp/iniciar': {
        corpo: { segredo: 'CHAVEFICTICIA', uri: 'otpauth://totp/x' },
      },
    });
    const { container } = render(<Operacao />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Primeiro acesso: tenho um convite' }));
    expect(screen.queryByLabelText('Código do aplicativo de autenticação')).toBeNull();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await u.type(screen.getByLabelText('Usuário'), 'master_um');
    await u.type(screen.getByLabelText('Convite'), 'AAAA-BBBB');
    await u.type(screen.getByLabelText('Senha nova'), 'senha ficticia longa');
    await u.click(screen.getByRole('button', { name: 'Definir a senha' }));
    await screen.findByRole('heading', { name: 'Ative o segundo fator' });
    await screen.findByText('CHAVEFICTICIA');
    expect(chamadas.find((c) => c.url === '/operacao/primeiro-acesso')?.corpo).toEqual({
      usuario: 'master_um',
      convite: 'AAAA-BBBB',
      senha_nova: 'senha ficticia longa',
    });
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('painel lista, cria, suspende e reativa; sem violações do axe', async () => {
    const chamadas = simular({
      'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
      'GET /operacao/instituicoes': { corpo: { instituicoes } },
      'POST /operacao/instituicoes': { status: 201, corpo: { instituicao: instituicoes[0] } },
      'POST /operacao/instituicoes/i1/suspender': { status: 204 },
      'POST /operacao/instituicoes/i2/reativar': { status: 204 },
    });
    const { container } = render(<Operacao />);
    await screen.findByRole('button', { name: /Suspender\s*Escola A/ });
    expect(screen.getByText(/Situação: ativa\. Criada em 10\/11\/2026\./)).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByText('Escreva o nome da instituição.')).toBeTruthy();
    await u.type(screen.getByLabelText('Nome da instituição'), 'Escola C (fictícia)');
    await u.click(screen.getByRole('button', { name: 'Criar' }));
    await screen.findByText('Instituição criada.');
    expect(
      chamadas.find((c) => c.metodo === 'POST' && c.url === '/operacao/instituicoes')?.corpo,
    ).toEqual({ nome: 'Escola C (fictícia)' });
    await u.click(screen.getByRole('button', { name: /Suspender\s*Escola A/ }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.url === '/operacao/instituicoes/i1/suspender')).toBe(true),
    );
    await u.click(screen.getByRole('button', { name: /Reativar\s*Escola B/ }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.url === '/operacao/instituicoes/i2/reativar')).toBe(true),
    );
  });

  it('sair volta para o login', async () => {
    simular({
      'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
      'GET /operacao/instituicoes': { corpo: { instituicoes } },
      'POST /operacao/logout': { status: 204 },
    });
    render(<Operacao />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sair' }));
    await screen.findByRole('heading', { name: 'Entrar na operação' });
  });
});
