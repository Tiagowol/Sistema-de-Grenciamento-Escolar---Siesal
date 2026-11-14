// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Eu, Perfil } from './api';
import { Shell } from './componentes/Shell';
import css from './estilos/extra.css?raw';
import { ITENS_MASTER } from './paginas/Operacao';

// L22g: menu lateral sem barra de rolagem visível, com sombra no pé e um ícone próprio por item. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function simular() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ itens: [], nao_vistos: 0 }), { status: 200 })),
  );
}
const eu = (perfil: string, espaco: 'escola' | 'individual' = 'escola'): Eu => ({
  nivel: 'completo',
  usuario: { id: 'u', nome: 'Pessoa Fictícia', perfil: perfil as Perfil },
  modulos: { mensagens: true, calendario: true, apoio_aluno: true },
  espaco,
});
const tela = (perfil: string, espaco: 'escola' | 'individual' = 'escola') =>
  render(
    <Shell
      eu={eu(perfil, espaco)}
      pagina="inicio"
      aoIr={() => undefined}
      aoSair={() => undefined}
      itens={perfil === 'master' ? ITENS_MASTER : undefined}
    >
      <p>conteúdo</p>
    </Shell>,
  );
// Desenho (SVG) de cada item do menu, em ordem
const desenhos = () => {
  const menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
  return within(menu)
    .getAllByRole('button')
    .map((b) => ({
      rotulo: b.textContent?.trim() ?? '',
      svg: b.querySelector('svg')?.innerHTML ?? '',
    }));
};

describe('menu: nenhum ícone repetido (L22g)', () => {
  const casos: [string, 'escola' | 'individual'][] = [
    ['aluno', 'escola'],
    ['aluno', 'individual'],
    ['professor', 'escola'],
    ['pedagogico', 'escola'],
    ['admin', 'escola'],
    ['responsavel', 'escola'],
    ['responsavel', 'individual'],
    ['master', 'escola'],
  ];
  it.each(casos)('%s (%s): cada item tem um desenho próprio', (perfil, espaco) => {
    simular();
    tela(perfil, espaco);
    const lista = desenhos();
    expect(lista.length).toBeGreaterThan(5);
    const repetidos = lista.filter(
      (a, i) => a.svg === '' || lista.findIndex((b) => b.svg === a.svg) !== i,
    );
    expect(repetidos.map((r) => r.rotulo)).toEqual([]);
  });

  it('os ícones são decorativos: o nome do item continua sendo o texto', () => {
    simular();
    tela('admin');
    const menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
    for (const svg of menu.querySelectorAll('svg'))
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    for (const nome of ['Auditoria', 'Avisos da escola', 'Pedidos de acompanhamento', 'Usuários'])
      expect(within(menu).getByRole('button', { name: nome })).toBeTruthy();
  });
});

describe('menu: sem barra de rolagem e com sombra no pé (L22g)', () => {
  it('o CSS esconde a barra nativa nos dois motores, sem desligar a rolagem', () => {
    expect(css).toMatch(/\.sidebar\s*\{[^}]*scrollbar-width:\s*none/);
    expect(css).toMatch(/\.sidebar::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
    // Não troca overflow por hidden: a rolagem por roda, toque e teclado continua
    expect(css).not.toMatch(/(^|\n)\.sidebar\s*\{[^}]*overflow(-y)?:\s*hidden/);
  });

  it('a sombra do pé não anima e não pega o clique', () => {
    const bloco = /\.sidebar\.mais-abaixo::after\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(bloco).toContain('pointer-events: none');
    expect(bloco).not.toMatch(/animation|transition/);
  });

  it('a classe da sombra aparece com itens abaixo e some no fim da rolagem', () => {
    simular();
    // jsdom não tem layout: simula um menu de 1000 px dentro de 500 px
    const doMenu = (el: Element, valor: number) => (el.classList.contains('sidebar') ? valor : 0);
    vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
      return doMenu(this, 1000);
    });
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
      return doMenu(this, 500);
    });
    tela('admin');
    const menu = screen.getByLabelText('Menu principal');
    expect(menu.classList.contains('mais-abaixo')).toBe(true);
    // Chegou ao fim: não sobra nada abaixo
    Object.defineProperty(menu, 'scrollTop', { value: 500, configurable: true, writable: true });
    act(() => {
      fireEvent.scroll(menu);
    });
    expect(menu.classList.contains('mais-abaixo')).toBe(false);
    // Voltou ao alto: a sombra volta
    Object.defineProperty(menu, 'scrollTop', { value: 0, configurable: true, writable: true });
    act(() => {
      fireEvent.scroll(menu);
    });
    expect(menu.classList.contains('mais-abaixo')).toBe(true);
  });

  it('com o menu todo à vista, não há sombra', () => {
    simular();
    tela('professor');
    expect(screen.getByLabelText('Menu principal').classList.contains('mais-abaixo')).toBe(false);
  });
});

describe('menu: item de duas linhas (L22g)', () => {
  it('o texto do item não é encurtado e o CSS alinha ícone e texto', () => {
    simular();
    tela('admin');
    expect(screen.getByRole('button', { name: 'Pedidos de acompanhamento' })).toBeTruthy();
    expect(css).toMatch(/\.nav button \.inlineicon\s*\{[^}]*align-self:\s*center/);
    expect(css).toMatch(/\.nav button\s*\{[^}]*line-height:\s*1\.25/);
  });

  it('o menu passa no axe nos 6 perfis', async () => {
    for (const perfil of ['aluno', 'professor', 'pedagogico', 'admin', 'responsavel', 'master']) {
      simular();
      const { container, unmount } = tela(perfil);
      const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(r.violations.map((v) => `${perfil}: ${v.id}`)).toEqual([]);
      unmount();
    }
  });
});
