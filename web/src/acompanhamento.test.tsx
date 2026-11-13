// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AceitarAcompanhamento } from './paginas/AceitarAcompanhamento';
import { AlunosAcompanhados } from './paginas/AlunosAcompanhados';
import { QuemPodeVer } from './paginas/QuemPodeVer';

// L22a-2: "Quem pode ver meus dados", aceite do convite e leitura pelo acompanhante. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const semContraste = { rules: { 'color-contrast': { enabled: false } } };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const base = {
  email_convidado: 'prof@teste.exemplo',
  ver_tarefas: false,
  ver_dificuldade: false,
  ver_notas: false,
  ver_mensagens: false,
  aprovado: true,
  aceito: true,
  justificativa: null,
  aviso: null,
};
const lista = (extra: object = {}) => ({
  acompanhantes: [
    {
      ...base,
      id: 'a1',
      papel: 'professor',
      situacao: 'ativo',
      fim_em: '2027-11-13',
      dias_restantes: 365,
      ...extra,
    },
  ],
  menor: true,
  ator: 'representante',
  pode_gerir: true,
  limite: 5,
});

describe('Quem pode ver meus dados', () => {
  it('mostra o pedido com validade em data e barra, as 4 caixas desmarcadas, sem violação do axe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(lista())),
    );
    const { container } = render(<QuemPodeVer />);
    expect(await screen.findByText('prof@teste.exemplo')).toBeTruthy();
    expect(screen.getByText('13/11/2027')).toBeTruthy(); // data, não só número de dias
    expect(screen.getByRole('img', { name: /Barra de validade/ })).toBeTruthy(); // forma visual
    for (const c of screen.getAllByRole('checkbox'))
      expect((c as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/Ninguém vê nada até você aceitar e marcar/)).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('o convite sai com as caixas desmarcadas por padrão e avisa quando o representante precisa aprovar', async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json({ id: 'n1', aguarda_aprovacao: true }, 201)
        : json({ ...lista(), ator: 'aluno', acompanhantes: [] }),
    );
    vi.stubGlobal('fetch', f);
    const u = userEvent.setup();
    render(<QuemPodeVer />);
    await u.type(await screen.findByLabelText('E-mail da pessoa'), 'novo@teste.exemplo');
    await u.click(screen.getByRole('button', { name: 'Enviar convite' }));
    expect(await screen.findByText(/representante legal precisa aprovar/)).toBeTruthy();
    const post = f.mock.calls.find((c) => c[1]?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      email: 'novo@teste.exemplo',
      papel: 'professor',
      itens: { tarefas: false, dificuldade: false, notas: false, mensagens: false },
    });
  });

  it('encerrar pede um motivo de pelo menos 3 letras antes de confirmar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(lista())),
    );
    const u = userEvent.setup();
    render(<QuemPodeVer />);
    await u.click(await screen.findByRole('button', { name: 'Encerrar o acesso' }));
    const confirmar = screen.getByRole('button', {
      name: 'Confirmar o encerramento',
    }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    await u.type(screen.getByLabelText('Por que você quer encerrar?'), 'Mudou de escola');
    expect(confirmar.disabled).toBe(false);
  });

  it('aluno maior sem poder gerir não vê o formulário', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({ ...lista(), pode_gerir: false, ator: 'representante', menor: false }),
      ),
    );
    render(<QuemPodeVer />);
    expect(await screen.findByText(/Só o aluno pode convidar/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar convite' })).toBeNull();
  });
});

describe('o acompanhante lê um item por vez, só o liberado', () => {
  const aluno = {
    acompanhamento_id: 'a1',
    aluno_nome: 'Aluno Fictício',
    papel: 'professor',
    situacao: 'ativo',
    fim_em: '2027-11-13',
    vencido: false,
    ver_tarefas: true,
    ver_dificuldade: false,
    ver_notas: false,
    ver_mensagens: false,
    aviso_pendente: true,
  };
  it('só há botão para o item liberado; ler mostra os dados; o aviso pode ser dispensado', async () => {
    const f = vi.fn(async (url: string) => {
      if (String(url).endsWith('/aviso')) return new Response(null, { status: 204 });
      if (String(url).endsWith('/tarefas'))
        return json({
          item: 'tarefas',
          dados: [
            {
              titulo: 'Trabalho de ciências',
              disciplina: 'Ciências',
              prazo: '2026-11-20',
              situacao: 'pendente',
            },
          ],
        });
      return json({ alunos: [aluno] });
    });
    vi.stubGlobal('fetch', f);
    const u = userEvent.setup();
    const { container } = render(<AlunosAcompanhados />);
    expect(await screen.findByText('Aluno Fictício')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Notas' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nível de dificuldade' })).toBeNull();
    expect(screen.getByText(/Quem controla o acesso é o aluno/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Tarefas e plano' }));
    expect(await screen.findByText('Trabalho de ciências')).toBeTruthy();
    expect(screen.getByText(/20\/11/)).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await u.click(screen.getByRole('button', { name: 'Li o aviso' }));
    await waitFor(() =>
      expect(f.mock.calls.some((c) => String(c[0]).endsWith('/aviso'))).toBe(true),
    );
  });

  it('pedido ainda sem aprovação do representante não mostra botão de leitura', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          alunos: [{ ...aluno, situacao: 'aguardando_representante', aviso_pendente: false }],
        }),
      ),
    );
    render(<AlunosAcompanhados />);
    expect(await screen.findByText(/Esperando o representante legal aprovar/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tarefas e plano' })).toBeNull();
  });
});

describe('aceitar o convite', () => {
  it('sem sessão pede para entrar; com sessão confirma; link ruim mostra o aviso da API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ erro: 'Sessão inválida ou vencida.' }, 401)),
    );
    const { unmount } = render(<AceitarAcompanhamento token={'x'.repeat(30)} />);
    expect(
      await screen.findByText(/entre na sua conta e abra o link do e-mail de novo/),
    ).toBeTruthy();
    unmount();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ aceito: true })),
    );
    const r2 = render(<AceitarAcompanhamento token={'y'.repeat(30)} />);
    expect(await screen.findByText(/Convite aceito/)).toBeTruthy();
    r2.unmount();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({ erro: 'Este link não vale mais, ou não é para o e-mail desta conta.' }, 400),
      ),
    );
    render(<AceitarAcompanhamento token={'z'.repeat(30)} />);
    expect(await screen.findByText(/Este link não vale mais/)).toBeTruthy();
  });
});
