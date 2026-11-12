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
