// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Eu } from './api';
import { AjustesInterface } from './componentes/AjustesInterface';
import { Shell } from './componentes/Shell';
import { BotaoVLibras } from './componentes/VLibras';
import { carregarInterface, INTERFACE_PADRAO, type Interface, salvarInterface } from './interface';
import { Acessibilidade } from './paginas/Acessibilidade';
import { PREFERENCIAS_PADRAO } from './preferencias';

// L17d: rótulos do topo (ícones ou texto), chave do menu, "?" de ajuda e VLibras com aviso. Dados fictícios.
const semContraste = { rules: { 'color-contrast': { enabled: false } } };
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
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const corpo = String(url).includes('/meu-dia') ? DIA : { itens: [], nao_vistos: 0 };
      return new Response(JSON.stringify(corpo), { status: 200 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.head.querySelector('#siesal-vlibras-script')?.remove();
});

const PERFIS: Eu['usuario']['perfil'][] = [
  'admin',
  'professor',
  'aluno',
  'pedagogico',
  'responsavel',
];
const euDe = (perfil: Eu['usuario']['perfil']): Eu => ({
  nivel: 'completo',
  usuario: { id: 'u1', nome: 'Pessoa Fictícia', perfil },
});

describe('topo: chave do menu e "?" nos 5 perfis', () => {
  it.each(PERFIS)(
    '%s: chave "Menu lateral", Ajuda e Sair com nome acessível; axe sem violações',
    async (perfil) => {
      const aoIr = vi.fn();
      const { container } = render(
        <Shell eu={euDe(perfil)} pagina="inicio" aoIr={aoIr} aoSair={() => undefined}>
          <p>conteúdo</p>
        </Shell>,
      );
      const topo = container.querySelector('header') as HTMLElement;
      expect(within(topo).getByRole('switch', { name: 'Menu lateral' })).toBeTruthy();
      await userEvent.click(within(topo).getByRole('button', { name: 'Ajuda' }));
      expect(aoIr).toHaveBeenCalledWith('ajuda');
      expect(within(topo).getByRole('button', { name: 'Sair' })).toBeTruthy();
      await waitFor(() => expect(container.querySelector('.sinos')).toBeTruthy());
      const r = await axe.run(container, semContraste);
      expect(r.violations.map((v) => v.id)).toEqual([]);
    },
  );

  it('padrão: ícones (o texto fica escondido); em "texto" o topo mostra as palavras', () => {
    const { container, rerender } = render(
      <Shell eu={euDe('aluno')} pagina="meudia" aoIr={() => undefined} aoSair={() => undefined}>
        <p>x</p>
      </Shell>,
    );
    expect(container.querySelector('header')?.className).toContain('rotulos-icones');
    rerender(
      <Shell
        eu={euDe('aluno')}
        pagina="meudia"
        aoIr={() => undefined}
        aoSair={() => undefined}
        rotulos="texto"
      >
        <p>x</p>
      </Shell>,
    );
    expect(container.querySelector('header')?.className).toContain('rotulos-texto');
    // O nome acessível é o mesmo nos dois modos
    const topo = container.querySelector('header') as HTMLElement;
    expect(within(topo).getByRole('button', { name: 'Ajuda' })).toBeTruthy();
  });
});

// Acessibilidade com estado de verdade, para ver o que a troca grava
function Pagina() {
  const [i, setI] = useState<Interface>(INTERFACE_PADRAO);
  return (
    <>
      <Acessibilidade
        valor={PREFERENCIAS_PADRAO}
        aoMudar={() => undefined}
        interfaceAtual={i}
        aoMudarInterface={setI}
      />
      <output data-testid="estado">{JSON.stringify(i)}</output>
    </>
  );
}

describe('preferências de interface', () => {
  it('padrão: ícones, VLibras mostrado e aviso ainda não aceito; guarda e lê neste aparelho', () => {
    expect(carregarInterface()).toEqual(INTERFACE_PADRAO);
    const p: Interface = { rotulos: 'texto', vlibras: false, vlibras_aviso_aceito: true };
    salvarInterface(p);
    expect(carregarInterface()).toEqual(p);
    localStorage.setItem('siesal-interface-v1', '{quebrado');
    expect(carregarInterface()).toEqual(INTERFACE_PADRAO);
  });

  it('Acessibilidade troca para texto e desliga o VLibras; axe sem violações', async () => {
    const { container } = render(<Pagina />);
    await userEvent.click(screen.getByRole('radio', { name: 'Ícones com texto' }));
    const chave = screen.getByRole('switch', { name: 'Mostrar o VLibras (Libras)' });
    expect(chave.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(chave);
    expect(JSON.parse(screen.getByTestId('estado').textContent ?? '')).toEqual({
      rotulos: 'texto',
      vlibras: false,
      vlibras_aviso_aceito: false,
    });
    const r = await axe.run(container, semContraste);
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it('o controle sozinho também passa no axe', async () => {
    const { container } = render(
      <AjustesInterface valor={INTERFACE_PADRAO} aoMudar={() => undefined} />,
    );
    const r = await axe.run(container, semContraste);
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

describe('VLibras (A-037)', () => {
  it('aparece por padrão; o primeiro clique mostra o aviso e nada é carregado antes de "Ativar"', async () => {
    const aceitar = vi.fn();
    const { container } = render(<BotaoVLibras ligado avisoAceito={false} aoAceitar={aceitar} />);
    const botao = screen.getByRole('button', { name: 'Libras: tradução com o VLibras' });
    await userEvent.click(botao);
    const aviso = screen.getByRole('dialog', { name: 'Tradução para Libras (VLibras)' });
    expect(aviso.textContent).toContain('vlibras.gov.br');
    expect(aviso.textContent).toContain('usuário e senha');
    expect(document.querySelector('#siesal-vlibras-script')).toBeNull();
    // O foco vai para o primeiro botão do aviso
    expect(document.activeElement?.textContent).toBe('Ativar VLibras');
    const r = await axe.run(container, semContraste);
    expect(r.violations.map((v) => v.id)).toEqual([]);
    // "Agora não" fecha, devolve o foco e não muda nada
    await userEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(botao);
    expect(aceitar).not.toHaveBeenCalled();
    expect(document.querySelector('#siesal-vlibras-script')).toBeNull();
  });

  it('Esc fecha o aviso', async () => {
    render(<BotaoVLibras ligado avisoAceito={false} aoAceitar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Libras: tradução com o VLibras' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Ativar VLibras" grava o aceite e só então pede o script oficial', async () => {
    const aceitar = vi.fn();
    render(<BotaoVLibras ligado avisoAceito={false} aoAceitar={aceitar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Libras: tradução com o VLibras' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ativar VLibras' }));
    expect(aceitar).toHaveBeenCalledOnce();
    const s = document.querySelector('#siesal-vlibras-script') as HTMLScriptElement;
    expect(s.src).toBe('https://vlibras.gov.br/app/vlibras-plugin.js');
  });

  it('desligado: não mostra o ícone e esconde o widget', () => {
    const widget = document.createElement('div');
    widget.id = 'vlibras-access-wrapper';
    document.body.append(widget);
    const { container } = render(
      <BotaoVLibras ligado={false} avisoAceito aoAceitar={() => undefined} />,
    );
    expect(container.textContent).toBe('');
    expect(widget.style.display).toBe('none');
    widget.remove();
  });
});
