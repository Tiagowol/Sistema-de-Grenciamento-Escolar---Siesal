// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisciplinaAluno, DisciplinaCatalogo } from './api';
import { CaixaDeDisciplina, casa, semAcento } from './componentes/CaixaDeDisciplina';
import { MinhasDisciplinas } from './componentes/MinhasDisciplinas';

// L20b: caixa de busca de disciplina (combobox) e "Minhas disciplinas". Dados fictícios; a API é simulada.
const CATALOGO: DisciplinaCatalogo[] = [
  {
    id: 1,
    nome: 'Língua Portuguesa',
    etapas: ['fundamental'],
    gerais_em: [],
    curso: null,
    sinonimos: ['Português'],
  },
  { id: 5, nome: 'Matemática', etapas: ['fundamental'], gerais_em: [], curso: null, sinonimos: [] },
  {
    id: 22,
    nome: 'Programação Estruturada e Orientada a Objetos',
    etapas: ['tecnico'],
    gerais_em: [],
    curso: 'Técnico em Informática',
    sinonimos: ['POO'],
  },
];

let minhas: DisciplinaAluno[];
let etapa: string | null;
let chamadas: { metodo: string; url: string; corpo?: unknown }[];

function simular() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      const corpo = init?.body ? JSON.parse(String(init.body)) : undefined;
      chamadas.push({ metodo, url, corpo });
      const json = (o: unknown, status = 200) =>
        new Response(status === 204 ? null : JSON.stringify(o), { status });
      if (url.endsWith('/minhas-disciplinas') && metodo === 'GET')
        return json({ etapa, catalogo: CATALOGO, minhas, limite_proprias: 20 });
      if (url.endsWith('/minhas-disciplinas') && metodo === 'POST') {
        const k =
          'catalogo_id' in corpo ? CATALOGO.find((c) => c.id === corpo.catalogo_id) : undefined;
        const d: DisciplinaAluno = {
          id: `id-${minhas.length + 1}`,
          nome: k ? k.nome : corpo.nome,
          origem: k ? 'catalogo' : 'propria',
          catalogo_id: k ? k.id : null,
        };
        minhas = [...minhas, d];
        return json({ disciplina: d }, 201);
      }
      if (url.endsWith('/minhas-disciplinas/etapa')) {
        etapa = corpo.etapa;
        minhas = [{ id: 'g1', nome: 'Matemática', origem: 'catalogo', catalogo_id: 5 }];
        return json({ etapa, marcadas: 1, minhas });
      }
      if (metodo === 'DELETE') {
        minhas = minhas.filter((d) => !url.endsWith(d.id));
        return json(null, 204);
      }
      return json({});
    }),
  );
}

