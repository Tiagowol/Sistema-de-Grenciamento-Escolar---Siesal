// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Eu } from './api';
import { Shell } from './componentes/Shell';
import { MANUAL_DATA, MANUAL_VERSAO, TOPICOS, topicosDoPerfil } from './manual';
import { Ajuda } from './paginas/Ajuda';

// L16e: ajuda no menu e manual por perfil
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const PERFIS = ['aluno', 'responsavel', 'professor', 'pedagogico', 'admin'] as const;

describe('conteúdo do manual', () => {
  it('cada perfil tem tópicos próprios e o comum (entrar, acessibilidade, menu, problemas)', () => {
    for (const p of PERFIS) {
      const ids = topicosDoPerfil(p).map((t) => t.id);
      for (const comum of ['entrar', 'acessibilidade', 'menu-busca', 'problemas', 'limites'])
        expect(ids, p).toContain(comum);
      expect(ids.length, p).toBeGreaterThanOrEqual(7);
    }
    expect(topicosDoPerfil('aluno').map((t) => t.id)).toContain('foco');
    expect(topicosDoPerfil('professor').map((t) => t.id)).toContain('professor-pedidos');
    expect(topicosDoPerfil('professor').map((t) => t.id)).not.toContain('foco');
    expect(topicosDoPerfil('pedagogico').map((t) => t.id)).toContain('aviso-escolar');
    expect(topicosDoPerfil('admin').map((t) => t.id)).toContain('admin-usuarios');
    expect(topicosDoPerfil('responsavel').map((t) => t.id)).toContain('responsavel-notas');
  });

  it('passos curtos: no máximo 5 por tópico, sem pedido de pressa nem ironia', () => {
    for (const t of TOPICOS) {
      expect(t.passos.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.passos.length, t.id).toBeLessThanOrEqual(5);
    }
    const texto = JSON.stringify(TOPICOS);
    expect(texto).not.toMatch(/rápido|urgente|corra|atrasad|rapidinho|é só/i);
  });

  it('não traz senha, endereço de acesso nem e-mail real', () => {
    const texto = JSON.stringify(TOPICOS);
    expect(texto).not.toMatch(/https?:|www\.|trycloudflare|ts\.net|localhost/i);
    for (const e of texto.match(/[\w.+-]+@[\w.-]+/g) ?? [])
      expect(e.replace(/\.$/, '')).toMatch(/@exemplo\.invalid$/);
    // Nenhuma senha escrita (uma palavra com letras e números logo depois de "senha")
    expect(texto).not.toMatch(/senha[: ]+["']?(?=[A-Za-z]*\d)[A-Za-z0-9]{8,}/);
  });

  it('A-027: o texto do professor não promete motivo da revisão a quem pediu', () => {
    const pedidos = TOPICOS.find((t) => t.id === 'professor-pedidos');
    expect(pedidos?.passos.join(' ')).toMatch(/motivo da revisão não aparece/);
  });
});

describe('tela Ajuda', () => {
  const montar = (perfil: string) => render(<Ajuda perfil={perfil} />);

  it('mostra versão e data, índice e passos numerados; passa no axe', async () => {
    const { container } = montar('aluno');
    expect(screen.getByText(new RegExp(`versão ${MANUAL_VERSAO}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(MANUAL_DATA))).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Tópicos do manual' })).toBeTruthy();
    expect(container.querySelectorAll('ol').length).toBeGreaterThan(5);
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it('a busca ignora acento e só acha tópicos do próprio perfil', async () => {
    montar('aluno');
    const caixa = screen.getByLabelText('Buscar no manual');
    await userEvent.type(caixa, 'licao');
    expect(screen.getByRole('heading', { name: /Criar uma atividade/ })).toBeTruthy();
    await userEvent.clear(caixa);
    await userEvent.type(caixa, 'lançar nota');
    expect(screen.queryByRole('heading', { name: /Lançar e revisar notas da turma/ })).toBeNull();
    expect(screen.getByText('Nenhum tópico encontrado.')).toBeTruthy();
    await userEvent.clear(caixa);
    await userEvent.type(caixa, 'xyzxyz');
    expect(screen.getByText(/Nenhum tópico para/)).toBeTruthy();
  });

  it('professor acha "motivo" nos pedidos de revisão', async () => {
    montar('professor');
    await userEvent.type(screen.getByLabelText('Buscar no manual'), 'fechar juntos');
    expect(screen.getByRole('heading', { name: /Responder pedidos de revisão/ })).toBeTruthy();
  });

  it('escolher um tópico do índice leva o foco ao título dele (teclado)', async () => {
    montar('aluno');
    const indice = screen.getByRole('navigation', { name: 'Tópicos do manual' });
    const alvo = TOPICOS.find((t) => t.id === 'foco');
    await userEvent.click(within(indice).getByRole('button', { name: alvo?.titulo ?? '' }));
    expect(document.activeElement?.textContent).toBe(alvo?.titulo);
  });
});

describe('Ajuda no menu, para todos os perfis', () => {
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
  for (const perfil of PERFIS) {
    it(`${perfil} vê o item Ajuda e o botão Ajuda no topo`, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async (url: string) =>
            new Response(
              JSON.stringify(String(url).includes('/meu-dia') ? DIA : { itens: [], nao_vistos: 0 }),
              {
                status: 200,
              },
            ),
        ),
      );
      const aoIr = vi.fn();
      const eu: Eu = { nivel: 'completo', usuario: { id: 'u', nome: 'Pessoa Fictícia', perfil } };
      render(
        <Shell eu={eu} pagina="inicio" aoIr={aoIr} aoSair={() => {}}>
          <p>x</p>
        </Shell>,
      );
      const nav = screen.getByRole('navigation', { name: 'Telas do sistema' });
      await userEvent.click(within(nav).getByRole('button', { name: /^Ajuda/ }));
      expect(aoIr).toHaveBeenCalledWith('ajuda');
      // O botão do topo também existe (aparece só no computador, por CSS)
      expect(screen.getAllByRole('button', { name: 'Ajuda' }).length).toBeGreaterThanOrEqual(2);
      // A busca do menu acha a Ajuda por "manual"
      await userEvent.type(screen.getByLabelText('Buscar no menu'), 'manual');
      expect(within(nav).getByRole('button', { name: /Ajuda/ })).toBeTruthy();
    });
  }
});
