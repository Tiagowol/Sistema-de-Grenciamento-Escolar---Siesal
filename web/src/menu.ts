// Busca no menu (L16d): sem acento, sem diferença entre maiúscula e minúscula, com palavras equivalentes.
// A busca só olha os itens que a pessoa já pode ver; não existe atalho para tela sem permissão.
export const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export type Achado<Id extends string> = { id: Id; rotulo: string; dentroDe?: string };

type Indexavel<Id extends string> = { id: Id; rotulo: string; palavras?: readonly string[] };

// Configurações que ficam dentro da tela Acessibilidade e podem ser achadas pelo nome
export const CONFIGURACOES: { rotulo: string; palavras: string[] }[] = [
  { rotulo: 'Tamanho da fonte', palavras: ['fonte', 'letra', 'texto grande', 'aumentar', 'zoom'] },
  { rotulo: 'Tema escuro', palavras: ['escuro', 'noite', 'modo escuro', 'dark', 'cor de fundo'] },
  { rotulo: 'Alto contraste', palavras: ['contraste', 'cores fortes', 'enxergar'] },
  { rotulo: 'Leitura facilitada', palavras: ['dislexia', 'letra legivel', 'espaco entre linhas'] },
  { rotulo: 'Reduzir movimento', palavras: ['animacao', 'movimento', 'tremer', 'parado'] },
  {
    rotulo: 'Mostrar o tempo de forma visual',
    palavras: ['tempo visual', 'relogio', 'hora', 'prazo'],
  },
];

const bate = (termo: string, ...campos: string[]) =>
  campos.some((c) => normalizar(c).includes(termo));

export function buscarNoMenu<Id extends string>(
  itens: Indexavel<Id>[],
  termo: string,
  paginaConfiguracoes: Id,
): Achado<Id>[] {
  const t = normalizar(termo);
  if (!t) return itens.map((i) => ({ id: i.id, rotulo: i.rotulo }));
  const achados: Achado<Id>[] = itens
    .filter((i) => bate(t, i.rotulo, ...(i.palavras ?? [])))
    .map((i) => ({ id: i.id, rotulo: i.rotulo }));
  // Configurações só aparecem se a tela de Acessibilidade está no menu da pessoa
  if (itens.some((i) => i.id === paginaConfiguracoes))
    for (const c of CONFIGURACOES)
      if (bate(t, c.rotulo, ...c.palavras))
        achados.push({ id: paginaConfiguracoes, rotulo: c.rotulo, dentroDe: 'Acessibilidade' });
  return achados;
}
