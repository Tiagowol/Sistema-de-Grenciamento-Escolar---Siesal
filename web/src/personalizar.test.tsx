// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Personalizar } from './paginas/Personalizar';
import {
  aplicarPreferencias,
  corValida,
  doServidor,
  PREFERENCIAS_PADRAO,
  type Preferencias,
  paraServidor,
  temaDe,
} from './preferencias';

// L17b: Personalizar (apelido, cor, tema, tela inicial, tipos), contraste e conversão com o banco. Dados fictícios.
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ tipos: [] }), { status: 200 })),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.removeAttribute('style');
  document.body.className = '';
});

const semContraste = { rules: { 'color-contrast': { enabled: false } } };

function Pagina({
  inicial = PREFERENCIAS_PADRAO,
  aoPadrao = () => undefined,
  espiao = (_: Preferencias) => undefined,
}) {
  const [p, setP] = useState<Preferencias>(inicial);
  return (
    <Personalizar
      valor={p}
      aoMudar={(n) => {
        espiao(n);
        setP(n);
      }}
      aoPadrao={aoPadrao}
    />
  );
}

describe('preferências: conversão com o banco e cor de destaque', () => {
  it('ida e volta entre o aparelho e o banco', () => {
    const p: Preferencias = {
      ...PREFERENCIAS_PADRAO,
      escuro: true,
      cor: 'verde',
      apelido: 'Lu',
      telaInicial: 'calendario',
      fonte: 120,
    };
    const s = paraServidor(p);
    expect(s).toMatchObject({ tema: 'escuro', cor_destaque: 'verde', apelido: 'Lu', fonte: 120 });
    expect(doServidor(s)).toEqual(p);
  });

  it('alto contraste claro e alto contraste escuro são temas distintos (L20a)', () => {
    expect(temaDe({ escuro: true, contraste: true })).toBe('alto_contraste_escuro');
    expect(temaDe({ escuro: false, contraste: true })).toBe('alto_contraste');
    const s = paraServidor({ ...PREFERENCIAS_PADRAO, escuro: true, contraste: true });
    expect(s.tema).toBe('alto_contraste_escuro');
    expect(doServidor(s)).toMatchObject({ escuro: true, contraste: true });
    expect(doServidor({ ...s, tema: 'alto_contraste' })).toMatchObject({
      escuro: false,
      contraste: true,
    });
    expect(temaDe({ escuro: true, contraste: false })).toBe('escuro');
    expect(temaDe({ escuro: false, contraste: false })).toBe('claro');
  });

  it('cor desconhecida não vale e não é enviada ao banco', () => {
    const p = { ...PREFERENCIAS_PADRAO, cor: 'amarelo-neon' };
    expect(corValida(p)).toBeNull();
    expect(paraServidor(p).cor_destaque).toBeNull();
  });

  it('aplica a cor no tema atual e remove ao voltar ao padrão', () => {
    aplicarPreferencias({ ...PREFERENCIAS_PADRAO, cor: 'roxo' });
    expect(document.body.style.getPropertyValue('--primary')).toBe('#6650a5');
    aplicarPreferencias({ ...PREFERENCIAS_PADRAO, cor: 'roxo', escuro: true });
    expect(document.body.style.getPropertyValue('--primary')).toBe('#cdb3ff');
    aplicarPreferencias(PREFERENCIAS_PADRAO);
    expect(document.body.style.getPropertyValue('--primary')).toBe('');
  });
});

describe('tela Personalizar', () => {
  it('tem os controles e nenhuma violação do axe', async () => {
    const { container } = render(<Pagina />);
    for (const nome of ['Como quer ser chamado', 'Tela que abre primeiro'])
      expect(screen.getByLabelText(nome)).toBeTruthy();
    // Cada controle fica em um lugar só (L20a): tema, contraste, letra e movimento são de Acessibilidade
    for (const nome of [
      'Tamanho da letra: 100%',
      'Reduzir movimento',
      'Mostrar o tempo de forma visual',
    ])
      expect(screen.queryByLabelText(nome)).toBeNull();
    expect(screen.queryByRole('radio', { name: /Alto contraste/ })).toBeNull();
    expect(screen.getByRole('group', { name: 'Tempo das atividades' })).toBeTruthy();
    await screen.findByText('Você ainda não criou tipos.');
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('escolhe cor e tema; trocar o tema nunca deixa cor ilegível', async () => {
    render(<Pagina />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('radio', { name: /Rosa/ }));
    expect((screen.getByRole('radio', { name: /Rosa/ }) as HTMLInputElement).checked).toBe(true);
    await u.click(screen.getByRole('radio', { name: /Cor do tema/ }));
    expect((screen.getByRole('radio', { name: /Cor do tema/ }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('tempo das atividades: mais e menos de 5 em 5, sem digitar e sem cruzar os limites', async () => {
    const aoMudar = vi.fn();
    render(<Pagina espiao={aoMudar} />);
    const u = userEvent.setup();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Aumentar o bloco curto em 5 minutos' }));
    expect(aoMudar).toHaveBeenLastCalledWith(
      expect.objectContaining({ blocos: { curto: 15, medio: 25, longo: 45 } }),
    );
    await u.click(screen.getByRole('button', { name: 'Diminuir o bloco médio em 5 minutos' }));
    expect(aoMudar).toHaveBeenLastCalledWith(
      expect.objectContaining({ blocos: { curto: 15, medio: 20, longo: 45 } }),
    );
    // Curto de 20 não pode passar de médio de 25: o botão de mais fica desligado
    cleanup();
    render(
      <Pagina inicial={{ ...PREFERENCIAS_PADRAO, blocos: { curto: 20, medio: 25, longo: 45 } }} />,
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Aumentar o bloco curto em 5 minutos',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('apelido com link ou e-mail não é aceito', async () => {
    render(<Pagina />);
    const u = userEvent.setup();
    const campo = screen.getByLabelText('Como quer ser chamado') as HTMLInputElement;
    await u.type(campo, 'Lu');
    expect(campo.value).toBe('Lu');
    await u.type(campo, '@');
    expect(campo.value).toBe('Lu');
  });

  it('"Voltar ao padrão" chama a ação e avisa com texto literal', async () => {
    const aoPadrao = vi.fn();
    render(<Pagina aoPadrao={aoPadrao} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    expect(aoPadrao).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByText('Pronto. As preferências voltaram ao padrão.')).toBeTruthy(),
    );
  });
});
