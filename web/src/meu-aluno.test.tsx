// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeuAluno } from './paginas/MeuAluno';

// L22a-3: "Meu aluno" (representante legal, só leitura). Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const semContraste = { rules: { 'color-contrast': { enabled: false } } };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const ficha = (extra: object = {}) => ({
  aluno_nome: 'Aluno Fictício',
  menor: true,
  maior_em: '2030-03-10',
  dias_para_18: 1200,
  ...extra,
});
const hoje = () => new Date().toISOString().slice(0, 10);

describe('Meu aluno', () => {
  it('aluno menor: avisa que é só leitura, mostra os 6 itens e nenhum botão que mude algo; sem violação do axe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(ficha())),
    );
    const { container } = render(<MeuAluno />);
    expect(await screen.findByText(/Aluno Fictício\. Você só lê/)).toBeTruthy();
    expect(screen.getByText(/representante legal do aluno menor de idade/)).toBeTruthy();
    for (const nome of [
      'Tarefas e plano',
      'Agenda',
      'Notas',
      'Mensagens',
      'Disciplinas',
      'Nível de dificuldade',
    ])
      expect(screen.getByRole('button', { name: nome })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(6); // só leitura: nenhum outro botão
    expect(screen.queryByRole('progressbar')).toBeNull(); // falta muito para os 18 anos: sem aviso
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('agenda: dia em palavra e data, parte do dia com nome, duração em bloco com os minutos pequenos', async () => {
    const f = vi.fn(async (url: string) =>
      url.endsWith('/representado/agenda')
        ? json({
            item: 'agenda',
            dados: [
              {
                titulo: 'Estudar frações',
                tipo: 'estudo',
                dia: hoje(),
                hora_inicio: '14:30',
                minutos: 25,
              },
            ],
          })
        : json(ficha()),
    );
    vi.stubGlobal('fetch', f);
    const u = userEvent.setup();
    const { container } = render(<MeuAluno />);
    await u.click(await screen.findByRole('button', { name: 'Agenda' }));
    expect(await screen.findByText('Estudar frações')).toBeTruthy();
    expect(screen.getByText(/hoje \(\d{2}\/\d{2}\)/)).toBeTruthy();
    expect(screen.getByText(/Tarde/)).toBeTruthy();
    expect(screen.getByText(/Duração: Médio/)).toBeTruthy();
    expect(screen.getByText('(25 min)')).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('faltam 30 dias ou menos para os 18 anos: aviso em palavra, data e barra', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(ficha({ dias_para_18: 10, maior_em: '2030-03-10' }))),
    );
    render(<MeuAluno />);
    expect(await screen.findByText(/O aluno faz 18 anos .* \(10\/03\/2030\)/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: /18 anos/ })).toBeTruthy();
  });

  it('aluno maior: nenhum botão de leitura e o texto diz que vale só o que o aluno liberar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(ficha({ menor: false, dias_para_18: -5 }))),
    );
    const { container } = render(<MeuAluno />);
    expect(
      await screen.findByText(/O aluno tem 18 anos ou mais\. Você vê só o que ele liberar/),
    ).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('sem permissão: mostra o erro em vez de dados', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ erro: 'Sem permissão.' }, 403)),
    );
    render(<MeuAluno />);
    expect(await screen.findByText('Sem permissão.')).toBeTruthy();
  });
});
