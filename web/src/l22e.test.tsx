// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventoAuditoriaEscola, Perfil } from './api';
import { topicosDosPrimeirosPassos } from './componentes/PrimeirosPassos';
import { Shell } from './componentes/Shell';
import { AuditoriaEscola, quando } from './paginas/AuditoriaEscola';

// L22e: Auditoria da escola para o Admin. Só leitura, em frases, sem conteúdo. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
const semContraste = { rules: { 'color-contrast': { enabled: false } } };

const ev = (seq: number, frase: string, quem = 'Admin Fictício'): EventoAuditoriaEscola => ({
  seq,
  quando: '2026-11-14T15:32:00.000Z',
  quem,
  perfil: 'Administração',
  frase,
});

function simular(paginas: {
  primeira: { integra: boolean | null; tem_mais: boolean; eventos: EventoAuditoriaEscola[] };
  proxima?: { integra: boolean | null; tem_mais: boolean; eventos: EventoAuditoriaEscola[] };
  status?: number;
}) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url);
      if (paginas.status)
        return new Response(JSON.stringify({ erro: 'Sem permissão.' }), { status: paginas.status });
      const corpo = url.includes('antes=') ? paginas.proxima : paginas.primeira;
      return new Response(JSON.stringify(corpo), { status: 200 });
    }),
  );
  return urls;
}

describe('Auditoria da escola: tela (L22e)', () => {
  it('mostra os registros em frases, com a cadeia íntegra, e passa no axe', async () => {
    simular({
      primeira: {
        integra: true,
        tem_mais: false,
        eventos: [ev(3, 'Desativou a conta de Aluno Fictício'), ev(2, 'Entrou no sistema')],
      },
    });
    const { container } = render(<AuditoriaEscola />);
    expect(await screen.findByText('Desativou a conta de Aluno Fictício')).toBeTruthy();
    expect(screen.getByText(/Cadeia íntegra: sim/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Auditoria' })).toBeTruthy();
    expect(screen.getAllByText(/Admin Fictício \(Administração\)/)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /mais antigos/ })).toBeNull();
    // Só leitura: nenhum botão que muda algo
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('avisa com palavras quando a cadeia não está íntegra', async () => {
    simular({ primeira: { integra: false, tem_mais: false, eventos: [ev(1, 'Criou uma turma')] } });
    render(<AuditoriaEscola />);
    expect(await screen.findByText(/Cadeia íntegra: não/)).toBeTruthy();
    expect(screen.getByText(/Avise o Master/)).toBeTruthy();
  });

  it('"Ver registros mais antigos" pede a página seguinte pelo número do último registro e soma à lista', async () => {
    const urls = simular({
      primeira: {
        integra: true,
        tem_mais: true,
        eventos: [ev(9, 'Criou uma turma'), ev(8, 'Saiu do sistema')],
      },
      proxima: { integra: null, tem_mais: false, eventos: [ev(7, 'Criou um aviso')] },
    });
    render(<AuditoriaEscola />);
    await screen.findByText('Criou uma turma');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ver registros mais antigos' }));
    expect(await screen.findByText('Criou um aviso')).toBeTruthy();
    expect(urls).toEqual(['/api/auditoria', '/api/auditoria?antes=8']);
    expect(screen.getByText('Criou uma turma')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /mais antigos/ })).toBeNull();
    // A faixa de integridade continua a da primeira página
    expect(screen.getByText(/Cadeia íntegra: sim/)).toBeTruthy();
  });

  it('mostra a mensagem da API quando o perfil não pode ver', async () => {
    simular({ primeira: { integra: true, tem_mais: false, eventos: [] }, status: 403 });
    render(<AuditoriaEscola />);
    expect(await screen.findByText('Sem permissão.')).toBeTruthy();
  });

  it('sem registros, diz isso com palavras', async () => {
    simular({ primeira: { integra: true, tem_mais: false, eventos: [] } });
    render(<AuditoriaEscola />);
    expect(await screen.findByText('Nenhum registro ainda.')).toBeTruthy();
  });
});

describe('quando(): tempo concreto (L22e)', () => {
  const agora = new Date(2026, 10, 14, 20, 0);
  it('usa hoje, ontem e dia/mês, com a parte do dia e a hora só como detalhe', () => {
    expect(quando(new Date(2026, 10, 14, 15, 32).toISOString(), agora)).toBe(
      'hoje, 14/11 · tarde (15:32)',
    );
    expect(quando(new Date(2026, 10, 13, 9, 5).toISOString(), agora)).toBe(
      'ontem, 13/11 · manhã (09:05)',
    );
    expect(quando(new Date(2026, 10, 2, 22, 0).toISOString(), agora)).toBe('02/11 · noite (22:00)');
  });
});

describe('menu: Auditoria só para o Admin (L22e)', () => {
  const perfis: Perfil[] = ['aluno', 'professor', 'pedagogico', 'admin', 'responsavel'];
  it.each(perfis)('%s', (perfil) => {
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
        }}
        pagina="inicio"
        aoIr={() => undefined}
        aoSair={() => undefined}
      >
        <p>conteúdo</p>
      </Shell>,
    );
    const menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
    expect(within(menu).queryByRole('button', { name: 'Auditoria' }) !== null).toBe(
      perfil === 'admin',
    );
  });

  it('os Primeiros passos do Admin continuam os mesmos; o tópico novo fica na Ajuda', async () => {
    const ids = topicosDosPrimeirosPassos('admin').map((t) => t.id);
    expect(ids).not.toContain('admin-auditoria');
    await waitFor(() => expect(ids.length).toBeGreaterThan(0));
  });
});
