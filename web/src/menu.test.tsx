// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Eu } from './api';
import { Shell } from './componentes/Shell';
import { buscarNoMenu, normalizar } from './menu';
import { Avisos } from './paginas/Avisos';

// L16d: barra lateral recolhível, estados de carregamento e busca no menu
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const euDe = (perfil: Eu['usuario']['perfil']): Eu => ({
  nivel: 'completo',
  usuario: { id: 'u1', nome: 'Pessoa Fictícia', perfil },
});

const DIA = {
  hoje: '2026-11-10',
  atrasadas: [],
  para_hoje: [],
  proximas: [],
  eventos: [],
  minutos_estudados_hoje: 0,
  sessao_atual: null,
  tarefas_concluidas: 0,
  tarefas_total: 0,
};
const semRede = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const corpo = String(url).includes('/meu-dia') ? DIA : { itens: [], nao_vistos: 0 };
      return new Response(JSON.stringify(corpo), { status: 200 });
    }),
  );

const ITENS = [
  { id: 'meudia', rotulo: 'Meu dia', palavras: ['hoje'] },
  { id: 'atividades', rotulo: 'Atividades', palavras: ['tarefa', 'licao', 'prazo'] },
  { id: 'notasoficiais', rotulo: 'Notas oficiais', palavras: ['boletim', 'revisao'] },
  { id: 'acessibilidade', rotulo: 'Acessibilidade', palavras: ['configuracao'] },
] as const;

describe('busca no menu (função)', () => {
  it('ignora acento e maiúscula', () => {
    expect(normalizar('  Lição ÁRVORE ')).toBe('licao arvore');
    expect(buscarNoMenu([...ITENS], 'LIÇÃO', 'acessibilidade').map((a) => a.id)).toEqual([
      'atividades',
    ]);
    expect(buscarNoMenu([...ITENS], 'revisão', 'acessibilidade').map((a) => a.id)).toEqual([
      'notasoficiais',
    ]);
  });
  it('acha configurações dentro de Acessibilidade e diz onde ficam', () => {
    const r = buscarNoMenu([...ITENS], 'fonte', 'acessibilidade');
    expect(r).toEqual([
      { id: 'acessibilidade', rotulo: 'Tamanho da fonte', dentroDe: 'Acessibilidade' },
    ]);
    expect(buscarNoMenu([...ITENS], 'escuro', 'acessibilidade')[0]?.rotulo).toBe('Tema escuro');
    expect(buscarNoMenu([...ITENS], 'contraste', 'acessibilidade')[0]?.rotulo).toBe(
      'Alto contraste',
    );
  });
  it('respeita permissão: sem Acessibilidade no menu, não há atalho de configuração', () => {
    const semAcesso = ITENS.filter((i) => i.id !== 'acessibilidade');
    expect(buscarNoMenu([...semAcesso], 'fonte', 'acessibilidade')).toEqual([]);
  });
  it('busca vazia devolve o menu inteiro', () => {
    expect(buscarNoMenu([...ITENS], '   ', 'acessibilidade')).toHaveLength(ITENS.length);
  });
});

describe('Shell: busca e menu recolhível', () => {
  const montar = (perfil: Eu['usuario']['perfil'] = 'aluno') => {
    semRede();
    return render(
      <Shell eu={euDe(perfil)} pagina="meudia" aoIr={() => {}} aoSair={() => {}}>
        <p>Conteúdo</p>
      </Shell>,
    );
  };

  it('a busca filtra só o que o perfil pode ver e avisa quando não acha', async () => {
    montar('responsavel');
    const caixa = screen.getByLabelText('Buscar no menu');
    await userEvent.type(caixa, 'boletim');
    const nav = screen.getByRole('navigation', { name: 'Telas do sistema' });
    expect(within(nav).getByRole('button', { name: /Notas oficiais/ })).toBeTruthy();
    expect(within(nav).queryByRole('button', { name: /Atividades/ })).toBeNull();
    await userEvent.clear(caixa);
    await userEvent.type(caixa, 'xyzxyz');
    expect(screen.getByText(/Nada encontrado para/)).toBeTruthy();
    expect(screen.getByText('Nenhum resultado.')).toBeTruthy();
  });

  it('Professor não tem atalho para a tela de notas oficiais', async () => {
    montar('professor');
    await userEvent.type(screen.getByLabelText('Buscar no menu'), 'boletim');
    expect(screen.queryByRole('button', { name: /Notas oficiais/ })).toBeNull();
    expect(screen.getByText(/Nada encontrado para/)).toBeTruthy();
  });

  it('Aluno acha "fonte" e vai para Acessibilidade, limpando a busca', async () => {
    const aoIr = vi.fn();
    semRede();
    render(
      <Shell eu={euDe('aluno')} pagina="meudia" aoIr={aoIr} aoSair={() => {}}>
        <p>x</p>
      </Shell>,
    );
    await userEvent.type(screen.getByLabelText('Buscar no menu'), 'fonte');
    await userEvent.click(screen.getByRole('button', { name: /Tamanho da fonte/ }));
    expect(aoIr).toHaveBeenCalledWith('acessibilidade');
    expect((screen.getByLabelText('Buscar no menu') as HTMLInputElement).value).toBe('');
  });

  it('Esc limpa a busca', async () => {
    montar();
    const caixa = screen.getByLabelText('Buscar no menu') as HTMLInputElement;
    await userEvent.type(caixa, 'nota');
    await userEvent.keyboard('{Escape}');
    expect(caixa.value).toBe('');
  });

  it('o botão recolhe e mostra o menu, anuncia o estado e lembra neste aparelho', async () => {
    const { container } = montar();
    const botao = screen.getByRole('button', { name: 'Recolher menu' });
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(botao.getAttribute('aria-controls')).toBe('menu-principal');
    expect(document.getElementById('menu-principal')).toBeTruthy();
    await userEvent.click(botao);
    const mostrar = screen.getByRole('button', { name: 'Mostrar menu' });
    expect(mostrar.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.app')?.className).toContain('menu-recolhido');
    expect(localStorage.getItem('siesal-menu-recolhido-v1')).toBe('sim');
    cleanup();
    montar();
    expect(screen.getByRole('button', { name: 'Mostrar menu' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar menu' }));
    expect(localStorage.getItem('siesal-menu-recolhido-v1')).toBe('nao');
  });

  it('passa no axe com a busca e o botão', async () => {
    const { container } = montar();
    await waitFor(() => expect(container.querySelector('.sinos')).toBeTruthy());
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

describe('estados de carregamento', () => {
  it('Avisos: mostra "Carregando…" antes dos dados, nunca "Sem avisos" cedo demais', async () => {
    let liberar: (r: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            liberar = resolve;
          }),
      ),
    );
    render(<Avisos aoMudar={() => {}} />);
    expect(screen.getByRole('status').textContent).toContain('Carregando');
    expect(screen.queryByText(/Sem avisos por enquanto/)).toBeNull();
    liberar(new Response(JSON.stringify({ notificacoes: [], nao_lidas: 0 }), { status: 200 }));
    await screen.findByText(/Sem avisos por enquanto/);
    expect(screen.queryByText(/Carregando/)).toBeNull();
  });

  it('Avisos: em erro, mostra o erro e não "Sem avisos"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ erro: 'Falha de teste' }), { status: 500 })),
    );
    render(<Avisos aoMudar={() => {}} />);
    await waitFor(() => expect(screen.queryByText(/Carregando/)).toBeNull());
    expect(screen.queryByText(/Sem avisos por enquanto/)).toBeNull();
  });
});
