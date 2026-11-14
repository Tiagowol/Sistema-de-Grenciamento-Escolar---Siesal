// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Eu } from './api';
import { CodigoQr } from './componentes/CodigoQr';
import { Shell } from './componentes/Shell';
import { linkDeCadastro } from './linkCadastro';
import { Login } from './paginas/Login';

// 20c-1: a tela de entrada tem uma pergunta e duas opções; o menu do espaço individual não tem o que é da escola.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const semContraste = { rules: { 'color-contrast': { enabled: false } } };

describe('entrada com duas opções', () => {
  it('a pergunta e as duas opções, sem violação do axe; a primeira vem marcada', async () => {
    const { container } = render(<Login instituicaoPadrao="abc" aoEntrar={() => undefined} />);
    const grupo = screen.getByRole('group', { name: 'Como você usa o SIESAL?' });
    const [a, b] = within(grupo).getAllByRole('radio') as HTMLInputElement[];
    expect(a?.checked).toBe(true);
    expect(screen.getByRole('radio', { name: 'Vinculado a uma instituição' })).toBeTruthy();
    expect(b).toBe(screen.getByRole('radio', { name: 'Sem instituição' }));
    expect(screen.getByLabelText('Código da instituição')).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('"Sem instituição" esconde o código e envia só e-mail e senha', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ nivel: 'completo', usuario: { id: 'u', nome: 'A', perfil: 'aluno' } }),
          {
            status: 200,
          },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const aoEntrar = vi.fn();
    render(<Login instituicaoPadrao="abc" aoEntrar={aoEntrar} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('radio', { name: 'Sem instituição' }));
    expect(screen.queryByLabelText('Código da instituição')).toBeNull();
    await u.type(screen.getByLabelText('E-mail'), 'a@b.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'senha de teste');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(aoEntrar).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      sem_instituicao: true,
      email: 'a@b.exemplo',
      senha: 'senha de teste',
    });
  });

  it('"Vinculado" envia o código da instituição, como antes', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ nivel: 'completo', usuario: { id: 'u', nome: 'A', perfil: 'aluno' } }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<Login instituicaoPadrao="abc" aoEntrar={() => undefined} />);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('E-mail'), 'a@b.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'senha de teste');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ instituicao_id: 'abc' });
  });

  it('o erro é o mesmo texto literal, sem dizer qual dado falhou', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ erro: 'Credenciais inválidas ou conta temporariamente bloqueada.' }),
            { status: 401 },
          ),
      ),
    );
    render(<Login instituicaoPadrao={null} aoEntrar={() => undefined} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('radio', { name: 'Sem instituição' }));
    await u.type(screen.getByLabelText('E-mail'), 'a@b.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'x');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(
      await screen.findByText('Credenciais inválidas ou conta temporariamente bloqueada.'),
    ).toBeTruthy();
  });
});

