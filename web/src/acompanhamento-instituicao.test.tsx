// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { paraTexto } from './datas';
import { AcompanhamentoInstituicao } from './paginas/AcompanhamentoInstituicao';
import { QuemPodeVer } from './paginas/QuemPodeVer';

// L22a-2b: código da instituição, fila do Pedagógico, vínculos e pedido do aluno por código. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const semContraste = { rules: { 'color-contrast': { enabled: false } } };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const vinculo = {
  id: 'v1',
  aluno_nome: 'Aluno Fictício',
  acompanhante_nome: 'Pedagoga Fictícia',
  meu: true,
  situacao: 'ativo',
  fim_em: '2027-11-13',
  dias_restantes: 365,
  vencido: false,
  aviso: null,
  aviso_pendente: true,
  ver_tarefas: true,
  ver_dificuldade: false,
  ver_notas: false,
  ver_mensagens: false,
};
const pedido = {
  acompanhamento_id: 'p1',
  aluno_nome: 'Aluno Pedinte',
  ver_tarefas: true,
  ver_dificuldade: true,
  ver_notas: false,
  ver_mensagens: false,
  aprovado: false,
};
function rotas(extra: Record<string, unknown> = {}) {
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (extra[`${init?.method ?? 'GET'} ${u}`] !== undefined)
      return json(extra[`${init?.method ?? 'GET'} ${u}`]);
    if (u.endsWith('/acompanhamento-instituicao/codigo'))
      return json({ ativo: true, tem_codigo: true });
    if (u.endsWith('/acompanhamento-instituicao/fila')) return json({ pedidos: [pedido] });
    if (u.endsWith('/acompanhamento-instituicao/vinculos')) return json({ vinculos: [vinculo] });
    return json({ ok: true });
  });
  vi.stubGlobal('fetch', f);
  return f;
}

describe('Admin: código da instituição', () => {
  it('mostra o código novo uma vez, com a situação em palavras; sem violação do axe', async () => {
    const f = rotas({
      'POST /api/acompanhamento-instituicao/codigo': { codigo: 'ABCD-EFGH-JKLM-NPQR', ativo: true },
    });
    const u = userEvent.setup();
    const { container } = render(<AcompanhamentoInstituicao perfil="admin" />);
    expect(await screen.findByText('ligado')).toBeTruthy();
    expect(screen.queryByText('Pedidos esperando')).toBeNull(); // a fila é do Pedagógico
    await u.click(screen.getByRole('button', { name: 'Gerar código novo' }));
    expect(await screen.findByText('ABCD-EFGH-JKLM-NPQR')).toBeTruthy();
    expect(screen.getByText(/Ele aparece só agora/)).toBeTruthy();
    const corpo = JSON.parse(String(f.mock.calls.find((c) => c[1]?.method === 'POST')?.[1]?.body));
    expect(corpo).toEqual({ acao: 'gerar' });
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });
});

