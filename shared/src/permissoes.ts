import { z } from 'zod';
import { PERFIS, type Perfil } from './perfis.js';
import dados from './permissoes.json' with { type: 'json' };

// Matriz de permissões versionada como dado (ADR-006). Negar por padrão: o que não está no arquivo é negado.
export const ESCOPOS = ['proprio', 'vinculo', 'instituicao', 'plataforma'] as const;
export type Escopo = (typeof ESCOPOS)[number];

const esquemaEscopos = z.partialRecord(z.enum(PERFIS), z.enum(ESCOPOS));
const esquemaMatriz = z.object({
  versao: z.number().int().positive(),
  descricao: z.string(),
  recursos: z.record(z.string(), z.record(z.string(), esquemaEscopos)),
});

export type Matriz = z.infer<typeof esquemaMatriz>;

// Valida o conteúdo de uma matriz; qualquer perfil ou escopo desconhecido lança erro
export function validarMatriz(conteudo: unknown): Matriz {
  return esquemaMatriz.parse(conteudo);
}

// Falha na carga = erro na partida (arquivo inválido nunca vira permissão)
export const MATRIZ: Matriz = validarMatriz(dados);

// Devolve o escopo permitido ou null (negado). Recurso, ação ou perfil desconhecido = negado.
export function permitido(
  perfil: Perfil,
  recurso: string,
  acao: string,
  matriz: Matriz = MATRIZ,
): Escopo | null {
  const escopo = matriz.recursos[recurso]?.[acao]?.[perfil];
  return escopo ?? null;
}

// Todas as combinações perfil × recurso × ação conhecidas, com a resposta (base dos testes gerados)
export function todasAsCombinacoes(matriz: Matriz = MATRIZ) {
  const saida: { perfil: Perfil; recurso: string; acao: string; escopo: Escopo | null }[] = [];
  for (const [recurso, acoes] of Object.entries(matriz.recursos)) {
    for (const acao of Object.keys(acoes)) {
      for (const perfil of PERFIS)
        saida.push({ perfil, recurso, acao, escopo: permitido(perfil, recurso, acao, matriz) });
    }
  }
  return saida;
}
