import {
  CONTRASTE_MINIMO,
  FUNDO_DO_TEMA,
  razaoDeContraste,
  TEXTO_SOBRE_DESTAQUE,
} from '../nucleo/paleta.js';

// Regras de notas (L19): períodos com peso e arredondamento. Funções puras, sem banco.
export const ARREDONDAMENTOS = ['nenhum', 'decimo', 'meio'] as const;
export type Arredondamento = (typeof ARREDONDAMENTOS)[number];
export type Periodo = { nome: string; inicio: string; fim: string; peso: number };
export type Regra = { numero: number; arredondamento: Arredondamento; periodos: Periodo[] };
export type NotaParaMedia = {
  aluno_id: string;
  disciplina_id: string;
  disciplina_nome: string;
  dia: string;
  valor: number;
};

// Arredonda sem erro de vírgula flutuante (8,25 vira 8,3 no "décimo"; 7,75 vira 8,0 no "meio ponto")
export function arredondar(valor: number, modo: Arredondamento): number {
  const passo = modo === 'meio' ? 2 : modo === 'decimo' ? 10 : 100;
  return Math.round(Number((valor * passo).toFixed(6))) / passo;
}

// Períodos em ordem, sem sobreposição e com início antes do fim
export function periodosValidos(periodos: Periodo[]): boolean {
  for (let i = 0; i < periodos.length; i++) {
    const p = periodos[i] as Periodo;
    if (p.inicio > p.fim) return false;
    const anterior = periodos[i - 1];
    if (anterior && p.inicio <= anterior.fim) return false;
  }
  return true;
}

// Média de cada período (média simples das notas do período) e a final (média ponderada dos períodos com nota).
// Só por aluno e disciplina: nunca média da turma nem comparação entre alunos.
export function calcularMedias(regra: Regra, notas: NotaParaMedia[]) {
  const grupos = new Map<string, NotaParaMedia[]>();
  for (const n of notas) {
    const chave = `${n.aluno_id}|${n.disciplina_id}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), n]);
  }
  return [...grupos.values()].map((lista) => {
    const primeira = lista[0] as NotaParaMedia;
    const periodos = regra.periodos.map((p) => {
      const valores = lista.filter((n) => n.dia >= p.inicio && n.dia <= p.fim).map((n) => n.valor);
      const media = valores.length
        ? arredondar(valores.reduce((a, b) => a + b, 0) / valores.length, regra.arredondamento)
        : null;
      return { nome: p.nome, inicio: p.inicio, fim: p.fim, peso: p.peso, media };
    });
    const comNota = periodos.filter((p) => p.media !== null);
    const pesos = comNota.reduce((a, p) => a + p.peso, 0);
    const final = pesos
      ? arredondar(
          comNota.reduce((a, p) => a + (p.media as number) * p.peso, 0) / pesos,
          regra.arredondamento,
        )
      : null;
    return {
      aluno_id: primeira.aluno_id,
      disciplina_id: primeira.disciplina_id,
      disciplina_nome: primeira.disciplina_nome,
      periodos,
      final,
    };
  });
}

// Cor da escola: a de tema claro vale também no alto contraste; cada uma precisa de 4,5:1
// contra o fundo do tema e contra o texto que fica sobre o botão (mesma regra do L17b)
export function corDaEscolaLegivel(cor: string, tema: 'claro' | 'escuro'): boolean {
  const temas = tema === 'claro' ? (['claro', 'alto_contraste'] as const) : (['escuro'] as const);
  return temas.every(
    (t) =>
      razaoDeContraste(cor, FUNDO_DO_TEMA[t]) >= CONTRASTE_MINIMO &&
      razaoDeContraste(cor, TEXTO_SOBRE_DESTAQUE[t]) >= CONTRASTE_MINIMO,
  );
}

// Logotipo: o tipo declarado precisa bater com os primeiros bytes (PNG ou JPEG); SVG nunca
export const LOGOTIPO_MAXIMO = 200 * 1024;
export function tipoDoLogotipo(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  return null;
}