describe('criar conta com convite', () => {
  it('o botão Criar conta só existe em "Sem instituição"; o formulário pede convite, nome, e-mail e senha', async () => {
    const { container } = render(<Login instituicaoPadrao="abc" aoEntrar={() => undefined} />);
    const u = userEvent.setup();
    expect(screen.queryByRole('button', { name: 'Criar conta' })).toBeNull();
    await u.click(screen.getByRole('radio', { name: 'Sem instituição' }));
    await u.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeTruthy();
    for (const r of ['Código do convite', 'Seu nome', 'E-mail', 'Senha'])
      expect(screen.getByLabelText(r), r).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await u.click(screen.getByRole('button', { name: 'Já tenho conta' }));
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeTruthy();
  });

  it('envia só os campos pedidos, entra com a resposta e mostra o erro literal quando recusa', async () => {
    const respostas = [
      new Response(
        JSON.stringify({
          erro: 'Não foi possível criar a conta. Confira os dados ou peça outro convite.',
        }),
        { status: 400 },
      ),
      new Response(
        JSON.stringify({ nivel: 'completo', usuario: { id: 'u', nome: 'Ana', perfil: 'aluno' } }),
        { status: 201 },
      ),
    ];
    const fetchMock = vi.fn(async () => respostas.shift() as Response);
    vi.stubGlobal('fetch', fetchMock);
    const aoEntrar = vi.fn();
    render(<Login instituicaoPadrao={null} aoEntrar={aoEntrar} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('radio', { name: 'Sem instituição' }));
    await u.click(screen.getByRole('button', { name: 'Criar conta' }));
    await u.type(screen.getByLabelText('Código do convite'), 'abcd-efgh-jklm-npqr');
    await u.type(screen.getByLabelText('Seu nome'), 'Ana');
    await u.type(screen.getByLabelText('Data de nascimento'), '2000-01-15');
    await u.type(screen.getByLabelText('E-mail'), 'ana@x.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'uma senha bem longa 1');
    await u.click(
      screen
        .getAllByRole('button', { name: 'Criar conta' })
        .find((b) => (b as HTMLButtonElement).type === 'submit') as HTMLElement,
    );
    expect(await screen.findByText(/Não foi possível criar a conta/)).toBeTruthy();
    await u.click(
      screen
        .getAllByRole('button', { name: 'Criar conta' })
        .find((b) => (b as HTMLButtonElement).type === 'submit') as HTMLElement,
    );
    await waitFor(() => expect(aoEntrar).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      codigo: 'abcd-efgh-jklm-npqr',
      nome: 'Ana',
      email: 'ana@x.exemplo',
      senha: 'uma senha bem longa 1',
      nascimento: '2000-01-15',
    });
  });
});

describe('menu do espaço individual', () => {
  const montar = (espaco: Eu['espaco']) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ itens: [], nao_vistos: 0 }), { status: 200 }),
      ),
    );
    const eu: Eu = {
      nivel: 'completo',
      usuario: { id: 'u', nome: 'Pessoa Fictícia', perfil: 'aluno' },
      espaco,
      modulos:
        espaco === 'individual'
          ? { mensagens: false, calendario: true, apoio_aluno: false }
          : { mensagens: true, calendario: true, apoio_aluno: true },
    };
    render(
      <Shell eu={eu} pagina="meudia" aoIr={() => undefined} aoSair={() => undefined}>
        <p>x</p>
      </Shell>,
    );
    return screen.getByRole('navigation', { name: 'Telas do sistema' });
  };

  it('sem Notas oficiais nem Avisos; com Meu dia, Atividades, Agenda, Calendário, Foco, Notas, Personalizar e Acessibilidade', () => {
    const nav = montar('individual');
    for (const nome of [
      'Meu dia',
      'Atividades',
      'Agenda',
      'Calendário',
      'Personalizar',
      'Modo foco',
      'Notas',
      'Acessibilidade',
      'Minha conta',
    ])
      expect(within(nav).getByRole('button', { name: new RegExp(`^${nome}`) }), nome).toBeTruthy();
    expect(within(nav).queryByRole('button', { name: /^Notas oficiais/ })).toBeNull();
    expect(within(nav).queryByRole('button', { name: /^Avisos/ })).toBeNull();
  });

  it('na escola, o aluno continua com Notas oficiais e Avisos', () => {
    const nav = montar('escola');
    expect(within(nav).getByRole('button', { name: /^Notas oficiais/ })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: /^Avisos/ })).toBeTruthy();
  });
});

