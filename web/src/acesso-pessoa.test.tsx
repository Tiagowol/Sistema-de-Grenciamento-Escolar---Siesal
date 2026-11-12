// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcessoPessoa } from './paginas/AcessoPessoa';
import { ConfirmarEmail } from './paginas/ConfirmarEmail';

// L22a-1b: cadastro próprio, entrada da pessoa e escolha de espaço. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const semContraste = { rules: { 'color-contrast': { enabled: false } } };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const sem401 = () => json({ erro: 'Sessão inválida ou vencida.' }, 401);

describe('entrada, cadastro e escolha de espaço', () => {
  it('abre na entrada, sem violação do axe, com o cadastro a um clique', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sem401()));
    const { container } = render(<AcessoPessoa aoEntrar={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Entrar como professor ou pedagogo' })).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Criar cadastro' }));
    expect(screen.getByRole('heading', { name: 'Cadastro de professor e pedagogo' })).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('cadastro sem marcar o termo não envia nada', async () => {
    const f = vi.fn(async () => sem401());
    vi.stubGlobal('fetch', f);
    const u = userEvent.setup();
    render(<AcessoPessoa aoEntrar={() => undefined} />);
    await u.click(screen.getByRole('button', { name: 'Criar cadastro' }));
    await u.type(screen.getByLabelText('Seu nome'), 'Prof Teste');
    await u.type(screen.getByLabelText('E-mail'), 'prof@teste.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'senha de teste longa 123');
    const antes = f.mock.calls.length;
    await u.click(screen.getByRole('button', { name: 'Cadastrar' }));
    expect(screen.getByText('Para se cadastrar, marque a caixa do termo.')).toBeTruthy();
    expect(f.mock.calls.length).toBe(antes);
  });

  it('cadastro enviado mostra o aviso de e-mail com a mesma frase para qualquer e-mail', async () => {
    const f = vi.fn(async (url: string, _init?: RequestInit) =>
      String(url).endsWith('/auth/pessoa/cadastro')
        ? json({ mensagem: 'x' }, 202)
        : sem401(),
    );
    vi.stubGlobal('fetch', f);
    const u = userEvent.setup();
    render(<AcessoPessoa aoEntrar={() => undefined} />);
    await u.click(screen.getByRole('button', { name: 'Criar cadastro' }));
    await u.type(screen.getByLabelText('Seu nome'), 'Prof Teste');
    await u.type(screen.getByLabelText('E-mail'), 'prof@teste.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'senha de teste longa 123');
    await u.click(screen.getByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Cadastrar' }));
    expect(await screen.findByText(/Se o e-mail puder ser usado/)).toBeTruthy();
    const corpo = JSON.parse(
      String(f.mock.calls.find((c) => String(c[0]).endsWith('/auth/pessoa/cadastro'))?.[1]?.body),
    );
    expect(corpo).toMatchObject({ papel: 'professor', aceite: true });
  });

  it('pessoa sem espaço vê a explicação e nenhum botão de espaço; passa no axe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).endsWith('/auth/pessoa/eu')
          ? json({ pessoa: { nome: 'Prof Sozinho', email: 'p@p.exemplo' }, espacos: [] })
          : sem401(),
      ),
    );
    const { container } = render(<AcessoPessoa aoEntrar={() => undefined} />);
    expect(await screen.findByText(/Você ainda não participa de nenhum espaço/)).toBeTruthy();
    expect(screen.queryAllByRole('button').map((b) => b.textContent)).toEqual(['Sair']);
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('com espaços, mostra nome, papel e tipo; escolher um entra e entrega o Eu ao app', async () => {
    const eu = { usuario: { id: 'u1', nome: 'Prof', perfil: 'professor' } };
    const f = vi.fn(async (url: string, _init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/auth/pessoa/eu'))
        return json({
          pessoa: { nome: 'Prof Dois', email: 'p@p.exemplo' },
          espacos: [
            { instituicao_id: 'i1', nome: 'IFRN Canguaretama', tipo: 'escola', perfil: 'pedagogico' },
            { instituicao_id: 'i2', nome: 'Espaço individual', tipo: 'individual', perfil: 'professor' },
          ],
        });
      if (u.endsWith('/auth/pessoa/entrar')) return json(eu);
      if (u.endsWith('/auth/eu')) return json(eu);
      return sem401();
    });
    vi.stubGlobal('fetch', f);
    const aoEntrar = vi.fn();
    const u = userEvent.setup();
    render(<AcessoPessoa aoEntrar={aoEntrar} />);
    const b = await screen.findByRole('button', {
      name: 'IFRN Canguaretama — Pedagógico (Instituição)',
    });
    expect(screen.getByRole('button', { name: 'Espaço individual — Professor (Aluno isolado)' })).toBeTruthy();
    await u.click(b);
    await waitFor(() => expect(aoEntrar).toHaveBeenCalledWith(eu));
    const corpoEntrar = f.mock.calls.find((c) => String(c[0]).endsWith('/auth/pessoa/entrar'))?.[1]?.body;
    expect(JSON.parse(String(corpoEntrar))).toEqual({ instituicao_id: 'i1' });
  });
});

