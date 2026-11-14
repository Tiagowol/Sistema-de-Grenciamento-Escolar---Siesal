// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Eu, Perfil } from './api';
import { Shell } from './componentes/Shell';

// L22d: contrato do padrão. TODO perfil tem a mesma estrutura (busca no menu, Ajuda, Suporte, Versão, sino de
// mensagens, Acessibilidade, Minha conta e Sair); só o conteúdo muda. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const PERFIS: Perfil[] = ['aluno', 'professor', 'pedagogico', 'admin', 'responsavel'];

function simular() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ itens: [], nao_vistos: 0 }), { status: 200 })),
  );
}
const eu = (perfil: Perfil, espaco: 'escola' | 'individual' = 'escola'): Eu => ({
  nivel: 'completo',
  usuario: { id: 'u', nome: 'Pessoa Fictícia', perfil },
  modulos: { mensagens: true, calendario: true, apoio_aluno: true },
  espaco,
});

describe.each(PERFIS)('padrão do menu e do topo: %s', (perfil) => {
  it.each(['escola', 'individual'] as const)('tem a mesma estrutura no espaço %s', (espaco) => {
    if (espaco === 'individual' && !['aluno', 'responsavel'].includes(perfil)) return;
    simular();
    render(
      <Shell
        eu={eu(perfil, espaco)}
        pagina="inicio"
        aoIr={() => undefined}
        aoSair={() => undefined}
      >
        <p>conteúdo</p>
      </Shell>,
    );
    const menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
    // Busca no menu
    expect(screen.getByLabelText('Buscar no menu')).toBeTruthy();
    // Itens comuns a todos
    for (const rotulo of ['Ajuda', 'Suporte', 'Acessibilidade', 'Minha conta'])
      expect(within(menu).getByRole('button', { name: rotulo }), rotulo).toBeTruthy();
    // Topo: Ajuda, Sair, sino de mensagens; versão no rodapé do menu
    // Ajuda no menu e no topo
    expect(screen.getAllByRole('button', { name: 'Ajuda' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Mensagens/ })).toBeTruthy();
    expect(screen.getByText(/SIESAL 4\.0 · Parte 1/)).toBeTruthy();
  });

  it('o sino de prazos existe só para o aluno', () => {
    simular();
    render(
      <Shell eu={eu(perfil)} pagina="inicio" aoIr={() => undefined} aoSair={() => undefined}>
        <p>conteúdo</p>
      </Shell>,
    );
    expect(screen.queryByRole('button', { name: /Prazos/ }) !== null).toBe(perfil === 'aluno');
  });
});

describe('o que cada perfil vê no espaço individual (L22d)', () => {
  it('o responsável do espaço individual não tem Notas oficiais nem Calendário da escola; na escola tem', () => {
    simular();
    const { unmount } = render(
      <Shell
        eu={eu('responsavel', 'individual')}
        pagina="inicio"
        aoIr={() => undefined}
        aoSair={() => undefined}
      >
        <p>conteúdo</p>
      </Shell>,
    );
    let menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
    expect(within(menu).queryByRole('button', { name: /Notas oficiais/ })).toBeNull();
    expect(within(menu).queryByRole('button', { name: /Calendário da escola/ })).toBeNull();
    expect(within(menu).getByRole('button', { name: 'Meu aluno' })).toBeTruthy();
    unmount();
    render(
      <Shell
        eu={eu('responsavel', 'escola')}
        pagina="inicio"
        aoIr={() => undefined}
        aoSair={() => undefined}
      >
        <p>conteúdo</p>
      </Shell>,
    );
    menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
    expect(within(menu).getByRole('button', { name: /Notas oficiais/ })).toBeTruthy();
    expect(within(menu).getByRole('button', { name: /Calendário da escola/ })).toBeTruthy();
    expect(within(menu).queryByRole('button', { name: 'Meu aluno' })).toBeNull();
  });
});
