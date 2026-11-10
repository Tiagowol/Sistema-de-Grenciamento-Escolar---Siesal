// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Caixa, Eu, MeuDia } from './api';
import { Shell } from './componentes/Shell';
import { contarPrazos } from './componentes/Sinos';
import css from './estilos/extra.css?raw';
import { Avisos } from './paginas/Avisos';
import { AvisosEscola } from './paginas/AvisosEscola';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const euDe = (perfil: Eu['usuario']['perfil']): Eu => ({
  nivel: 'completo',
  usuario: { id: 'u1', nome: 'Pessoa Fictícia', perfil },
});

// Responde às rotas das telas e guarda as chamadas de escrita
function simular(dados: Record<string, unknown>) {
  const escritas: { url: string; corpo: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const caminho = url.replace('/api', '');
      if (init?.method === 'POST') {
        escritas.push({ url: caminho, corpo: init.body ? JSON.parse(String(init.body)) : null });
        const resposta = dados[`POST ${caminho}`];
        return resposta === undefined
          ? new Response(null, { status: 204 })
          : new Response(JSON.stringify(resposta), { status: 201 });
      }
      return new Response(JSON.stringify(dados[caminho] ?? {}), {
        status: dados[caminho] ? 200 : 404,
      });
    }),
  );
  return escritas;
}

const hoje = new Date();
const dia = (n: number) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const CAIXA_RESPOSTAS: Caixa = {
  nao_vistos: 2,
  itens: [
    {
      tipo: 'resposta',
      id: 'r1',
      visto: false,
      dia: dia(0),
      estado: 'revisada',
      motivo: '',
      aluno_nome: 'Aluna Fictícia',
      disciplina_nome: 'Matemática',
      nota_descricao: 'Prova 1',
      valor_atual: 8.3,
    },
    {
      tipo: 'resposta',
      id: 'r2',
      visto: false,
      dia: dia(-1),
      estado: 'mantida',
      motivo: 'A correção está certa.',
      aluno_nome: 'Aluna Fictícia',
      disciplina_nome: 'Ciências',
      nota_descricao: 'Trabalho',
      valor_atual: 6,
    },
    {
      tipo: 'aviso',
      id: 'a1',
      visto: true,
      dia: dia(-3),
      escopo: 'turma',
      turma_nome: '7º A',
      texto: 'Reunião da turma na sexta.',
      autor_nome: 'Pedagoga Fictícia',
    },
  ],
};

const MEU_DIA: MeuDia = {
  hoje: dia(0),
  atrasadas: [
    {
      id: 't0',
      titulo: 'Leitura do capítulo 2',
      disciplina: 'Português',
      prazo: dia(-2),
      prioridade: 'media',
      situacao: 'pendente',
      etapas: 0,
      etapas_feitas: 0,
    },
  ],
  para_hoje: [
    {
      id: 't1',
      titulo: 'Lista de exercícios',
      disciplina: 'Matemática',
      prazo: dia(0),
      prioridade: 'alta',
      situacao: 'pendente',
      etapas: 0,
      etapas_feitas: 0,
    },
  ],
  proximas: [
    {
      id: 't2',
      titulo: 'Resumo de História',
      disciplina: 'História',
      prazo: dia(1),
      prioridade: 'media',
      situacao: 'pendente',
      etapas: 0,
      etapas_feitas: 0,
    },
    {
      id: 't3',
      titulo: 'Maquete',
      disciplina: 'Ciências',
      prazo: dia(4),
      prioridade: 'baixa',
      situacao: 'pendente',
      etapas: 0,
      etapas_feitas: 0,
    },
    {
      id: 't4',
      titulo: 'Tarefa sem prazo',
      disciplina: '',
      prazo: null,
      prioridade: 'baixa',
      situacao: 'pendente',
      etapas: 0,
      etapas_feitas: 0,
    },
  ],
  eventos: [],
  minutos_estudados_hoje: 0,
  sessao_atual: null,
  tarefas_concluidas: 0,
  tarefas_total: 4,
};

