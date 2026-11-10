// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Caixa, Eu, Tarefa } from './api';
import { EscolhaAgora, etapasParaEscolher } from './componentes/EscolhaAgora';
import { PedirAjuda } from './componentes/PedirAjuda';
import { Shell } from './componentes/Shell';
import { paraTexto, somarDias } from './datas';
import { TEXTOS, texto } from './linguagem-curta';
import { Acessibilidade } from './paginas/Acessibilidade';
import { MeuDia } from './paginas/MeuDia';
import { PREFERENCIAS_PADRAO } from './preferencias';

// L17: pedir ajuda (item 3), Linguagem curta (item 1) e "Escolha o que fazer agora" (item 2). Dados fictícios.
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const semContraste = { rules: { 'color-contrast': { enabled: false } } };
const hoje = paraTexto(new Date());
const preferir = (p: Partial<typeof PREFERENCIAS_PADRAO>) =>
  localStorage.setItem('siesal-preferencias-v1', JSON.stringify({ ...PREFERENCIAS_PADRAO, ...p }));

// Responde às rotas e guarda as escritas (POST)
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

const DESTINOS = {
  professores: [
    {
      professor_id: 'p1',
      professor_nome: 'Professora Fictícia',
      turma_id: 't1',
      turma_nome: '7º A',
      disciplina_id: 'd1',
      disciplina_nome: 'Matemática',
    },
  ],
  equipe_pedagogica: true,
};
const tarefa = (id: string, prazo: string | null, etapas: [string, boolean][]): Tarefa => ({
  id,
  titulo: `Atividade ${id}`,
  descricao: '',
  disciplina: 'Matemática',
  tipo: 'tarefa',
  prazo,
  prioridade: 'media',
  situacao: 'pendente',
  microetapas: etapas.map(([t, feita], i) => ({ id: `${id}-m${i}`, texto: t, feita, ordem: i })),
});

