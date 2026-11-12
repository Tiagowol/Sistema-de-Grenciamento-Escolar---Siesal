// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Eu } from './api';
import {
  Dificuldade,
  dificuldadeAlta,
  palavraDaDificuldade,
  TEXTO_EQUIPE_VE,
} from './componentes/Dificuldade';
import { Shell } from './componentes/Shell';
import { paraTexto } from './datas';
import { definirModulos } from './modulos';
import { Acompanhamento } from './paginas/Acompanhamento';
import { Calendario } from './paginas/Calendario';
import { Cartoes } from './paginas/Cartoes';

// 20d: dificuldade de 0 a 10, tela do Apoio Pedagógico (um aluno por vez), cards de resumo com Revisar e grade do dia.
// Dados fictícios.
beforeEach(() => {
  localStorage.clear();
  definirModulos({ mensagens: true, calendario: true, apoio_aluno: true });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  definirModulos(null);
});
const semContraste = { rules: { 'color-contrast': { enabled: false } } };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

describe('dificuldade de 0 a 10', () => {
  it('as bandas de palavras e a regra de sugestão (7 ou mais)', () => {
    expect(palavraDaDificuldade(0)).toBe('muito fácil');
    expect(palavraDaDificuldade(2)).toBe('fácil');
    expect(palavraDaDificuldade(5)).toBe('média');
    expect(palavraDaDificuldade(8)).toBe('difícil');
    expect(palavraDaDificuldade(10)).toBe('extremamente difícil');
    expect(dificuldadeAlta(6)).toBe(false);
    expect(dificuldadeAlta(7)).toBe(true);
    expect(dificuldadeAlta(null)).toBe(false);
    expect(dificuldadeAlta(undefined)).toBe(false);
  });

  it('tem 11 posições, palavras nas pontas e no meio, escolhe e limpa; passa no axe', async () => {
    const aoMudar = vi.fn();
    const { container, rerender } = render(<Dificuldade valor={null} aoMudar={aoMudar} />);
    const u = userEvent.setup();
    expect(screen.getAllByRole('radio')).toHaveLength(11);
    for (const palavra of ['muito fácil', 'média', 'extremamente difícil'])
      expect(screen.getByText(palavra)).toBeTruthy();
    expect(screen.getByText('Sem nota.')).toBeTruthy();
    await u.click(screen.getByRole('radio', { name: /^7/ }));
    expect(aoMudar).toHaveBeenCalledWith(7);
    rerender(<Dificuldade valor={7} aoMudar={aoMudar} />);
    // nunca só número: a palavra aparece junto
    expect(screen.getByText('difícil')).toBeTruthy();
    expect(screen.getByText(/nota 7 de 10/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Sem nota' }));
    expect(aoMudar).toHaveBeenLastCalledWith(null);
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('avisa em texto literal que a equipe vê a nota, só quando a equipe de fato vê', () => {
    const { unmount } = render(<Dificuldade valor={3} aoMudar={() => undefined} />);
    expect(screen.getByText(TEXTO_EQUIPE_VE)).toBeTruthy();
    unmount();
    // espaço individual ou módulo desligado: não há equipe, então o aviso não aparece
    definirModulos({ mensagens: false, calendario: true, apoio_aluno: false });
    render(<Dificuldade valor={3} aoMudar={() => undefined} />);
    expect(screen.queryByText(TEXTO_EQUIPE_VE)).toBeNull();
  });

  it('funciona pelo teclado: setas mudam a opção e a opção marcada tem foco visível', async () => {
    const aoMudar = vi.fn();
    render(<Dificuldade valor={4} aoMudar={aoMudar} />);
    const u = userEvent.setup();
    await u.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: /^4/ }));
    await u.keyboard('{ArrowRight}');
    expect(aoMudar).toHaveBeenCalledWith(5);
  });
});

describe('Apoio Pedagógico: Acompanhamento', () => {
  const dificuldades = {
    aluno: { id: 'a1', nome: 'Aluna Fictícia' },
    disciplinas: [{ id: 'd1', nome: 'Matemática', dificuldade: 9 }],
    tarefas: [
      {
        id: 't1',
        titulo: 'Lista de exercícios',
        disciplina: 'Matemática',
        prazo: '2026-11-20',
        situacao: 'pendente',
        dificuldade: 3,
      },
    ],
  };
  const simular = () => {
    const chamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        chamadas.push(url.replace('/api', ''));
        if (url.endsWith('/apoio/alunos'))
          return json({
            alunos: [
              { id: 'a1', nome: 'Aluna Fictícia' },
              { id: 'a2', nome: 'Aluno Fictício' },
            ],
          });
        return json(dificuldades);
      }),
    );
    return chamadas;
  };

  it('lista só nomes (sem nota) e abre um aluno por vez, com palavra e barra; sem violação do axe', async () => {
    const chamadas = simular();
    const { container } = render(<Acompanhamento />);
    const u = userEvent.setup();
    expect(await screen.findByText('Aluno Fictício')).toBeTruthy();
    // antes de abrir um aluno, nenhuma nota aparece
    expect(screen.queryByText(/nota \d+ de 10/)).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Ver as dificuldades de Aluna Fictícia' }));
    expect(await screen.findByText('nota 9 de 10')).toBeTruthy();
    expect(screen.getAllByText('difícil', { selector: 'strong' }).length).toBeGreaterThan(0);
    expect(screen.getByText('nota 3 de 10')).toBeTruthy();
    // só o aluno aberto foi pedido ao servidor
    expect(chamadas.filter((c) => c.includes('/dificuldades'))).toEqual([
      '/apoio/alunos/a1/dificuldades',
    ]);
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('diz a finalidade e que a nota não é prova nem serve para comparar, e não tem ranking nem média', async () => {
    simular();
    render(<Acompanhamento />);
    expect(
      await screen.findByText(/não é nota de prova nem diagnóstico, e não serve para comparar/),
    ).toBeTruthy();
    expect(screen.queryByText(/ranking|média|ordenar/i)).toBeNull();
  });

  it('mostra o aviso do servidor quando a leitura é recusada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/apoio/alunos')
          ? json({ alunos: [{ id: 'a1', nome: 'Aluna Fictícia' }] })
          : json({ erro: 'Sem permissão.' }, 403),
      ),
    );
    render(<Acompanhamento />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Ver as dificuldades de Aluna/ }));
    expect(await screen.findByText('Sem permissão.')).toBeTruthy();
  });
});