const ir = vi.fn();
const montar = (perfil: Eu['usuario']['perfil']) =>
  render(
    <Shell eu={euDe(perfil)} pagina="inicio" aoIr={ir} aoSair={() => undefined}>
      <p>Conteúdo</p>
    </Shell>,
  );
const semContraste = { rules: { 'color-contrast': { enabled: false } } };

describe('sino Mensagens', () => {
  it('tem nome claro com a contagem, rótulo e ícone visíveis, e some a contagem ao abrir', async () => {
    const escritas = simular({ '/caixa': CAIXA_RESPOSTAS, 'POST /caixa/vistos': { marcados: 2 } });
    const u = userEvent.setup();
    montar('aluno');
    const sino = await screen.findByRole('button', { name: 'Mensagens, 2 não vistas' });
    expect(sino.textContent).toContain('Mensagens'); // rótulo visível, não só a cor
    expect(sino.querySelector('svg')).not.toBeNull(); // ícone visível
    expect(sino.getAttribute('aria-expanded')).toBe('false');
    await u.click(sino);
    expect(sino.getAttribute('aria-expanded')).toBe('true');
    // A caixa mostra o estado, a nota atual e a data em dia/mês
    expect(await screen.findAllByText(/Nota atual: 8,3 de 10/)).toHaveLength(1);
    expect(screen.getByText(/Nota atual: 6,0 de 10/)).toBeTruthy();
    expect(screen.getAllByText('Novo').length).toBe(2); // o texto "Novo" marca o que não tinha sido visto
    expect(screen.getByText('Reunião da turma na sexta.')).toBeTruthy();
    await waitFor(() => expect(escritas.map((e) => e.url)).toContain('/caixa/vistos'));
    // Depois de abrir, a contagem é zero
    expect(
      await screen.findByRole('button', { name: 'Mensagens, nenhuma não vista' }),
    ).toBeTruthy();
  });

  it('só o motivo de "mantida" aparece; o motivo da revisão e versões antigas nunca chegam à tela', async () => {
    simular({ '/caixa': CAIXA_RESPOSTAS, 'POST /caixa/vistos': { marcados: 2 } });
    const u = userEvent.setup();
    montar('pedagogico');
    await u.click(await screen.findByRole('button', { name: /^Mensagens/ }));
    expect(await screen.findByText(/Motivo do professor: A correção está certa\./)).toBeTruthy();
    expect(screen.getAllByText(/Motivo do professor/)).toHaveLength(1);
    expect(screen.queryByText(/versão/i)).toBeNull();
    expect(screen.queryByText(/histórico/i)).toBeNull();
  });

  it('professor vê o pedido aberto e pode ir responder', async () => {
    simular({
      '/caixa': {
        nao_vistos: 1,
        itens: [
          {
            tipo: 'pedido_aberto',
            id: 'p1',
            visto: false,
            dia: dia(-1),
            perfil_pedinte: 'aluno',
            pedinte_nome: 'Aluna Fictícia',
            texto: 'Acho que faltou somar a questão 4.',
            aluno_nome: 'Aluna Fictícia',
            turma_nome: '7º A',
            disciplina_nome: 'Matemática',
            nota_descricao: 'Prova 1',
            valor_atual: 7.5,
            pode_responder: true,
          },
        ],
      } satisfies Caixa,
      'POST /caixa/vistos': { marcados: 1 },
    });
    const u = userEvent.setup();
    ir.mockClear();
    montar('professor');
    await u.click(await screen.findByRole('button', { name: 'Mensagens, 1 não vista' }));
    expect(await screen.findByText('Acho que faltou somar a questão 4.')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Responder' }));
    expect(ir).toHaveBeenCalledWith('notasprof');
  });

  it('abre pelo teclado, Esc fecha e o foco volta ao botão', async () => {
    simular({ '/caixa': CAIXA_RESPOSTAS, 'POST /caixa/vistos': { marcados: 2 } });
    const u = userEvent.setup();
    montar('aluno');
    const sino = await screen.findByRole('button', { name: /^Mensagens/ });
    await u.tab(); // pula o link "Ir para o conteúdo" até chegar no sino
    sino.focus();
    await u.keyboard('{Enter}');
    expect(sino.getAttribute('aria-expanded')).toBe('true');
    await screen.findByRole('region', { name: 'Mensagens' });
    // Tab entra no painel; Esc fecha e devolve o foco
    await u.tab();
    expect(document.activeElement).not.toBe(sino);
    await u.keyboard('{Escape}');
    expect(sino.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(sino);
    expect(screen.queryByRole('region', { name: 'Mensagens' })).toBeNull();
  });

  it('sem caixa carregada, avisa sem quebrar e a contagem fica em zero', async () => {
    simular({});
    const u = userEvent.setup();
    montar('responsavel');
    const sino = await screen.findByRole('button', { name: 'Mensagens, nenhuma não vista' });
    await u.click(sino);
    expect(await screen.findByText(/Não foi possível carregar as mensagens/)).toBeTruthy();
  });

  it('painel aberto não tem violações do axe', async () => {
    simular({ '/caixa': CAIXA_RESPOSTAS, 'POST /caixa/vistos': { marcados: 2 } });
    const u = userEvent.setup();
    const { container } = montar('aluno');
    await u.click(await screen.findByRole('button', { name: /^Mensagens/ }));
    await screen.findByText('Reunião da turma na sexta.');
    const r = await axe.run(container, semContraste);
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

describe('sino Prazos', () => {
  it('só o aluno vê; os outros perfis não têm o sino de prazos', async () => {
    simular({ '/caixa': { itens: [], nao_vistos: 0 }, '/meu-dia': MEU_DIA });
    montar('professor');
    await screen.findByRole('button', { name: /^Mensagens/ });
    expect(screen.queryByRole('button', { name: /^Prazos/ })).toBeNull();
    cleanup();
    montar('aluno');
    expect(await screen.findByRole('button', { name: /^Prazos/ })).toBeTruthy();
  });

  it('conta só as atividades com prazo hoje ou amanhã e anuncia no nome', async () => {
    expect(contarPrazos(MEU_DIA)).toBe(2);
    simular({ '/caixa': { itens: [], nao_vistos: 0 }, '/meu-dia': MEU_DIA });
    montar('aluno');
    const sino = await screen.findByRole('button', {
      name: 'Prazos, 2 atividades para hoje ou amanhã',
    });
    expect(sino.textContent).toContain('Prazos');
    expect(sino.querySelector('svg')).not.toBeNull();
  });

  it('mostra hoje, amanhã e próximos dias com palavra, data em dia/mês e forma; o que passou fica neutro', async () => {
    simular({ '/caixa': { itens: [], nao_vistos: 0 }, '/meu-dia': MEU_DIA });
    const u = userEvent.setup();
    montar('aluno');
    await u.click(await screen.findByRole('button', { name: /^Prazos/ }));
    const painel = await screen.findByRole('region', { name: 'Prazos das atividades' });
    expect(painel.textContent).toContain('Lista de exercícios');
    expect(painel.textContent).toContain('Resumo de História');
    expect(painel.textContent).toContain('Maquete');
    expect(painel.textContent).not.toContain('Tarefa sem prazo');
    expect(painel.textContent).toMatch(/hoje/);
    expect(painel.textContent).toMatch(/amanhã/);
    expect(painel.textContent).toMatch(/\d{2}\/\d{2}/);
    expect(painel.querySelector('.tempo-blocos')).not.toBeNull();
    // Sem "atrasado" como alerta: nenhum texto de atraso e nenhum estilo de prazo vencido
    expect(painel.textContent).not.toMatch(/atrasad|venc|perdeu|urgente/i);
    expect(painel.querySelector('.passou')).toBeNull();
    expect(painel.textContent).toContain('Ainda abertas, com prazo anterior');
    expect(painel.textContent).toContain('Leitura do capítulo 2');
    await u.click(screen.getByRole('button', { name: 'Ver todas as atividades' }));
    expect(ir).toHaveBeenCalledWith('atividades');
  });

  it('Esc fecha e devolve o foco; painel aberto não tem violações do axe', async () => {
    simular({ '/caixa': { itens: [], nao_vistos: 0 }, '/meu-dia': MEU_DIA });
    const u = userEvent.setup();
    const { container } = montar('aluno');
    const sino = await screen.findByRole('button', { name: /^Prazos/ });
    await u.click(sino);
    await screen.findByRole('region', { name: 'Prazos das atividades' });
    const r = await axe.run(container, semContraste);
    expect(r.violations.map((v) => v.id)).toEqual([]);
    await u.keyboard('{Escape}');
    expect(sino.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(sino);
  });
});

describe('contraste dos dois sinos (WCAG 2.2 AA)', () => {
  const bloco = (seletor: string) => {
    const m = css.match(new RegExp(`${seletor}\\s*\\{([^}]*)\\}`));
    return m?.[1] ?? '';
  };
  const cor = (texto: string, nome: string) =>
    texto.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`))?.[1] as string;
  const luz = (hex: string) => {
    const c = [1, 3, 5].map((i) => {
      const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
  };
  const razao = (a: string, b: string) => {
    const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
    return ((x as number) + 0.05) / ((y as number) + 0.05);
  };
  // Fundos do topo e do painel em cada tema (--panel de prototipo.css)
  const temas = [
    { nome: 'claro', vars: bloco(':root'), fundo: '#ffffff' },
    { nome: 'escuro', vars: bloco('body\\.dark'), fundo: '#152940' },
  ];
  for (const t of temas) {
    for (const [sigla, nome] of [
      ['msg', 'Mensagens'],
      ['prz', 'Prazos'],
    ] as const) {
      it(`${nome} no tema ${t.nome}: texto 4,5:1, borda e foco 3:1, contagem 4,5:1`, () => {
        const bg = cor(t.vars, `${sigla}-bg`);
        const texto = cor(t.vars, `${sigla}-texto`);
        const borda = cor(t.vars, `${sigla}-borda`);
        expect(razao(texto, bg), 'texto e ícone sobre o fundo do sino').toBeGreaterThanOrEqual(4.5);
        expect(razao(borda, t.fundo), 'borda sobre o fundo').toBeGreaterThanOrEqual(3);
        expect(razao(texto, t.fundo), 'foco (cor do texto) sobre o fundo').toBeGreaterThanOrEqual(
          3,
        );
        // A contagem usa as cores invertidas
        expect(razao(bg, texto)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('página Avisos da escola', () => {
  it('Pedagógico escolhe a turma e publica; texto vazio e sem turma são recusados', async () => {
    const escritas = simular({
      '/avisos-escolares': { avisos: [] },
      '/avisos-escolares/turmas': { turmas: [{ id: 't1', nome: '7º A', ano_letivo: 2026 }] },
      'POST /avisos-escolares': { id: 'novo' },
    });
    const u = userEvent.setup();
    render(<AvisosEscola perfil="pedagogico" />);
    await u.click(screen.getByRole('button', { name: 'Publicar aviso' }));
    expect(await screen.findByText('Escreva o aviso.')).toBeTruthy();
    await u.type(screen.getByLabelText('Texto do aviso'), 'Reunião na sexta.');
    await u.click(screen.getByRole('button', { name: 'Publicar aviso' }));
    expect(await screen.findByText('Escolha a turma do aviso.')).toBeTruthy();
    await screen.findByRole('option', { name: '7º A (2026)' });
    await u.selectOptions(screen.getByLabelText('Turma'), 't1');
    await u.click(screen.getByRole('button', { name: 'Publicar aviso' }));
    await waitFor(() => expect(escritas).toHaveLength(1));
    expect(escritas[0]).toEqual({
      url: '/avisos-escolares',
      corpo: { texto: 'Reunião na sexta.', turma_id: 't1' },
    });
  });

  it('Admin não escolhe turma; lista avisos com data em dia/mês e desativa sem apagar; sem violações do axe', async () => {
    const escritas = simular({
      '/avisos-escolares': {
        avisos: [
          {
            id: 'a1',
            escopo: 'instituicao',
            turma_nome: null,
            texto: 'Aula suspensa dia 20/11.',
            autor_nome: 'Admin Fictício',
            dia: dia(-1),
            ativo: true,
          },
        ],
      },
    });
    const u = userEvent.setup();
    const { container } = render(<AvisosEscola perfil="admin" />);
    expect(screen.queryByLabelText('Turma')).toBeNull();
    expect(await screen.findByText('Aula suspensa dia 20/11.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Escola inteira/, level: 3 })).toBeTruthy();
    const r = await axe.run(container, semContraste);
    expect(r.violations.map((v) => v.id)).toEqual([]);
    await u.click(screen.getByRole('button', { name: 'Desativar aviso' }));
    await waitFor(() => expect(escritas).toHaveLength(1));
    expect(escritas[0]?.url).toBe('/avisos-escolares/a1/desativar');
  });
});

// L16b: o selo "Prazo passou" e o contador lateral não usam vermelho de alarme
describe('selo "Prazo passou" e contador sem vermelho', () => {
  it('mostra o texto do estado e não usa a classe vermelha', async () => {
    simular({
      '/notificacoes': {
        nao_lidas: 1,
        notificacoes: [
          {
            id: 'n1',
            tipo: 'atrasada',
            titulo: 'Lista de exercícios',
            quando: 'ontem',
            lida: false,
          },
        ],
      },
    });
    const { container } = render(<Avisos aoMudar={() => {}} />);
    const selo = await screen.findByText('Prazo passou');
    expect(selo.closest('.pill')?.className).not.toMatch(/red/);
    expect(container.querySelector('.t-red')).toBeNull();
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it('o contador lateral não é vermelho e tem contraste de texto de pelo menos 4,5:1', () => {
    const bloco = css.slice(css.lastIndexOf('.counter {'));
    expect(bloco).not.toMatch(/#e4535e/i);
    const fundo = /background:\s*#([0-9a-f]{6})/i.exec(bloco)?.[1] ?? '';
    const lum = (h: string) =>
      [0, 2, 4]
        .map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((a, c, i) => a + c * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
    const razao = 1.05 / (lum(fundo) + 0.05);
    expect(razao).toBeGreaterThanOrEqual(4.5);
  });
});

// L16b: anel de foco do tema claro com pelo menos 3:1 sobre branco, sobre o fundo claro e sobre o painel
describe('anel de foco no tema claro', () => {
  it('tem contraste de pelo menos 3:1 sobre os fundos claros', () => {
    const cor =
      /body:not\(\.dark\) a:focus-visible,[^{]*\{\s*outline-color:\s*#([0-9a-f]{6})/i.exec(
        css,
      )?.[1];
    expect(cor).toBeTruthy();
    const lum = (h: string) =>
      [0, 2, 4]
        .map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((a, c, i) => a + c * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
    for (const fundo of ['ffffff', 'f4f7fb', 'f7f9fc', 'fff0f0']) {
      const [claro, escuro] = [lum(cor as string), lum(fundo)].sort((a, b) => b - a);
      expect(
        ((claro as number) + 0.05) / ((escuro as number) + 0.05),
        fundo,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