describe('representante legal e tipo do Pedagógico', () => {
  it('o cadastro oferece "Representante legal" com a declaração literal e o tipo de profissional só no Pedagógico; axe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sem401()));
    const u = userEvent.setup();
    const { container } = render(<AcessoPessoa aoEntrar={() => undefined} />);
    await u.click(screen.getByRole('button', { name: 'Criar cadastro' }));
    expect(screen.queryByLabelText('Tipo de profissional')).toBeNull();
    await u.click(screen.getByRole('radio', { name: 'Pedagógico, NAPNE ou área da saúde' }));
    expect(screen.getByLabelText('Tipo de profissional')).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await u.click(screen.getByRole('radio', { name: 'Representante legal de aluno menor' }));
    expect(screen.queryByLabelText('Tipo de profissional')).toBeNull();
    expect(screen.getByText(/O SIESAL não consegue conferir essa declaração/)).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('pedagógico envia o tipo escolhido no cadastro', async () => {
    const f = vi.fn(async (url: string, _init?: RequestInit) =>
      String(url).endsWith('/auth/pessoa/cadastro') ? json({ mensagem: 'x' }, 202) : sem401(),
    );
    vi.stubGlobal('fetch', f);
    const u = userEvent.setup();
    render(<AcessoPessoa aoEntrar={() => undefined} />);
    await u.click(screen.getByRole('button', { name: 'Criar cadastro' }));
    await u.type(screen.getByLabelText('Seu nome'), 'Fono Teste');
    await u.type(screen.getByLabelText('E-mail'), 'fono@teste.exemplo');
    await u.type(screen.getByLabelText('Senha'), 'senha de teste longa 123');
    await u.click(screen.getByRole('radio', { name: 'Pedagógico, NAPNE ou área da saúde' }));
    await u.selectOptions(screen.getByLabelText('Tipo de profissional'), 'fonoaudiologo');
    await u.click(screen.getByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Cadastrar' }));
    await screen.findByText(/Se o e-mail puder ser usado/);
    const chamada = f.mock.calls.find((c) => String(c[0]).endsWith('/auth/pessoa/cadastro'));
    expect(JSON.parse(String(chamada?.[1]?.body))).toMatchObject({
      papel: 'pedagogico',
      tipo_profissional: 'fonoaudiologo',
    });
  });

  it('a tela do espaço mostra quantos alunos e o botão de criar; no limite, a mensagem do suporte e sem botão', async () => {
    const eu = (alunos: number) =>
      json({
        pessoa: { nome: 'Rep Teste', email: 'r@r.exemplo' },
        espacos: [],
        representante: { alunos, limite: 5 },
      });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (String(url).endsWith('/auth/pessoa/eu') ? eu(2) : sem401())),
    );
    const { container } = render(<AcessoPessoa aoEntrar={() => undefined} />);
    expect(await screen.findByText('Alunos cadastrados por você: 2 de 5.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar conta de aluno menor' })).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    cleanup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (String(url).endsWith('/auth/pessoa/eu') ? eu(5) : sem401())),
    );
    render(<AcessoPessoa aoEntrar={() => undefined} />);
    expect(
      await screen.findByText('Você chegou ao limite de alunos. Entre em contato com o suporte.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Criar conta de aluno menor' })).toBeNull();
  });

  it('criar o aluno menor: sem a declaração não envia; com ela envia os dados e volta à lista', async () => {
    let alunos = 0;
    const f = vi.fn(async (url: string, _init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/auth/pessoa/eu'))
        return json({
          pessoa: { nome: 'Rep', email: 'r@r.exemplo' },
          espacos: [],
          representante: { alunos, limite: 5 },
        });
      if (u.endsWith('/auth/pessoa/aluno-menor')) {
        alunos = 1;
        return json({ criado: true, instituicao_id: 'i1' }, 201);
      }
      return sem401();
    });
    vi.stubGlobal('fetch', f);
    const u = userEvent.setup();
    const { container } = render(<AcessoPessoa aoEntrar={() => undefined} />);
    await u.click(await screen.findByRole('button', { name: 'Criar conta de aluno menor' }));
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await u.type(screen.getByLabelText('Código do convite'), 'ABCD-EFGH-JKLM');
    await u.type(screen.getByLabelText('Nome do aluno'), 'Aluno Teste');
    await u.type(screen.getByLabelText('E-mail do aluno'), 'aluno@teste.exemplo');
    await u.type(screen.getByLabelText('Data de nascimento do aluno'), '2015-03-10');
    await u.type(screen.getByLabelText('Senha provisória do aluno'), 'senha provisoria longa 456');
    await u.type(screen.getByLabelText('Sua data de nascimento'), '1985-06-20');
    await u.click(screen.getByRole('button', { name: 'Criar conta do aluno' }));
    expect(screen.getByText('Para criar a conta, marque a caixa da declaração.')).toBeTruthy();
    expect(f.mock.calls.some((c) => String(c[0]).endsWith('/auth/pessoa/aluno-menor'))).toBe(false);
    await u.click(screen.getByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Criar conta do aluno' }));
    expect(await screen.findByText(/Conta do aluno criada/)).toBeTruthy();
    const chamada = f.mock.calls.find((c) => String(c[0]).endsWith('/auth/pessoa/aluno-menor'));
    expect(JSON.parse(String(chamada?.[1]?.body))).toMatchObject({
      codigo: 'ABCD-EFGH-JKLM',
      aluno: { nome: 'Aluno Teste', nascimento: '2015-03-10' },
      representante_nascimento: '1985-06-20',
      aceite: true,
    });
    expect(screen.getByText('Alunos cadastrados por você: 1 de 5.')).toBeTruthy();
  });
});

describe('confirmar o e-mail', () => {
  it('link bom confirma; link ruim mostra sempre o mesmo aviso; passa no axe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ confirmado: true })));
    const bom = render(<ConfirmarEmail token={"t".repeat(30)} />);
    expect(await screen.findByText('E-mail confirmado. Agora você já pode entrar.')).toBeTruthy();
    expect((await axe.run(bom.container, semContraste)).violations).toEqual([]);
    cleanup();
    vi.stubGlobal('fetch', vi.fn(async () => json({ erro: 'x' }, 400)));
    render(<ConfirmarEmail token={"t".repeat(30)} />);
    expect(await screen.findByText(/Este link não vale mais/)).toBeTruthy();
  });
});