beforeEach(() => {
  minhas = [{ id: 'm1', nome: 'Matemática', origem: 'catalogo', catalogo_id: 5 }];
  etapa = null;
  chamadas = [];
  simular();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Pagina({
  aoEscolher = () => undefined,
}: {
  aoEscolher?: (e: { id: string; nome: string }) => void;
}) {
  const [v, setV] = useState('');
  return (
    <>
      <label htmlFor="d">Disciplina</label>
      <CaixaDeDisciplina
        id="d"
        valor={v}
        aoDigitar={setV}
        aoEscolher={(e) => {
          setV(e.nome);
          aoEscolher(e);
        }}
      />
    </>
  );
}

describe('busca (regra de casamento)', () => {
  it('ignora acento e maiúscula; acha por parte do nome, sinônimo e iniciais', () => {
    expect(semAcento('  LÍNGUA Portuguêsa ')).toBe('lingua portuguesa');
    expect(casa('port', 'Língua Portuguesa', ['Português'])).toBe(true);
    expect(casa('LING', 'Língua Portuguesa')).toBe(true);
    expect(casa('poo', 'Programação Estruturada e Orientada a Objetos', ['POO'])).toBe(true);
    expect(casa('peo', 'Programação Estruturada e Orientada a Objetos')).toBe(true); // iniciais
    expect(casa('xyz', 'Matemática')).toBe(false);
    expect(casa('', 'Matemática')).toBe(true);
  });
});

describe('caixa de busca de disciplina', () => {
  it('digitar "port" acha "Língua Portuguesa" e "poo" acha a disciplina certa', async () => {
    render(<Pagina />);
    const u = userEvent.setup();
    const campo = screen.getByRole('combobox', { name: 'Disciplina' });
    await waitFor(() => expect(chamadas.length).toBeGreaterThan(0));
    await u.type(campo, 'port');
    expect(await screen.findByRole('option', { name: /Língua Portuguesa/ })).toBeTruthy();
    await u.clear(campo);
    await u.type(campo, 'poo');
    expect(
      await screen.findByRole('option', { name: /Programação Estruturada e Orientada a Objetos/ }),
    ).toBeTruthy();
  });

  it('só com teclado: setas e Enter escolhem; a do catálogo é adicionada à lista do aluno', async () => {
    const aoEscolher = vi.fn();
    render(<Pagina aoEscolher={aoEscolher} />);
    const u = userEvent.setup();
    const campo = screen.getByRole('combobox', { name: 'Disciplina' });
    await u.click(campo);
    await u.type(campo, 'lingua');
    expect(campo.getAttribute('aria-expanded')).toBe('true');
    await u.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    await waitFor(() => expect(aoEscolher).toHaveBeenCalledOnce());
    expect(aoEscolher.mock.calls[0]?.[0]).toMatchObject({ nome: 'Língua Portuguesa' });
    expect(
      chamadas.some(
        (c) => c.metodo === 'POST' && (c.corpo as { catalogo_id?: number })?.catalogo_id === 1,
      ),
    ).toBe(true);
    await waitFor(() => expect(campo.getAttribute('aria-expanded')).toBe('false'));
  });

  it('a que o aluno já tem não cria de novo; Esc fecha a lista', async () => {
    const aoEscolher = vi.fn();
    render(<Pagina aoEscolher={aoEscolher} />);
    const u = userEvent.setup();
    const campo = screen.getByRole('combobox', { name: 'Disciplina' });
    await u.type(campo, 'mat');
    await u.click(await screen.findByRole('option', { name: 'Matemática' }));
    expect(aoEscolher).toHaveBeenCalledWith({ id: 'm1', nome: 'Matemática' });
    expect(chamadas.filter((c) => c.metodo === 'POST')).toHaveLength(0);
    await u.type(campo, 'x');
    await u.keyboard('{Escape}');
    expect(campo.getAttribute('aria-expanded')).toBe('false');
  });

  it('última opção: "Criar a disciplina ..." salva em Minhas disciplinas', async () => {
    const aoEscolher = vi.fn();
    render(<Pagina aoEscolher={aoEscolher} />);
    const u = userEvent.setup();
    await u.type(screen.getByRole('combobox', { name: 'Disciplina' }), 'Teatro');
    const opcoes = await screen.findAllByRole('option');
    expect(opcoes[opcoes.length - 1]?.textContent).toBe('Criar a disciplina "Teatro"');
    await u.click(opcoes[opcoes.length - 1] as HTMLElement);
    await waitFor(() => expect(aoEscolher).toHaveBeenCalled());
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({ nome: 'Teatro' });
  });

  it('sem violação do axe, com a lista aberta; opções com altura de toque de pelo menos 44 px no CSS', async () => {
    const { container } = render(<Pagina />);
    const u = userEvent.setup();
    await u.type(screen.getByRole('combobox', { name: 'Disciplina' }), 'a');
    await screen.findAllByRole('option');
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations).toEqual([]);
  });
});

describe('Minhas disciplinas (Personalizar)', () => {
  it('mostra a lista, as etapas e 10 campos para as próprias; sem violação do axe', async () => {
    const { container } = render(<MinhasDisciplinas />);
    expect(await screen.findByRole('button', { name: 'Tirar Matemática da lista' })).toBeTruthy();
    expect(
      screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).name === 'pz-etapa'),
    ).toHaveLength(3);
    expect(screen.getAllByRole('textbox', { name: /Nova disciplina própria/ })).toHaveLength(10);
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(r.violations).toEqual([]);
  });

  it('escolher a etapa chama a API e avisa com texto literal', async () => {
    render(<MinhasDisciplinas />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('radio', { name: /^Ensino Médio$/ }));
    await waitFor(() => expect(chamadas.some((c) => c.url.endsWith('/etapa'))).toBe(true));
    expect(
      await screen.findByText(/As disciplinas gerais da sua etapa foram marcadas/),
    ).toBeTruthy();
  });

  it('cria uma própria no campo em branco e tira uma da lista', async () => {
    render(<MinhasDisciplinas />);
    const u = userEvent.setup();
    const campo = (
      await screen.findAllByRole('textbox', { name: /Nova disciplina própria/ })
    )[0] as HTMLElement;
    await u.type(campo, 'Teatro');
    await u.click(screen.getByRole('button', { name: 'Criar a disciplina do campo 1' }));
    expect(await screen.findByText('Disciplina salva.')).toBeTruthy();
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({ nome: 'Teatro' });
    await u.click(screen.getByRole('button', { name: 'Tirar Matemática da lista' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Tirar Matemática da lista' })).toBeNull(),
    );
  });

  it('link e e-mail não entram nos campos; o limite de 20 desliga os campos', async () => {
    render(<MinhasDisciplinas />);
    const u = userEvent.setup();
    const campo = (
      await screen.findAllByRole('textbox', { name: /Nova disciplina própria/ })
    )[0] as HTMLInputElement;
    await u.type(campo, 'Ab');
    await u.type(campo, '@');
    expect(campo.value).toBe('Ab');
    cleanup();
    minhas = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      nome: `Própria ${i + 1}`,
      origem: 'propria' as const,
      catalogo_id: null,
    }));
    render(<MinhasDisciplinas />);
    expect(
      await screen.findByText(/Você chegou ao limite de 20 disciplinas próprias/),
    ).toBeTruthy();
    expect(screen.queryAllByRole('textbox', { name: /Nova disciplina própria/ })).toHaveLength(0);
    const grupo = screen.getByRole('group', { name: /Disciplinas que eu criei \(20 de 20\)/ });
    expect(within(grupo).getAllByRole('textbox')).toHaveLength(20);
  });
});