describe('menu', () => {
  const montar = (perfil: Eu['usuario']['perfil'], espaco: Eu['espaco'], apoio: boolean) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ itens: [], nao_vistos: 0 })),
    );
    const eu: Eu = {
      nivel: 'completo',
      usuario: { id: 'u', nome: 'Pessoa Fictícia', perfil },
      espaco,
      modulos: { mensagens: true, calendario: true, apoio_aluno: apoio },
    };
    render(
      <Shell eu={eu} pagina="meudia" aoIr={() => undefined} aoSair={() => undefined}>
        <p>x</p>
      </Shell>,
    );
    return screen.getByRole('navigation', { name: 'Telas do sistema' });
  };
  const tem = (nav: HTMLElement, nome: RegExp) =>
    within(nav).queryByRole('button', { name: nome }) !== null;

  it('o aluno da escola vê Cards de resumo; sem o módulo "apoio ao aluno" ele some', () => {
    expect(tem(montar('aluno', 'escola', true), /^Cards de resumo/)).toBe(true);
    cleanup();
    expect(tem(montar('aluno', 'escola', false), /^Cards de resumo/)).toBe(false);
  });

  it('o aluno do espaço individual continua com Cards de resumo (não há módulo da escola lá)', () => {
    expect(tem(montar('aluno', 'individual', false), /^Cards de resumo/)).toBe(true);
  });

  it('só o Pedagógico vê Acompanhamento (e só na escola, com o módulo ligado)', () => {
    expect(tem(montar('pedagogico', 'escola', true), /^Acompanhamento/)).toBe(true);
    cleanup();
    expect(tem(montar('pedagogico', 'escola', false), /^Acompanhamento/)).toBe(false);
    cleanup();
    for (const perfil of ['aluno', 'professor', 'admin', 'responsavel'] as const) {
      expect(tem(montar(perfil, 'escola', true), /^Acompanhamento/), perfil).toBe(false);
      cleanup();
    }
  });
});

