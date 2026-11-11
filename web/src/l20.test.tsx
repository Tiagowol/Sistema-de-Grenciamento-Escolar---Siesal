// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HTML_STATUS from '../../proxy/status/index.html?raw';
import JS_STATUS from '../../proxy/status/status.js?raw';
import type { EstadoModulos, Eu } from './api';
import { Shell } from './componentes/Shell';
import { definirModulos, moduloLigado } from './modulos';

// L20: módulos desligados pelo Master somem das telas da escola; página de status pública. Dados fictícios.
const semContraste = { rules: { 'color-contrast': { enabled: false } } };
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  definirModulos(null);
  document.body.innerHTML = '';
});

const DESLIGADOS: EstadoModulos = { mensagens: false, calendario: false, apoio_aluno: false };
const euDe = (perfil: Eu['usuario']['perfil'], modulos?: EstadoModulos): Eu => ({
  nivel: 'completo',
  usuario: { id: 'u1', nome: 'Pessoa Fictícia', perfil },
  modulos,
});
const semRede = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ itens: [], nao_vistos: 0 }), { status: 200 })),
  );
const menu = () => screen.getByRole('complementary', { name: 'Menu principal' });

describe('módulos no menu da escola', () => {
  it('sem informação, tudo ligado (como antes do L20)', () => {
    expect(moduloLigado('mensagens')).toBe(true);
    definirModulos({ ...DESLIGADOS, calendario: true });
    expect(moduloLigado('calendario')).toBe(true);
    expect(moduloLigado('apoio_aluno')).toBe(false);
  });

  it('aluno: com tudo desligado, Calendário, Avisos e o sino de mensagens somem', () => {
    semRede();
    render(
      <Shell
        eu={euDe('aluno', DESLIGADOS)}
        pagina="meudia"
        aoIr={() => undefined}
        aoSair={() => undefined}
      >
        <p>x</p>
      </Shell>,
    );
    for (const nome of ['Calendário', 'Avisos'])
      expect(within(menu()).queryByRole('button', { name: nome }), nome).toBeNull();
    expect(within(menu()).getByRole('button', { name: 'Agenda' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mensagens/ })).toBeNull();
  });

  it('Admin: Avisos da escola e Calendário da escola somem; o resto continua', async () => {
    semRede();
    const { container } = render(
      <Shell
        eu={euDe('admin', DESLIGADOS)}
        pagina="inicio"
        aoIr={() => undefined}
        aoSair={() => undefined}
      >
        <p>x</p>
      </Shell>,
    );
    for (const nome of ['Avisos da escola', 'Calendário da escola'])
      expect(within(menu()).queryAllByText(nome).length, nome).toBe(0);
    expect(within(menu()).getAllByText('Regras de notas').length).toBeGreaterThan(0);
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });
});

// A página de status é um arquivo do proxy, fora do aplicativo: aqui ela é carregada como está
function abrirStatus(respostas: { site: number; saude: unknown | null }) {
  document.body.innerHTML = (HTML_STATUS.split('<body>')[1] ?? '').split('<script')[0] ?? '';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/') return new Response('', { status: respostas.site });
      if (respostas.saude === null) throw new TypeError('sem rede');
      return new Response(JSON.stringify(respostas.saude), { status: 200 });
    }),
  );
  new Function(JS_STATUS)();
}
const textos = () => [...document.querySelectorAll('#servicos .texto')].map((t) => t.textContent);

describe('página de status (proxy)', () => {
  it('tudo funcionando: texto literal e círculo cheio; sem dado escolar; axe sem violações', async () => {
    abrirStatus({ site: 200, saude: { status: 'ok', banco: 'ok' } });
    await waitFor(() =>
      expect(textos()).toEqual([
        'O site está funcionando.',
        'O sistema de login está funcionando.',
        'O banco de dados está funcionando.',
      ]),
    );
    expect(document.querySelectorAll('#servicos li.ok')).toHaveLength(3);
    expect(document.getElementById('quando')?.textContent).toMatch(
      /^Conferido hoje \(\d{2}\/\d{2}\), às \d{2}:\d{2}\.$/,
    );
    expect((await axe.run(document.body, semContraste)).violations).toEqual([]);
  });

  it('banco fora e site em manutenção: diz isso em palavras', async () => {
    abrirStatus({ site: 503, saude: { status: 'ok', banco: 'fora' } });
    await waitFor(() =>
      expect(textos()).toEqual([
        'O site está em manutenção agora.',
        'O sistema de login está funcionando.',
        'O banco de dados está fora do ar agora.',
      ]),
    );
  });

  it('API sem resposta: login e banco aparecem fora do ar, sem erro na página', async () => {
    abrirStatus({ site: 502, saude: null });
    await waitFor(() =>
      expect(textos()).toEqual([
        'O site está fora do ar agora.',
        'O sistema de login está fora do ar agora.',
        'O banco de dados está fora do ar agora.',
      ]),
    );
    expect(document.querySelectorAll('#servicos li.ok')).toHaveLength(0);
  });
});
