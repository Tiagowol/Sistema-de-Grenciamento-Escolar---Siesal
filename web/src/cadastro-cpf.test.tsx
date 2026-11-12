// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmarResponsavel } from './paginas/ConfirmarResponsavel';
import { ehMenor, Login } from './paginas/Login';

// 20c-2: cadastro com data de nascimento e CPF opcional; menor de 18 anos informa o responsável e fica aguardando;
// o responsável abre o link, lê o termo e confirma com as 3 caixas. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});
const semContraste = { rules: { 'color-contrast': { enabled: false } } };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

describe('idade pela data de nascimento', () => {
  const hoje = new Date(2026, 10, 12);
  it('menor de 18 anos só até o dia anterior ao aniversário', () => {
    expect(ehMenor('2008-11-13', hoje)).toBe(true);
    expect(ehMenor('2008-11-12', hoje)).toBe(false);
    expect(ehMenor('2000-01-15', hoje)).toBe(false);
  });
  it('data incompleta ou antiga demais não conta como menor', () => {
    expect(ehMenor('', hoje)).toBe(false);
    expect(ehMenor('2010-1', hoje)).toBe(false);
    expect(ehMenor('1800-01-01', hoje)).toBe(false);
  });
});

async function abrirCriarConta() {
  window.history.replaceState(null, '', '/cadastro/aluno#ABCD-EFGH-JKLM-NPQR');
  const r = render(<Login instituicaoPadrao={null} aoEntrar={() => undefined} />);
  return { ...r, u: userEvent.setup() };
}

describe('criar conta com data de nascimento', () => {
  it('maior de 18: CPF é opcional e não pede responsável; sem violação do axe', async () => {
    const { container, u } = await abrirCriarConta();
    expect(screen.getByLabelText('CPF (opcional)')).toBeTruthy();
    expect(screen.getByLabelText('Matrícula (opcional)')).toBeTruthy();
    expect(screen.getByLabelText('Escola ou escolas (opcional)')).toBeTruthy();
    await u.type(screen.getByLabelText('Data de nascimento'), '2000-01-15');
    expect(screen.queryByText('Dados do responsável')).toBeNull();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('menor de 18: aparecem os dados do responsável e a tela passa no axe', async () => {
    const { container, u } = await abrirCriarConta();
    await u.type(screen.getByLabelText('Data de nascimento'), '2015-03-10');
    expect(screen.getByRole('group', { name: 'Dados do responsável' })).toBeTruthy();
    for (const r of [
      'Nome do responsável',
      'CPF do responsável',
      'Data de nascimento do responsável',
      'E-mail do responsável',
    ])
      expect(screen.getByLabelText(r), r).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('menor sem os dados do responsável não envia nada', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { u } = await abrirCriarConta();
    await u.type(screen.getByLabelText('Seu nome'), 'Ana');
    await u.type(screen.getByLabelText('Data de nascimento'), '2015-03-10');
    await u.type(screen.getByLabelText('E-mail'), 'ana@x.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'uma senha bem longa 1');
    await u.click(
      screen
        .getAllByRole('button', { name: 'Criar conta' })
        .find((b) => (b as HTMLButtonElement).type === 'submit') as HTMLElement,
    );
    expect(await screen.findByText(/precisa informar o nome, o CPF/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('menor com responsável: envia os dados e mostra "falta a autorização", com prazo em palavra, data e blocos', async () => {
    const expira = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const fetchMock = vi.fn(async () =>
      json({ aguardando_responsavel: true, email_enviado: true, expira_em: expira }, 202),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { container, u } = await abrirCriarConta();
    await u.type(screen.getByLabelText('Seu nome'), 'Ana');
    await u.type(screen.getByLabelText('Data de nascimento'), '2015-03-10');
    await u.type(screen.getByLabelText('E-mail'), 'ana@x.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'uma senha bem longa 1');
    await u.type(screen.getByLabelText('Nome do responsável'), 'Beatriz');
    await u.type(screen.getByLabelText('CPF do responsável'), '111.444.777-35');
    await u.type(screen.getByLabelText('Data de nascimento do responsável'), '1980-05-20');
    await u.type(screen.getByLabelText('E-mail do responsável'), 'bia@x.exemplo');
    await u.click(
      screen
        .getAllByRole('button', { name: 'Criar conta' })
        .find((b) => (b as HTMLButtonElement).type === 'submit') as HTMLElement,
    );
    expect(
      await screen.findByRole('heading', { name: 'Falta a autorização do responsável' }),
    ).toBeTruthy();
    expect(screen.getByText(/ainda não pode entrar/)).toBeTruthy();
    expect(screen.getByText(/em 7 dias/)).toBeTruthy();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      nascimento: '2015-03-10',
      responsavel: { nome: 'Beatriz', cpf: '111.444.777-35', nascimento: '1980-05-20' },
    });
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });
});

describe('link do responsável', () => {
  const pedido = {
    aluno: 'Ana',
    responsavel: 'Beatriz',
    expiraEm: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    termo: {
      versao: '1',
      caixas: [
        'Sou o responsável legal por Ana.',
        'Autorizo o uso do SIESAL por ele e o tratamento dos dados descritos na Política de Privacidade.',
        'Declaro que os dados informados são verdadeiros.',
      ],
    },
  };
  const token = 'T'.repeat(43);

  it('o link na barra de endereço abre a tela do responsável e some do endereço', () => {
    window.history.replaceState(null, '', `/confirmar/responsavel#${token}`);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(pedido)),
    );
    render(<Login instituicaoPadrao={null} aoEntrar={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Autorização do responsável' })).toBeTruthy();
    expect(window.location.hash).toBe('');
  });

  it('mostra o termo com 3 caixas, exige as 3 e confirma; sem violação do axe', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/consultar') ? json(pedido) : json({ confirmado: true }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<ConfirmarResponsavel token={token} />);
    const u = userEvent.setup();
    const caixas = await screen.findAllByRole('checkbox');
    expect(caixas).toHaveLength(3);
    expect(screen.getByText('Sou o responsável legal por Ana.')).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);

    await u.click(caixas[0] as HTMLElement);
    await u.click(screen.getByRole('button', { name: 'Confirmar autorização' }));
    expect(await screen.findByText('Para confirmar, marque as 3 caixas.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await u.click(caixas[1] as HTMLElement);
    await u.click(caixas[2] as HTMLElement);
    await u.click(screen.getByRole('button', { name: 'Confirmar autorização' }));
    expect(await screen.findByText(/Autorização confirmada/)).toBeTruthy();
    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ token, aceites: [true, true, true] });
  });

  it('link inválido, vencido ou usado mostra sempre o mesmo aviso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ erro: 'Este link não vale mais.' }, 404)),
    );
    render(<ConfirmarResponsavel token={token} />);
    await waitFor(() => expect(screen.getByText(/Este link não vale mais/)).toBeTruthy());
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
