// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Turmas } from './paginas/Turmas';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TURMA = {
  id: 't1',
  nome: '7º A',
  ano_letivo: 2026,
  turno: 'manha',
  criado_em: '2026-11-08',
  ativa: true,
  alunos: 1,
  professores: 1,
};
const USUARIOS = [
  {
    id: 'u1',
    perfil: 'aluno',
    nome: 'Aluna Fictícia',
    email: 'a@x.exemplo',
    situacao: 'ativo',
    senhaProvisoria: false,
  },
  {
    id: 'u2',
    perfil: 'professor',
    nome: 'Professor Fictício',
    email: 'p@x.exemplo',
    situacao: 'ativo',
    senhaProvisoria: false,
  },
];

// Responde às rotas da tela e guarda as chamadas de escrita
function simular() {
  const escritas: { url: string; corpo: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const caminho = url.replace('/api', '');
      if (init?.method === 'POST') {
        escritas.push({ url: caminho, corpo: init.body ? JSON.parse(String(init.body)) : null });
        return new Response(caminho.endsWith('ar') ? null : JSON.stringify({ id: 'novo' }), {
          status: caminho.endsWith('ar') ? 204 : 201,
        });
      }
      const dados: Record<string, unknown> = {
        '/turmas': { turmas: [TURMA] },
        '/disciplinas': {
          disciplinas: [{ id: 'd1', nome: 'Matemática', criado_em: '2026-11-08', ativa: true }],
        },
        '/vinculos': {
          vinculos: [
            {
              id: 'v1',
              tipo: 'aluno_turma',
              criado_em: '2026-11-08',
              usuario_id: 'u1',
              usuario_nome: 'Aluna Fictícia',
              turma_nome: '7º A',
              disciplina_nome: null,
              aluno_nome: null,
            },
          ],
        },
        '/usuarios': { usuarios: USUARIOS },
      };
      return new Response(JSON.stringify(dados[caminho] ?? {}), {
        status: dados[caminho] ? 200 : 404,
      });
    }),
  );
  return escritas;
}

describe('tela Turmas e vínculos', () => {
  it('mostra turmas, disciplinas e vínculos em frases, datas em dia/mês, sem violações do axe', async () => {
    simular();
    const { container } = render(<Turmas />);
    await screen.findByText(/^Aluna Fictícia está na turma 7º A$/);
    expect(screen.getAllByText(/08\/11/).length).toBeGreaterThan(0);
    expect(screen.getByText('Matemática')).toBeTruthy();
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it('cadastra turma pelo formulário com os campos certos', async () => {
    const escritas = simular();
    render(<Turmas />);
    await screen.findByText(/^Aluna Fictícia está na turma/);
    await userEvent.type(screen.getByLabelText('Nome da turma'), '8º B');
    await userEvent.click(screen.getByRole('button', { name: /Tarde/ }));
    await userEvent.click(screen.getByRole('button', { name: /Cadastrar turma/ }));
    await waitFor(() => expect(escritas.length).toBe(1));
    expect(escritas[0]?.url).toBe('/turmas');
    expect(escritas[0]?.corpo).toMatchObject({ nome: '8º B', turno: 'tarde' });
    await screen.findByText('Turma 8º B cadastrada.');
  });

  it('vincula professor pedindo turma e disciplina; mostra aviso se faltar algo', async () => {
    const escritas = simular();
    render(<Turmas />);
    await screen.findByText(/^Aluna Fictícia está na turma/);
    await userEvent.selectOptions(screen.getByLabelText('Tipo de vínculo'), 'professor_turma');
    await userEvent.click(screen.getByRole('button', { name: /Vincular$/ }));
    await screen.findByText('Escolha todas as opções do vínculo.');
    expect(escritas.length).toBe(0);
    await userEvent.selectOptions(screen.getByLabelText('Professor'), 'u2');
    await userEvent.selectOptions(screen.getByLabelText('Turma'), 't1');
    await userEvent.selectOptions(screen.getByLabelText('Disciplina'), 'd1');
    await userEvent.click(screen.getByRole('button', { name: /Vincular$/ }));
    await waitFor(() => expect(escritas.length).toBe(1));
    expect(escritas[0]?.corpo).toEqual({
      tipo: 'professor_turma',
      usuario_id: 'u2',
      turma_id: 't1',
      disciplina_id: 'd1',
    });
  });

  it('inativar chama a rota de inativar (nada é apagado)', async () => {
    const escritas = simular();
    render(<Turmas />);
    await screen.findByText(/^Aluna Fictícia está na turma/);
    // O primeiro botão Inativar é o da turma (a lista de turmas vem antes das outras)
    const [botaoTurma] = screen.getAllByText('Inativar', { selector: 'button' });
    await userEvent.click(botaoTurma as HTMLElement);
    await waitFor(() => expect(escritas.map((e) => e.url)).toContain('/turmas/t1/inativar'));
  });
});
