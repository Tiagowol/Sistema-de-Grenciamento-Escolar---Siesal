import { carregarPreferencias } from './preferencias';

// Linguagem curta (L17, item 1). Todos os textos que mudam ficam neste arquivo, para a revisão do NAPNE.
// Regra: texto literal, sem pressão, sem ironia, sem duplo sentido, sem metáfora (CLAUDE.md, seção 5).
// "normal" é o texto de sempre; "curta" aparece quando o aluno liga a opção em Acessibilidade.
// Marcadores entre chaves ({nome}, {data}) são trocados pelo valor na tela.
export const TEXTOS = {
  meuDiaOlho: { normal: 'Meu espaço de aprendizagem', curta: 'Meu dia' },
  meuDiaTitulo: {
    normal: 'Olá, {nome}! Vamos por partes.',
    curta: 'Olá, {nome}. Vamos por partes.',
  },
  meuDiaSub: {
    normal: 'Hoje é {data}. Você não precisa resolver tudo agora.',
    curta: 'Hoje é {data}. Uma coisa de cada vez.',
  },
  meuDiaPassoTag: { normal: 'SEU PRÓXIMO PEQUENO PASSO', curta: 'PRÓXIMO PASSO' },
  meuDiaPassoTexto: {
    normal: 'Começar por um bloco curto já conta. Você pode continuar depois.',
    curta: 'Comece com um bloco curto.',
  },
  meuDiaNadaTexto: {
    normal: 'Cadastre uma atividade ou escolha algo leve para revisar.',
    curta: 'Cadastre uma atividade.',
  },
  meuDiaAtencaoSub: {
    normal: 'Organizadas para ajudar, não para pressionar.',
    curta: 'As próximas atividades.',
  },
  escolhaTitulo: { normal: 'Escolha o que fazer agora', curta: 'Escolha o que fazer agora' },
  escolhaSub: {
    normal: 'Uma etapa por vez. Você escolhe se começa, se vê outra ou se deixa para depois.',
    curta: 'Uma etapa por vez.',
  },
  escolhaAgoraNao: {
    normal: 'Tudo bem. Este cartão volta quando você abrir o Meu dia de novo.',
    curta: 'Tudo bem. O cartão volta depois.',
  },
  escolhaVazio: {
    normal: 'Nenhuma atividade aberta. Quando você cadastrar uma, ela aparece aqui.',
    curta: 'Nenhuma atividade aberta.',
  },
  atividadesOlho: { normal: 'Organização por etapas', curta: 'Etapas' },
  atividadesSub: {
    normal: 'Você pode concluir uma etapa de cada vez, sem perder a visão do prazo.',
    curta: 'Faça uma etapa de cada vez.',
  },
  agendaTitulo: { normal: 'Agenda visual e planejamento', curta: 'Agenda' },
  agendaSub: {
    normal: 'Veja compromissos e blocos de estudo em uma linha do tempo.',
    curta: 'Seus compromissos e blocos de estudo.',
  },
  focoOlho: { normal: 'Estudo sem excesso de estímulos', curta: 'Foco' },
  focoSub: {
    normal: 'Escolha uma atividade e um bloco curto. Pausas e recomeços fazem parte.',
    curta: 'Escolha uma atividade. Escolha um bloco.',
  },
  ajudaTitulo: { normal: 'Pedir ajuda', curta: 'Pedir ajuda' },
} as const;

export type ChaveTexto = keyof typeof TEXTOS;

export const linguagemCurtaLigada = (): boolean => carregarPreferencias().linguagemCurta;

// Devolve o texto na forma escolhida pelo aluno, já com os valores no lugar dos marcadores
export function texto(
  chave: ChaveTexto,
  valores: Record<string, string> = {},
  curta: boolean = linguagemCurtaLigada(),
): string {
  const base: string = TEXTOS[chave][curta ? 'curta' : 'normal'];
  return base.replace(/\{(\w+)\}/g, (_, nome: string) => valores[nome] ?? '');
}
