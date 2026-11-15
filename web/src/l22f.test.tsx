// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CandidatoAtendente, PedidoSuporteEspaco, Perfil } from './api';
import { Shell } from './componentes/Shell';
import {
  AtendentesSuporte,
  diasDeEspera,
  quandoPediu,
  SuporteEspacos,
} from './paginas/SuporteEspacos';

// L22f: suporte dos espaços individuais. Fila do Master e do Admin indicado, e a tela de indicar atendentes. Fictício.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
const semContraste = { rules: { 'color-contrast': { enabled: false } } };

const hoje = new Date(2026, 10, 14, 15, 0, 0);
const iso = (diasAtras: number) => new Date(2026, 10, 14 - diasAtras, 10, 0, 0).toISOString();
const pedido = (n: number, diasAtras = 0): PedidoSuporteEspaco => ({
  pedido_id: `p${n}`,
  espaco_id: `e${n}`,
  assunto: n === 2 ? 'erro_na_tela' : 'acesso',
  texto: `Texto do pedido ${n}`,
  nome: `Família ${n}`,
  email: `familia${n}@exemplo.invalid`,
  criado_em: iso(diasAtras),
});

describe('tempo concreto do pedido (L22f)', () => {
  it('diz hoje, ontem ou há N dias, com o dia/mês', () => {
    expect(quandoPediu(iso(0), hoje)).toBe('hoje, 14/11');
    expect(quandoPediu(iso(1), hoje)).toBe('ontem, 13/11');
    expect(quandoPediu(iso(3), hoje)).toBe('há 3 dias, 11/11');
    expect(diasDeEspera(iso(0), hoje)).toBe(0);
    expect(diasDeEspera(iso(3), hoje)).toBe(3);
  });
});

describe('fila de pedidos (L22f)', () => {
  it('mostra cartões com assunto, texto, nome e e-mail; sem tabela; passa no axe', async () => {
    const { container } = render(
      <SuporteEspacos
        nivel="h2"
        carregar={async () => [pedido(1, 3), pedido(2, 0)]}
        atender={async () => undefined}
      />,
    );
    expect(await screen.findByText('Texto do pedido 1')).toBeTruthy();
    expect(screen.getByText('Texto do pedido 2')).toBeTruthy();
    expect(screen.getByText(/Família 1 · familia1@exemplo.invalid/)).toBeTruthy();
    expect(screen.getByText('Não consigo entrar')).toBeTruthy();
    expect(screen.getByText('Apareceu um erro')).toBeTruthy();
    expect(screen.getByText(/2/, { selector: 'strong' })).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('sem pedidos: texto simples', async () => {
    render(<SuporteEspacos nivel="h1" carregar={async () => []} atender={async () => undefined} />);
    expect(await screen.findByText('Nenhum pedido esperando.')).toBeTruthy();
  });

  it('marcar como atendido pede confirmação, avisa com palavras e leva o foco ao título', async () => {
    let fila = [pedido(1, 1)];
    const atender = vi.fn(async (p: PedidoSuporteEspaco) => {
      fila = fila.filter((x) => x.pedido_id !== p.pedido_id);
    });
    render(<SuporteEspacos nivel="h1" carregar={async () => fila} atender={atender} />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Marcar como atendido: Família 1/ }));
    expect(atender).not.toHaveBeenCalled(); // ainda só pediu a confirmação
    await u.click(screen.getByRole('button', { name: 'Não' }));
    expect(atender).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: /Marcar como atendido: Família 1/ }));
    await u.click(screen.getByRole('button', { name: 'Sim, marcar como atendido' }));
    await waitFor(() =>
      expect(atender).toHaveBeenCalledWith(
        expect.objectContaining({ pedido_id: 'p1', espaco_id: 'e1' }),
      ),
    );
    expect(await screen.findByText(/Pedido marcado como atendido/)).toBeTruthy();
    expect(await screen.findByText('Nenhum pedido esperando.')).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Suporte dos espaços individuais' }),
    );
  });

  it('erro da API aparece em palavras', async () => {
    render(
      <SuporteEspacos
        nivel="h1"
        carregar={async () => {
          throw new Error('x');
        }}
        atender={async () => undefined}
      />,
    );
    expect(await screen.findByText(/Não foi possível abrir a fila de pedidos/)).toBeTruthy();
  });
});