describe('Pedagógico: fila e alunos acompanhados', () => {
  it('a fila mostra só nome e caixas pedidas; recusar pede motivo de 3 letras; aceitar chama a rota', async () => {
    const f = rotas();
    const u = userEvent.setup();
    const { container } = render(<AcompanhamentoInstituicao perfil="pedagogico" />);
    expect(await screen.findByText('Aluno Pedinte')).toBeTruthy();
    expect(
      screen.getByText(/Pediu para liberar: Tarefas, plano e agenda, Nível de dificuldade/),
    ).toBeTruthy();
    expect(screen.getByText(/representante legal ainda precisa aprovar/)).toBeTruthy();
    expect(screen.queryByText('Código da instituição')).toBeNull(); // o código é do Admin
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await u.click(screen.getByRole('button', { name: 'Recusar' }));
    const confirmar = screen.getByRole('button', {
      name: 'Confirmar a recusa',
    }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    await u.type(screen.getByLabelText('Por que você recusa?'), 'Fora do atendimento');
    expect(confirmar.disabled).toBe(false);
    await u.click(confirmar);
    await waitFor(() =>
      expect(f.mock.calls.some((c) => String(c[0]).endsWith('/fila/p1/recusar'))).toBe(true),
    );
  });

  it('só há botão para a caixa liberada; ler mostra os dados; o aviso pode ser dispensado; validade em data e barra', async () => {
    const f = rotas({
      'GET /api/acompanhamento-instituicao/vinculos/v1/tarefas': {
        item: 'tarefas',
        dados: [
          {
            titulo: 'Trabalho de ciências',
            disciplina: 'Ciências',
            prazo: paraTexto(new Date()),
            situacao: 'pendente',
          },
        ],
      },
    });
    const u = userEvent.setup();
    render(<AcompanhamentoInstituicao perfil="pedagogico" />);
    expect(await screen.findByText('Aluno Fictício')).toBeTruthy();
    expect(screen.getByText('13/11/2027')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Barra de validade/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Notas' })).toBeNull();
    expect(screen.getByText(/Quem controla o acesso é o aluno/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Tarefas e plano' }));
    expect(await screen.findByText('Trabalho de ciências')).toBeTruthy();
    // prazo em palavra e data, não só número
    expect(screen.getByText(/Prazo: hoje \(\d{2}\/\d{2}\)/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Li o aviso' }));
    await waitFor(() =>
      expect(f.mock.calls.some((c) => String(c[0]).endsWith('/vinculos/v1/aviso'))).toBe(true),
    );
  });

  it('renovar em lote envia só os marcados', async () => {
    const f = rotas();
    const u = userEvent.setup();
    render(<AcompanhamentoInstituicao perfil="admin" />);
    const renovar = (await screen.findByRole('button', {
      name: 'Renovar os marcados',
    })) as HTMLButtonElement;
    expect(renovar.disabled).toBe(true);
    await u.click(screen.getByRole('checkbox', { name: /Aluno Fictício/ }));
    await u.click(renovar);
    const chamada = f.mock.calls.find((c) => String(c[0]).endsWith('/vinculos/renovar'));
    expect(JSON.parse(String(chamada?.[1]?.body))).toEqual({ ids: ['v1'] });
  });
});

describe('aluno: pedido por código e prorrogação', () => {
  const lista = (extra: object = {}) => ({
    acompanhantes: [
      {
        id: 'a1',
        papel: 'pedagogico',
        situacao: 'ativo',
        email_convidado: null,
        origem: 'codigo',
        instituicao_nome: 'Escola Fictícia',
        ver_tarefas: true,
        ver_dificuldade: false,
        ver_notas: false,
        ver_mensagens: false,
        aprovado: true,
        aceito: true,
        fim_em: '2026-12-01',
        dias_restantes: 10,
        justificativa: null,
        aviso: 'quinze',
        ...extra,
      },
    ],
    menor: true,
    ator: 'representante',
    pode_gerir: true,
    limite: 5,
  });
  it('o pedido por código sai com as caixas desmarcadas; o vínculo da instituição mostra o nome e o botão de prorrogar, sem renovar em 12 meses', async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json({ enviado: true, aguarda_aprovacao: false }, 201)
        : json(lista()),
    );
    vi.stubGlobal('fetch', f);
    const u = userEvent.setup();
    const { container } = render(<QuemPodeVer />);
    expect(await screen.findByText('Instituição: Escola Fictícia')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Prorrogar por 30 dias' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Renovar por 12 meses' })).toBeNull();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await u.type(screen.getByLabelText('Código da instituição'), 'abcd-efgh-jklm-npqr');
    await u.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByText(/Pedagógico da instituição aceita ou recusa/)).toBeTruthy();
    const post = f.mock.calls.find(
      (c) => c[1]?.method === 'POST' && String(c[0]).endsWith('/acompanhamento/instituicao'),
    );
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      codigo: 'abcd-efgh-jklm-npqr',
      itens: { tarefas: false, dificuldade: false, notas: false, mensagens: false },
    });
  });

  it('prorrogar só aparece perto da data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(lista({ dias_restantes: 200, aviso: null }))),
    );
    render(<QuemPodeVer />);
    expect(await screen.findByText('Instituição: Escola Fictícia')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Prorrogar por 30 dias' })).toBeNull();
  });
});