describe('cards de resumo', () => {
  const cartao = {
    id: 'c1',
    modelo: 'conceito',
    titulo: 'O que é fração',
    frente: 'Parte de um todo.',
    verso: 'Exemplo: 1/2 é metade.',
    tarefa_id: 't1',
    disciplina_id: null,
    tarefa_titulo: 'Lista de frações',
    disciplina_nome: null,
  };
  const simular = (cartoes: unknown[] = [cartao]) => {
    const chamadas: { metodo: string; url: string; corpo: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const metodo = init?.method ?? 'GET';
        const u = url.replace('/api', '');
        chamadas.push({ metodo, url: u, corpo: init?.body ? JSON.parse(String(init.body)) : null });
        if (u.startsWith('/cartoes-resumo') && metodo === 'GET')
          return json({ limite: 20, cartoes });
        if (u.startsWith('/cartoes-resumo') && metodo === 'POST') return json({ cartao }, 201);
        if (u === '/tarefas')
          return json({
            tarefas: [
              { id: 't1', titulo: 'Lista de frações', situacao: 'pendente', microetapas: [] },
            ],
          });
        if (u === '/minhas-disciplinas')
          return json({
            etapa: null,
            catalogo: [],
            minhas: [{ id: 'd1', nome: 'Matemática', origem: 'catalogo', catalogo_id: 1 }],
            limite_proprias: 20,
          });
        return new Response(null, { status: 204 });
      }),
    );
    return chamadas;
  };

  it('lista os cards com a origem e passa no axe', async () => {
    simular();
    const { container } = render(<Cartoes />);
    expect(await screen.findByText('O que é fração')).toBeTruthy();
    expect(screen.getByText('Atividade: Lista de frações')).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('assistente em 3 passos com 4 modelos, contador de letras e dica; salva o card', async () => {
    const chamadas = simular([]);
    const { container } = render(<Cartoes />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Criar card' }));
    expect(screen.getByText(/Passo 1 de 3/)).toBeTruthy();
    const modelos = screen.getAllByRole('radio');
    expect(modelos.map((r) => (r.closest('label') as HTMLElement).textContent)).toEqual([
      expect.stringContaining('Conceito'),
      expect.stringContaining('Passo a passo'),
      expect.stringContaining('Fórmula'),
      expect.stringContaining('Pergunta e resposta'),
    ]);
    await u.selectOptions(
      screen.getByLabelText(/Qual atividade ou disciplina|De qual atividade ou disciplina/),
      'tarefa:t1',
    );
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText(/frases curtas/)).toBeTruthy();
    await u.type(screen.getByLabelText('Título'), 'Fração');
    await u.type(screen.getByLabelText(/^Frente/), 'Parte de um todo.');
    expect(screen.getByText('17 de 500 letras')).toBeTruthy();
    await u.type(screen.getByLabelText(/^Verso/), '1/2 é metade.');
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText(/Passo 3 de 3/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Salvar card' }));
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'POST')).toBe(true));
    const post = chamadas.find((c) => c.metodo === 'POST') as { corpo: Record<string, unknown> };
    expect(post.corpo).toMatchObject({ modelo: 'conceito', titulo: 'Fração', tarefa_id: 't1' });
  });

  it('texto com link, e-mail ou HTML é recusado na tela, sem chamar o servidor', async () => {
    const chamadas = simular([]);
    render(<Cartoes />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Criar card' }));
    await u.selectOptions(screen.getByLabelText(/atividade ou disciplina/), 'tarefa:t1');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await u.type(screen.getByLabelText('Título'), 'Veja');
    await u.type(screen.getByLabelText(/^Frente/), 'acesse http://x.com');
    await u.type(screen.getByLabelText(/^Verso/), 'ok');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('O texto não pode ter links, e-mail nem HTML.')).toBeTruthy();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('Revisar: um card por vez, "Ver o resumo" mostra o verso, navega pelo teclado e "Parar por agora" sai', async () => {
    simular([
      cartao,
      {
        ...cartao,
        id: 'c2',
        titulo: 'Segundo card',
        frente: 'Outra frente.',
        verso: 'Outro verso.',
      },
    ]);
    const { container } = render(<Cartoes />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Revisar' }));
    expect(screen.getByText('Card 1 de 2')).toBeTruthy();
    expect(screen.queryByText('Exemplo: 1/2 é metade.')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Ver o resumo' }));
    expect(screen.getByText('Exemplo: 1/2 é metade.')).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    // teclado: foco no botão e Enter
    screen.getByRole('button', { name: 'Próximo card' }).focus();
    await u.keyboard('{Enter}');
    expect(screen.getByText('Card 2 de 2')).toBeTruthy();
    // o verso do card novo volta escondido
    expect(screen.queryByText('Outro verso.')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Próximo card' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await u.click(screen.getByRole('button', { name: 'Parar por agora' }));
    expect(screen.queryByText('Card 2 de 2')).toBeNull();
  });

  it('com "Reduzir movimento" ligado o Revisar não usa animação', async () => {
    localStorage.setItem('siesal-preferencias-v1', JSON.stringify({ movimento: true }));
    simular();
    render(<Cartoes />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Revisar' }));
    const secao = screen
      .getByRole('heading', { name: 'Revisar' })
      .closest('section') as HTMLElement;
    expect(secao.className).toContain('sem-animacao');
  });
});

describe('grade do dia', () => {
  const hoje = paraTexto(new Date());
  const evento = (o: Record<string, unknown>) => ({
    id: 'e1',
    titulo: 'Aula de Matemática',
    tipo: 'estudo',
    origem: 'manual',
    dia: hoje,
    hora_inicio: '09:00',
    minutos: 25,
    ...o,
  });
  const simular = (eventos: unknown[]) => {
    const chamadas: { metodo: string; url: string; corpo: Record<string, unknown> | null }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const metodo = init?.method ?? 'GET';
        const u = url.replace('/api', '');
        chamadas.push({ metodo, url: u, corpo: init?.body ? JSON.parse(String(init.body)) : null });
        if (u === '/tarefas')
          return json({
            tarefas: [
              { id: 't1', titulo: 'Lista de frações', situacao: 'pendente', microetapas: [] },
              { id: 't2', titulo: 'Feita', situacao: 'concluida', microetapas: [] },
            ],
          });
        if (u.startsWith('/tipos-atividade')) return json({ tipos: [] });
        if (metodo === 'GET') return json({ eventos });
        return json({ evento: eventos[0] ?? {} }, 201);
      }),
    );
    return chamadas;
  };
  const abrirDia = async (u: ReturnType<typeof userEvent.setup>) => {
    await u.click(screen.getByRole('button', { name: 'Dia' }));
  };

  it('o dia abre em grade, com Manhã, Tarde e Noite e as horas de 06:00 a 23:00; passa no axe', async () => {
    simular([evento({})]);
    const { container } = render(<Calendario />);
    const u = userEvent.setup();
    await abrirDia(u);
    for (const parte of ['Manhã', 'Tarde', 'Noite'])
      expect(await screen.findByRole('heading', { name: new RegExp(parte) })).toBeTruthy();
    for (const hora of ['06:00', '11:00', '12:00', '17:00', '18:00', '23:00'])
      expect(screen.getByRole('button', { name: `Colocar algo às ${hora}` }), hora).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Colocar algo às 05:00' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Colocar algo às 24:00' })).toBeNull();
    // o evento das 09:00 aparece na linha da hora, com o bloco em palavra e minutos pequenos
    const linha = screen
      .getByRole('button', { name: 'Colocar algo às 09:00' })
      .closest('li') as HTMLElement;
    expect(within(linha).getByText('Aula de Matemática', { selector: 'strong' })).toBeTruthy();
    expect(within(linha).getByText(/Bloco médio \(25 min\)/)).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('a lista simples continua disponível e evento sem horário fica fora da grade', async () => {
    simular([evento({ id: 'e2', titulo: 'Sem hora', hora_inicio: null, minutos: null })]);
    render(<Calendario />);
    const u = userEvent.setup();
    await abrirDia(u);
    expect(await screen.findByRole('heading', { name: 'Sem horário na grade' })).toBeTruthy();
    expect(screen.getByText('Sem hora', { selector: 'strong' })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Lista do dia' }));
    expect(screen.queryByRole('button', { name: 'Colocar algo às 09:00' })).toBeNull();
    expect(screen.getByText('Sem hora', { selector: 'strong' })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Grade de horas' }));
    expect(screen.getByRole('button', { name: 'Colocar algo às 09:00' })).toBeTruthy();
  });

  it('clicar numa hora oferece evento novo (formulário já com a hora) ou uma atividade que já existe', async () => {
    simular([]);
    render(<Calendario />);
    const u = userEvent.setup();
    await abrirDia(u);
    await u.click(await screen.findByRole('button', { name: 'Colocar algo às 14:00' }));
    expect(screen.getByText('O que você quer colocar às 14:00?')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Evento novo' }));
    expect((screen.getByLabelText('Horário (opcional)') as HTMLInputElement).value).toBe('14:00');
  });

  it('coloca uma atividade existente na hora (só as não concluídas), ligada à atividade', async () => {
    const chamadas = simular([]);
    render(<Calendario />);
    const u = userEvent.setup();
    await abrirDia(u);
    await u.click(await screen.findByRole('button', { name: 'Colocar algo às 15:00' }));
    await u.click(screen.getByRole('button', { name: 'Uma atividade que já existe' }));
    const select = await screen.findByLabelText('Atividade');
    expect(within(select).queryByText('Feita')).toBeNull();
    await u.selectOptions(select, 't1');
    await u.selectOptions(
      screen.getByLabelText('Duração (opcional)', { selector: 'select' }),
      '25',
    );
    await u.click(screen.getByRole('button', { name: 'Colocar na grade' }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.metodo === 'POST' && c.url === '/eventos')).toBe(true),
    );
    const post = chamadas.find((c) => c.metodo === 'POST' && c.url === '/eventos') as {
      corpo: Record<string, unknown>;
    };
    expect(post.corpo).toMatchObject({
      titulo: 'Lista de frações',
      tipo: 'estudo',
      dia: hoje,
      hora_inicio: '15:00',
      minutos: 25,
      tarefa_id: 't1',
    });
  });

  it('no mês, o aluno escolhe grade ou lista e a escolha é avisada à conta', async () => {
    simular([]);
    const mudou = vi.fn();
    render(<Calendario forma="grade" aoMudarForma={mudou} />);
    const u = userEvent.setup();
    // a grade de horas aparece embaixo do mês, sem clique extra
    expect(await screen.findByRole('button', { name: 'Colocar algo às 06:00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Grade de horas' }).getAttribute('aria-pressed')).toBe('true');
    await u.click(screen.getByRole('button', { name: 'Lista do dia' }));
    expect(mudou).toHaveBeenCalledWith('lista');
  });

  it('com a escolha "lista", o mês mostra a lista do dia e não a grade', async () => {
    simular([]);
    render(<Calendario forma="lista" aoMudarForma={() => undefined} />);
    expect(await screen.findByRole('button', { name: 'Lista do dia' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Colocar algo às 06:00' })).toBeNull();
  });
});