const admin = (indicado: boolean, nome = 'Admin Um'): CandidatoAtendente => ({
  instituicao_id: 'i1',
  instituicao_nome: 'Escola Fictícia',
  usuario_id: nome,
  nome,
  email: 'admin@exemplo.invalid',
  indicado,
});

describe('atendentes do suporte, no console do Master (L22f)', () => {
  function simular(lista: CandidatoAtendente[]) {
    const chamadas: { url: string; metodo: string; corpo?: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        chamadas.push({
          url,
          metodo: init?.method ?? 'GET',
          corpo: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        if (url.endsWith('/suporte-atendentes') && (init?.method ?? 'GET') === 'GET')
          return new Response(JSON.stringify({ admins: lista }), { status: 200 });
        if (url.endsWith('/indicar')) lista = lista.map((a) => ({ ...a, indicado: true }));
        return new Response(null, { status: 204 });
      }),
    );
    return chamadas;
  }

  it('lista os Admins, mostra quantos estão indicados e passa no axe', async () => {
    simular([admin(true, 'Admin Um'), admin(false, 'Admin Dois')]);
    const { container } = render(<AtendentesSuporte aoSair={() => undefined} />);
    expect(await screen.findByText('Admin Um')).toBeTruthy();
    expect(screen.getByText('Indicado como atendente')).toBeTruthy();
    expect(screen.getByText('Não indicado')).toBeTruthy();
    expect(screen.getByText(/1/, { selector: 'strong' })).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('indicar pede confirmação em texto e só então envia', async () => {
    const chamadas = simular([admin(false, 'Admin Dois')]);
    render(<AtendentesSuporte aoSair={() => undefined} />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Indicar Admin Dois/ }));
    expect(screen.getByText(/passa a ler nome, e-mail e texto/)).toBeTruthy();
    expect(chamadas.some((c) => c.url.endsWith('/indicar'))).toBe(false);
    await u.click(screen.getByRole('button', { name: 'Sim, indicar' }));
    await waitFor(() => expect(chamadas.some((c) => c.url.endsWith('/indicar'))).toBe(true));
    const envio = chamadas.find((c) => c.url.endsWith('/indicar'));
    expect(envio?.corpo).toEqual({ instituicao_id: 'i1', usuario_id: 'Admin Dois' });
    expect(await screen.findByText(/agora atende o suporte/)).toBeTruthy();
  });
});

describe('menu do Admin (L22f)', () => {
  it.each([
    ['admin', true, true],
    ['admin', false, false],
    ['admin', undefined, false],
    ['professor', true, false],
    ['pedagogico', true, false],
    ['aluno', true, false],
    ['responsavel', true, false],
  ] as [Perfil, boolean | undefined, boolean][])(
    'perfil %s, indicado=%s: "Suporte dos espaços" aparece = %s',
    (perfil, indicado, aparece) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () => new Response(JSON.stringify({ itens: [], nao_vistos: 0 }), { status: 200 }),
        ),
      );
      render(
        <Shell
          eu={{
            nivel: 'completo',
            usuario: { id: 'u', nome: 'Pessoa Fictícia', perfil },
            modulos: { mensagens: true, calendario: true, apoio_aluno: true },
            espaco: 'escola',
            atendente_suporte: indicado,
          }}
          pagina="inicio"
          aoIr={() => undefined}
          aoSair={() => undefined}
        >
          <p>conteúdo</p>
        </Shell>,
      );
      const menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
      expect(within(menu).queryByRole('button', { name: 'Suporte dos espaços' }) !== null).toBe(
        aparece,
      );
    },
  );
});
