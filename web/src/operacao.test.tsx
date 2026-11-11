// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Operacao } from './paginas/Operacao';

// L18 e L20: entrada dos Masters (/operacao): entrar, primeiro acesso, TOTP e painel de instituições. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TRILHA = {
  integra: true,
  eventos: [
    {
      seq: 1,
      ator: 'master:master_um',
      acao: 'instituicao.criada',
      alvo: 'instituicao:i1',
      criado_em: '2026-11-10T12:00:00.000Z',
    },
  ],
};
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
    modulos: { mensagens: true, calendario: true, apoio_aluno: true },
    contagem: { admin: 1, professor: 3, aluno: 20 },
  },
  {
    id: 'i2',
    nome: 'Escola B (fictícia)',
    situacao: 'suspensa',
    criado_em: '2026-11-09T12:00:00.000Z',
    modulos: { mensagens: true, calendario: false, apoio_aluno: true },
    contagem: {},
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
      'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
      'GET /operacao/convites-individuais': { corpo: { pendentes: 1, usados: 0, vencidos: 0 } },
      'GET /operacao/auditoria': { corpo: TRILHA },
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

  it('painel lista e cria; mostra situação, números por perfil e a trilha; axe sem violações', async () => {
    const chamadas = simular({
      'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
      'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
      'GET /operacao/convites-individuais': { corpo: { pendentes: 1, usados: 0, vencidos: 0 } },
      'GET /operacao/auditoria': { corpo: TRILHA },
      'POST /operacao/instituicoes': { status: 201, corpo: { instituicao: instituicoes[0] } },
    });
    const { container } = render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    expect(screen.getByText(/Criada em 10\/11\/2026\./)).toBeTruthy();
    expect(
      screen.getByText(/1 Admin, 3 professores, 20 alunos, 0 Pedagógico, 0 responsáveis/),
    ).toBeTruthy();
    expect(screen.getByText('A trilha está íntegra: nenhum registro foi alterado.')).toBeTruthy();
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
  });

  it('L20: muda a situação; encerrar pede o nome escrito; liga e desliga módulo', async () => {
    const chamadas = simular({
      'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
      'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
      'GET /operacao/convites-individuais': { corpo: { pendentes: 1, usados: 0, vencidos: 0 } },
      'GET /operacao/auditoria': { corpo: TRILHA },
      'POST /operacao/instituicoes/i1/situacao': { status: 204 },
      'POST /operacao/instituicoes/i2/modulos': { status: 204 },
    });
    render(<Operacao />);
    const u = userEvent.setup();
    const select = await screen.findByLabelText('Nova situação de Escola A (fictícia)');
    const mudar = screen.getByRole('button', { name: /Mudar a situação\s*de Escola A/ });
    expect((mudar as HTMLButtonElement).disabled).toBe(true);
    await u.selectOptions(select, 'Suspensa');
    await u.click(mudar);
    await waitFor(() =>
      expect(chamadas.find((c) => c.url === '/operacao/instituicoes/i1/situacao')?.corpo).toEqual({
        situacao: 'suspensa',
      }),
    );
    await u.selectOptions(
      screen.getByLabelText('Nova situação de Escola A (fictícia)'),
      'Encerrada',
    );
    await u.type(
      screen.getByLabelText('Para encerrar, escreva o nome da instituição'),
      'Escola A (fictícia)',
    );
    await u.click(screen.getByRole('button', { name: /Mudar a situação\s*de Escola A/ }));
    await waitFor(() =>
      expect(
        chamadas.filter((c) => c.url === '/operacao/instituicoes/i1/situacao').at(-1)?.corpo,
      ).toEqual({ situacao: 'encerrada', confirmar_nome: 'Escola A (fictícia)' }),
    );
    const modulos = screen.getByRole('group', { name: /Módulos\s*de Escola B/ });
    const calendario = within(modulos).getByRole('switch', { name: 'Calendário' });
    expect((calendario as HTMLInputElement).checked).toBe(false);
    await u.click(calendario);
    await waitFor(() =>
      expect(chamadas.find((c) => c.url === '/operacao/instituicoes/i2/modulos')?.corpo).toEqual({
        modulo: 'calendario',
        ligado: true,
      }),
    );
  });

  it('sair volta para o login', async () => {
    simular({
      'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
      'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
      'GET /operacao/convites-individuais': { corpo: { pendentes: 1, usados: 0, vencidos: 0 } },
      'GET /operacao/auditoria': { corpo: TRILHA },
      'POST /operacao/logout': { status: 204 },
    });
    render(<Operacao />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sair' }));
    await screen.findByRole('heading', { name: 'Entrar na operação' });
  });
});
