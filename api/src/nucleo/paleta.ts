// Paleta de cores de destaque (L17b). Cada cor tem um valor para cada tema e só vale se for legível:
// a razão de contraste (WCAG 2.2, critério 1.4.3) é de pelo menos 4,5 para 1 contra o fundo do tema
// e contra o texto que fica sobre o botão de destaque. Este arquivo existe igual em shared, api/src/nucleo e
// web/src; o teste em verificacao/ confere que as três cópias são iguais e que toda cor passa.
// L20a: alto contraste claro e alto contraste escuro são temas distintos (4 valores)
export const TEMAS = ['claro', 'escuro', 'alto_contraste', 'alto_contraste_escuro'] as const;
export type Tema = (typeof TEMAS)[number];

export const FUNDO_DO_TEMA: Record<Tema, string> = {
  claro: '#ffffff',
  escuro: '#152940',
  alto_contraste: '#ffffff',
  alto_contraste_escuro: '#000000',
};
export const TEXTO_SOBRE_DESTAQUE: Record<Tema, string> = {
  claro: '#ffffff',
  escuro: '#0c1829',
  alto_contraste: '#ffffff',
  alto_contraste_escuro: '#000000',
};

export const CORES = [
  {
    id: 'azul',
    nome: 'Azul',
    claro: '#155bb4',
    escuro: '#8cbcff',
    alto_contraste: '#003caa',
    alto_contraste_escuro: '#91c6ff',
  },
  {
    id: 'verde',
    nome: 'Verde',
    claro: '#087f78',
    escuro: '#77ddd0',
    alto_contraste: '#006458',
    alto_contraste_escuro: '#81ffe5',
  },
  {
    id: 'roxo',
    nome: 'Roxo',
    claro: '#6650a5',
    escuro: '#cdb3ff',
    alto_contraste: '#4a3590',
    alto_contraste_escuro: '#d8c4ff',
  },
  {
    id: 'rosa',
    nome: 'Rosa',
    claro: '#a02c6b',
    escuro: '#f5a9cf',
    alto_contraste: '#7e1450',
    alto_contraste_escuro: '#ffb3d6',
  },
  {
    id: 'laranja',
    nome: 'Laranja',
    claro: '#9a4a00',
    escuro: '#ffb877',
    alto_contraste: '#7a3800',
    alto_contraste_escuro: '#ffc88f',
  },
  {
    id: 'cinza',
    nome: 'Cinza',
    claro: '#4b5563',
    escuro: '#c3ccd8',
    alto_contraste: '#2d3642',
    alto_contraste_escuro: '#d5dce6',
  },
] as const;
export type CorId = (typeof CORES)[number]['id'];
export const IDS_DE_COR: readonly string[] = CORES.map((c) => c.id);

// Ícones que o aluno pode escolher para um tipo de atividade
export const ICONES_DE_TIPO = [
  'book',
  'tasks',
  'focus',
  'spark',
  'heart',
  'school',
  'clock',
  'chart',
  'file',
  'message',
  'calendar',
] as const;

function canais(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function razaoDeContraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

export const CONTRASTE_MINIMO = 4.5;

export function valorDaCor(id: string, tema: Tema): string | null {
  const cor = CORES.find((c) => c.id === id);
  return cor ? cor[tema] : null;
}

// Combinação legível: a cor sobre o fundo e o texto do botão sobre a cor, ambos com 4,5 ou mais
export function combinacaoLegivel(id: string, tema: Tema): boolean {
  const valor = valorDaCor(id, tema);
  if (!valor) return false;
  return (
    razaoDeContraste(valor, FUNDO_DO_TEMA[tema]) >= CONTRASTE_MINIMO &&
    razaoDeContraste(valor, TEXTO_SOBRE_DESTAQUE[tema]) >= CONTRASTE_MINIMO
  );
}

// ---- L20a: cores derivadas da cor de destaque (fundo suave, menu, painel de boas-vindas e marca) ----
function paraHex(c: [number, number, number]): string {
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}
// Mistura "a" com "b": parte = quanto de "a" entra (0 a 1)
export function misturar(a: string, b: string, parte: number): string {
  const [x, y] = [canais(a), canais(b)];
  return paraHex(
    [0, 1, 2].map((i) => (x[i] as number) * parte + (y[i] as number) * (1 - parte)) as [
      number,
      number,
      number,
    ],
  );
}
// Escurece a cor, passo a passo, até ter o contraste pedido contra o branco (texto branco por cima)
export function escurecerAte(hex: string, minimo: number): string {
  let c = hex;
  for (let i = 0; i < 40 && razaoDeContraste(c, '#ffffff') < minimo; i++)
    c = misturar(c, '#000000', 0.9);
  return c;
}
// Clareia a cor, passo a passo, até ter o contraste pedido contra um fundo escuro (marca do item do menu)
export function clarearAte(hex: string, fundo: string, minimo: number): string {
  let c = hex;
  for (let i = 0; i < 40 && razaoDeContraste(c, fundo) < minimo; i++)
    c = misturar(c, '#ffffff', 0.9);
  return c;
}
// Fundo suave: a maior mistura (até 18%) em que a própria cor ainda passa em 4,5:1 sobre ele
export function suaveDaCor(valor: string, tema: Tema): string {
  const fundo = FUNDO_DO_TEMA[tema];
  for (let p = 0.18; p > 0.02; p -= 0.02) {
    const s = misturar(valor, fundo, p);
    if (razaoDeContraste(valor, s) >= CONTRASTE_MINIMO) return s;
  }
  return fundo;
}
// Variáveis do tema que mudam com a cor. Menu e painel têm texto claro por cima: o fundo deles
// sempre passa de 7:1 contra o branco (menu: 12:1).
export function derivadasDaCor(valor: string, tema: Tema): Record<string, string> {
  const forte = escurecerAte(valor, 7);
  const menu = escurecerAte(valor, 12);
  return {
    '--primary': valor,
    '--primary-soft': suaveDaCor(valor, tema),
    '--menu-a': menu,
    '--menu-b': escurecerAte(valor, 15),
    '--hero-a': forte,
    '--hero-b': misturar(forte, menu, 0.6),
    '--hero-c': menu,
    '--brand-a': forte,
    '--brand-b': menu,
    '--menu-active': forte,
    '--menu-accent': clarearAte(valor, menu, 4.5),
  };
}