describe('item 3: pedir ajuda', () => {
  it('sem escolha, avisa; com professor e motivo, envia ligado à atividade e à etapa', async () => {
    const escritas = simular({ '/ajuda/destinos': DESTINOS, 'POST /ajuda': { id: 'a1' } });
    const u = userEvent.setup();
    const t = tarefa('x', hoje, [['Ler o enunciado', false]]);
    render(<PedirAjuda tarefa={t} etapaInicial="x-m0" aoFechar={() => undefined} />);
    await u.click(await screen.findByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByText('Escolha para quem pedir ajuda.')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: /Professora Fictícia/ }));
    await u.click(screen.getByRole('button', { name: 'Não entendi' }));
    expect(screen.getByRole('button', { name: 'Não entendi' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await u.type(screen.getByLabelText('Quer explicar mais? (opcional)'), 'O que é denominador?');
    await u.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(
      await screen.findByText(/Pedido enviado para Professora Fictícia \(Matemática\)/),
    ).toBeTruthy();
    expect(escritas).toEqual([
      {
        url: '/ajuda',
        corpo: {
          destino: 'professor',
          professor_id: 'p1',
          turma_id: 't1',
          disciplina_id: 'd1',
          motivo: 'nao_entendi',
          texto: 'O que é denominador?',
          tarefa_id: 'x',
          microetapa_id: 'x-m0',
        },
      },
    ]);
  });

  it('à equipe pedagógica (NAPNE): sem professor no corpo; formulário sem violações do axe', async () => {
    const escritas = simular({ '/ajuda/destinos': DESTINOS, 'POST /ajuda': { id: 'a2' } });
    const u = userEvent.setup();
    const { container } = render(<PedirAjuda aoFechar={() => undefined} />);
    await u.click(await screen.findByRole('button', { name: /Equipe pedagógica/ }));
    await u.click(screen.getByRole('button', { name: 'Não sei por onde começar' }));
    const r = await axe.run(container, semContraste);
    expect(r.violations.map((v) => v.id)).toEqual([]);
    await u.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    await screen.findByText(/Pedido enviado para a equipe pedagógica/);
    expect(escritas[0]?.corpo).toEqual({ destino: 'pedagogico', motivo: 'nao_sei_comecar' });
  });

  it('sem professor nem equipe, explica o que fazer, sem formulário', async () => {
    simular({ '/ajuda/destinos': { professores: [], equipe_pedagogica: false } });
    render(<PedirAjuda aoFechar={() => undefined} />);
    expect(await screen.findByText(/Fale com a escola/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar pedido' })).toBeNull();
  });
});

const euDe = (perfil: Eu['usuario']['perfil']): Eu => ({
  nivel: 'completo',
  usuario: { id: 'u1', nome: 'Pessoa Fictícia', perfil },
});
const montarShell = (perfil: Eu['usuario']['perfil']) =>
  render(
    <Shell eu={euDe(perfil)} pagina="inicio" aoIr={() => undefined} aoSair={() => undefined}>
      <p>Conteúdo</p>
    </Shell>,
  );

describe('item 3: sino Mensagens', () => {
  it('professor vê o pedido de ajuda e marca como atendido com resposta; sem violações do axe', async () => {
    const escritas = simular({
      '/caixa': {
        nao_vistos: 1,
        itens: [
          {
            tipo: 'ajuda_aberta',
            id: 'a1',
            visto: false,
            dia: hoje,
            destino: 'professor',
            motivo: 'nao_entendi',
            texto: 'O que é denominador?',
            aluno_nome: 'Aluna Fictícia',
            turma_nome: '7º A',
            disciplina_nome: 'Matemática',
            tarefa_titulo: 'Exercícios de frações',
            etapa_texto: 'Ler o enunciado',
          },
        ],
      } satisfies Caixa,
      'POST /caixa/vistos': { marcados: 1 },
    });
    const u = userEvent.setup();
    const { container } = montarShell('professor');
    await u.click(await screen.findByRole('button', { name: 'Mensagens, 1 não vista' }));
    expect(await screen.findByText('Pedido de ajuda')).toBeTruthy();
    expect(screen.getByText('O que aconteceu: Não entendi')).toBeTruthy();
    expect(screen.getByText('Etapa: Ler o enunciado')).toBeTruthy();
    const r = await axe.run(container, semContraste);
    expect(r.violations.map((v) => v.id)).toEqual([]);
    await u.type(screen.getByLabelText('Resposta para o aluno (opcional)'), 'Vamos ver na aula.');
    await u.click(screen.getByRole('button', { name: 'Marcar como atendido' }));
    expect(await screen.findByText(/Pedido marcado como atendido/)).toBeTruthy();
    expect(escritas.find((e) => e.url === '/ajuda/a1/atender')?.corpo).toEqual({
      resposta: 'Vamos ver na aula.',
    });
  });

  it('o aluno vê os próprios pedidos: esperando resposta e atendido, com a resposta', async () => {
    simular({
      '/caixa': {
        nao_vistos: 1,
        itens: [
          {
            tipo: 'ajuda_minha',
            id: 'a1',
            visto: false,
            dia: hoje,
            destino: 'professor',
            motivo: 'nao_entendi',
            texto: '',
            estado: 'atendido',
            resposta: 'Vamos ver na aula.',
            professor_nome: 'Professora Fictícia',
            atendido_por_nome: 'Professora Fictícia',
            disciplina_nome: 'Matemática',
            tarefa_titulo: null,
            etapa_texto: null,
          },
          {
            tipo: 'ajuda_minha',
            id: 'a2',
            visto: true,
            dia: hoje,
            destino: 'pedagogico',
            motivo: 'preciso_tempo',
            texto: '',
            estado: 'aberto',
            resposta: '',
            professor_nome: null,
            atendido_por_nome: null,
            disciplina_nome: null,
            tarefa_titulo: null,
            etapa_texto: null,
          },
        ],
      } satisfies Caixa,
      'POST /caixa/vistos': { marcados: 1 },
    });
    const u = userEvent.setup();
    montarShell('aluno');
    await u.click(await screen.findByRole('button', { name: /^Mensagens/ }));
    expect(await screen.findByText('Resposta: Vamos ver na aula.')).toBeTruthy();
    expect(screen.getByText('Atendido por Professora Fictícia.')).toBeTruthy();
    expect(screen.getByText('Esperando resposta.')).toBeTruthy();
    expect(screen.getByText('Para: equipe pedagógica')).toBeTruthy();
  });
});

describe('item 2: "Escolha o que fazer agora"', () => {
  const TAREFAS = [
    tarefa('sem-prazo', null, [['Etapa sem prazo', false]]),
    tarefa('amanha', somarDias(hoje, 1), [
      ['Já feita', true],
      ['Separar o material', false],
    ]),
    { ...tarefa('feita', hoje, [['Concluída', true]]), situacao: 'concluida' as const },
  ];

  it('ordena pelo prazo mais próximo, sem prazo por último, e pula as concluídas', () => {
    const o = etapasParaEscolher(TAREFAS);
    expect(o.map((x) => x.tarefa.id)).toEqual(['amanha', 'sem-prazo']);
    expect(o[0]?.etapa?.texto).toBe('Separar o material');
  });

  it('mostra uma etapa por vez; "Mostrar outra" troca; "Começar" abre o foco com a atividade', async () => {
    simular({ '/tarefas': { tarefas: TAREFAS } });
    const comecar = vi.fn();
    const u = userEvent.setup();
    const { container } = render(<EscolhaAgora hoje={hoje} aoComecar={comecar} />);
    expect(await screen.findByText('Separar o material')).toBeTruthy();
    expect(screen.getByText('amanhã')).toBeTruthy(); // tempo com palavra, não só número
    const r = await axe.run(container, semContraste);
    expect(r.violations.map((v) => v.id)).toEqual([]);
    await u.click(screen.getByRole('button', { name: 'Mostrar outra' }));
    expect(screen.getByText('Etapa sem prazo')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Começar' }));
    expect(comecar).toHaveBeenCalledWith('sem-prazo');
  });

  it('"Agora não" só esconde nesta visita e não grava nada', async () => {
    const escritas = simular({ '/tarefas': { tarefas: TAREFAS } });
    const u = userEvent.setup();
    render(<EscolhaAgora hoje={hoje} aoComecar={() => undefined} />);
    await u.click(await screen.findByRole('button', { name: 'Agora não' }));
    expect(screen.getByRole('status').textContent).toBe(TEXTOS.escolhaAgoraNao.normal);
    expect(escritas).toEqual([]);
  });

  it('o aluno pode ocultar o cartão em Acessibilidade', async () => {
    const meuDia = {
      hoje,
      atrasadas: [],
      para_hoje: [],
      proximas: [],
      eventos: [],
      minutos_estudados_hoje: 0,
      sessao_atual: null,
      tarefas_concluidas: 0,
      tarefas_total: 0,
    };
    simular({ '/meu-dia': meuDia, '/tarefas': { tarefas: TAREFAS } });
    render(<MeuDia nome="Alex Souza" aoIr={() => undefined} />);
    expect(await screen.findByRole('heading', { name: 'Escolha o que fazer agora' })).toBeTruthy();
    cleanup();
    preferir({ escolhaAgora: false });
    render(<MeuDia nome="Alex Souza" aoIr={() => undefined} />);
    await screen.findByRole('heading', { name: 'Atividades que precisam de atenção' });
    expect(screen.queryByRole('heading', { name: 'Escolha o que fazer agora' })).toBeNull();
  });
});

describe('item 1: Linguagem curta', () => {
  it('vem desligada; ligada, troca o texto e mantém os valores', () => {
    expect(texto('meuDiaSub', { data: '9 de novembro' })).toBe(
      'Hoje é 9 de novembro. Você não precisa resolver tudo agora.',
    );
    preferir({ linguagemCurta: true });
    expect(texto('meuDiaSub', { data: '9 de novembro' })).toBe(
      'Hoje é 9 de novembro. Uma coisa de cada vez.',
    );
  });

  it('todo texto curto é menor ou igual ao normal e não tem marcador perdido', () => {
    for (const [chave, t] of Object.entries(TEXTOS)) {
      expect(t.curta.length, chave).toBeLessThanOrEqual(t.normal.length);
      const marcadores = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(marcadores(t.curta), chave).toBe(marcadores(t.normal));
    }
  });

  it('Acessibilidade tem os dois controles novos, desligado e ligado por padrão', async () => {
    const mudar = vi.fn();
    const u = userEvent.setup();
    render(<Acessibilidade valor={PREFERENCIAS_PADRAO} aoMudar={mudar} />);
    const curta = screen.getByRole('switch', { name: 'Linguagem curta' });
    const escolha = screen.getByRole('switch', { name: 'Mostrar "Escolha o que fazer agora"' });
    expect(curta.getAttribute('aria-checked')).toBe('false');
    expect(escolha.getAttribute('aria-checked')).toBe('true');
    await u.click(curta);
    await waitFor(() =>
      expect(mudar).toHaveBeenCalledWith({ ...PREFERENCIAS_PADRAO, linguagemCurta: true }),
    );
  });
});