describe('links de cadastro e QR code', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('o link do aluno abre "Sem instituição" > Criar conta com o código já preenchido e o tira do endereço', () => {
    window.history.replaceState(null, '', '/cadastro/aluno#ABCD-EFGH-JKLM-NPQR');
    render(<Login instituicaoPadrao="abc" aoEntrar={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeTruthy();
    expect((screen.getByLabelText('Código do convite') as HTMLInputElement).value).toBe(
      'ABCD-EFGH-JKLM-NPQR',
    );
    expect(
      (screen.getByRole('radio', { name: 'Sem instituição' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/cadastro/aluno');
  });

  it('em outro endereço o código do "#" é ignorado', () => {
    window.history.replaceState(null, '', '/outra#ABCD-EFGH-JKLM-NPQR');
    render(<Login instituicaoPadrao="abc" aoEntrar={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeTruthy();
    expect(window.location.hash).toBe('#ABCD-EFGH-JKLM-NPQR');
  });

  it('monta o link com o código depois do "#"', () => {
    const l = linkDeCadastro('aluno', 'ABCD-EFGH-JKLM-NPQR');
    expect(l).toBe(`${window.location.origin}/cadastro/aluno#ABCD-EFGH-JKLM-NPQR`);
    expect(linkDeCadastro('master', 'w1.XYZ')).toContain('/cadastro/master#');
  });

  it('o QR code é um SVG com texto alternativo e muda com o conteúdo', () => {
    const { container, rerender } = render(
      <CodigoQr texto="otpauth://totp/SIESAL:a?secret=ABC" rotulo="QR de teste" />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('QR de teste');
    const antes = container.querySelector('path')?.getAttribute('d');
    expect(antes && antes.length > 200).toBe(true);
    rerender(<CodigoQr texto="otpauth://totp/SIESAL:b?secret=XYZ" rotulo="QR de teste" />);
    expect(container.querySelector('path')?.getAttribute('d')).not.toBe(antes);
  });
});

describe('cadastro de instituição por link', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('/cadastro/instituicao#CODIGO abre o formulário do Admin novo, sem violação do axe', async () => {
    window.history.replaceState(null, '', '/cadastro/instituicao#ABCD-EFGH-JKLM-NPQR');
    const { container } = render(<Login instituicaoPadrao="abc" aoEntrar={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Cadastrar instituição' })).toBeTruthy();
    expect((screen.getByLabelText('Código do convite') as HTMLInputElement).value).toBe(
      'ABCD-EFGH-JKLM-NPQR',
    );
    for (const r of ['Nome da instituição', 'Seu nome', 'E-mail', 'Senha'])
      expect(screen.getByLabelText(r), r).toBeTruthy();
    expect(window.location.hash).toBe('');
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('envia os 5 campos e entra com a resposta (segundo fator pendente)', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            nivel: 'configurar_totp',
            usuario: { id: 'u', nome: 'Ana', perfil: 'admin' },
          }),
          { status: 201 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/cadastro/instituicao#ABCD-EFGH-JKLM-NPQR');
    const aoEntrar = vi.fn();
    render(<Login instituicaoPadrao={null} aoEntrar={aoEntrar} />);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Nome da instituição'), 'Escola Fictícia');
    await u.type(screen.getByLabelText('Seu nome'), 'Ana');
    await u.type(screen.getByLabelText('E-mail'), 'ana@x.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'uma senha bem longa 1');
    // L22c: sem aceitar o Termo 6 não envia
    await u.click(screen.getByRole('button', { name: 'Criar instituição' }));
    expect(
      await screen.findByText('Para criar a instituição, leia e aceite o termo.'),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await u.click(screen.getByLabelText(/Li e aceito este termo em nome da instituição/));
    await u.click(screen.getByRole('button', { name: 'Criar instituição' }));
    await waitFor(() => expect(aoEntrar).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/auth/criar-instituicao');
    expect(JSON.parse(String(init.body))).toEqual({
      codigo: 'ABCD-EFGH-JKLM-NPQR',
      instituicao: 'Escola Fictícia',
      nome: 'Ana',
      email: 'ana@x.exemplo',
      senha: 'uma senha bem longa 1',
      aceite_termo: true,
    });
  });

  it('mostra o erro literal quando o convite é recusado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              erro: 'Não foi possível criar a instituição. Confira os dados ou peça outro convite.',
            }),
            { status: 400 },
          ),
      ),
    );
    window.history.replaceState(null, '', '/cadastro/instituicao#ABCD-EFGH-JKLM-NPQR');
    render(<Login instituicaoPadrao={null} aoEntrar={() => undefined} />);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Nome da instituição'), 'Escola');
    await u.type(screen.getByLabelText('Seu nome'), 'Ana');
    await u.type(screen.getByLabelText('E-mail'), 'ana@x.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'uma senha bem longa 1');
    await u.click(screen.getByLabelText(/Li e aceito este termo em nome da instituição/));
    await u.click(screen.getByRole('button', { name: 'Criar instituição' }));
    expect(await screen.findByText(/Não foi possível criar a instituição/)).toBeTruthy();
  });
});
