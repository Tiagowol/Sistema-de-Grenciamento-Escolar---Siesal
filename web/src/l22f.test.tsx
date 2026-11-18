// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CandidatoAtendente, FuncaoIndicada, PedidoSuporteEspaco, Perfil } from './api';
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

const admin = (funcoes: FuncaoIndicada[], nome = 'Admin Um'): CandidatoAtendente => ({
  instituicao_id: 'i1',
  instituicao_nome: 'Escola Fictícia',
  usuario_id: nome,
  nome,
  email: 'admin@exemplo.invalid',
  funcoes,
});

// Cartão de um Admin (o nome do grupo vem da legenda; aqui se acha pelo nome no cartão)
const cartaoDe = (nome: string) => screen.getByText(nome).closest('li') as HTMLElement;
const achar = async (nome: string) => (await screen.findByText(nome)).closest('li') as HTMLElement;

// L22k: a tela do Master passou a ser "Admins indicados", com uma chave por função
describe('Admins indicados por função, no console do Master (L22k)', () => {
  function simular(lista: CandidatoAtendente[]) {
    const chamadas: { url: string; metodo: string; corpo?: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const corpo = init?.body ? JSON.parse(String(init.body)) : undefined;
        chamadas.push({ url, metodo: init?.method ?? 'GET', corpo });
        if (url.endsWith('/admins-indicados') && (init?.method ?? 'GET') === 'GET')
          return new Response(JSON.stringify({ admins: lista }), { status: 200 });
        const f = (corpo as { funcao: FuncaoIndicada }).funcao;
        if (url.endsWith('/indicar'))
          lista = lista.map((a) => ({ ...a, funcoes: [...a.funcoes, f] }));
        if (url.endsWith('/retirar'))
          lista = lista.map((a) => ({ ...a, funcoes: a.funcoes.filter((x) => x !== f) }));
        return new Response(null, { status: 204 });
      }),
    );
    return chamadas;
  }

  it('lista os Admins com o que cada um faz em palavras e uma chave por função; passa no axe', async () => {
    simular([
      admin(['pedido_convite', 'suporte_individual'], 'Admin Um'),
      admin(['pedido_convite'], 'Admin Dois'),
      admin([], 'Admin Tres'),
    ]);
    const { container } = render(<AtendentesSuporte aoSair={() => undefined} />);
    expect(await screen.findByRole('heading', { name: 'Admins indicados' })).toBeTruthy();
    expect(screen.getByText('Faz as duas: pedidos de suporte e pedidos de convite.')).toBeTruthy();
    expect(screen.getByText('Só pedidos de convite.')).toBeTruthy();
    expect(screen.getByText('Nenhuma função.')).toBeTruthy();
    const dois = cartaoDe('Admin Dois');
    const convite = within(dois).getByRole('switch', { name: 'Pedidos de convite' });
    const suporte = within(dois).getByRole('switch', { name: 'Pedidos de suporte dos espaços' });
    expect((convite as HTMLInputElement).checked).toBe(true);
    expect((suporte as HTMLInputElement).checked).toBe(false);
    expect(container.querySelector('table')).toBeNull();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('ligar uma função pede confirmação em texto e só então envia a função escolhida', async () => {
    const chamadas = simular([admin([], 'Admin Dois')]);
    render(<AtendentesSuporte aoSair={() => undefined} />);
    const u = userEvent.setup();
    const grupo = await achar('Admin Dois');
    await u.click(within(grupo).getByRole('switch', { name: 'Pedidos de convite' }));
    expect(screen.getByText(/passa a ler nome, e-mail e motivo/)).toBeTruthy();
    expect(chamadas.some((c) => c.url.endsWith('/indicar'))).toBe(false);
    await u.click(screen.getByRole('button', { name: 'Sim, indicar' }));
    await waitFor(() => expect(chamadas.some((c) => c.url.endsWith('/indicar'))).toBe(true));
    expect(chamadas.find((c) => c.url.endsWith('/indicar'))?.corpo).toEqual({
      instituicao_id: 'i1',
      usuario_id: 'Admin Dois',
      funcao: 'pedido_convite',
    });
    expect(await screen.findByText('Admin Dois agora cuida de: Pedidos de convite.')).toBeTruthy();
    expect(screen.getByText('Só pedidos de convite.')).toBeTruthy();
  });

  it('desligar uma função pede confirmação; "Não" cancela sem enviar', async () => {
    const chamadas = simular([admin(['pedido_convite', 'suporte_individual'], 'Admin Um')]);
    render(<AtendentesSuporte aoSair={() => undefined} />);
    const u = userEvent.setup();
    const grupo = await achar('Admin Um');
    await u.click(within(grupo).getByRole('switch', { name: 'Pedidos de suporte dos espaços' }));
    expect(screen.getByText(/cortado na hora/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Não' }));
    expect(chamadas.some((c) => c.url.endsWith('/retirar'))).toBe(false);
    await u.click(within(grupo).getByRole('switch', { name: 'Pedidos de suporte dos espaços' }));
    await u.click(screen.getByRole('button', { name: 'Sim, retirar' }));
    await waitFor(() =>
      expect(chamadas.find((c) => c.url.endsWith('/retirar'))?.corpo).toEqual({
        instituicao_id: 'i1',
        usuario_id: 'Admin Um',
        funcao: 'suporte_individual',
      }),
    );
    expect(await screen.findByText('Só pedidos de convite.')).toBeTruthy();
  });
});

type Caso = [Perfil, FuncaoIndicada[] | undefined, boolean, boolean];
const CASOS: Caso[] = [
  ['admin', ['suporte_individual', 'pedido_convite'], true, true],
  ['admin', ['suporte_individual'], true, false],
  ['admin', ['pedido_convite'], false, true],
  ['admin', [], false, false],
  ['admin', undefined, false, false],
  ['professor', ['suporte_individual', 'pedido_convite'], false, false],
  ['pedagogico', ['suporte_individual', 'pedido_convite'], false, false],
  ['aluno', ['suporte_individual', 'pedido_convite'], false, false],
  ['responsavel', ['suporte_individual', 'pedido_convite'], false, false],
];

describe('menu do Admin por função (L22f e L22k)', () => {
  it.each(CASOS)(
    'perfil %s, funções %s: suporte aparece = %s, convite aparece = %s',
    (perfil, funcoes, suporte, convite) => {
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
            funcoes_indicadas: funcoes,
          }}
          pagina="inicio"
          aoIr={() => undefined}
          aoSair={() => undefined}
        >
          <p>conteúdo</p>
        </Shell>,
      );
      const menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
      const temSuporte = within(menu).queryByRole('button', { name: 'Suporte dos espaços' });
      const temConvite = within(menu).queryByRole('button', { name: 'Pedidos de convite' });
      expect(temSuporte !== null).toBe(suporte);
      expect(temConvite !== null).toBe(convite);
    },
  );
});
