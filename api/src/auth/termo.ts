// Termo literal do responsável (20c-2): 3 caixas. A versão vai junto com a prova do aceite (sem CPF).
// Se o texto mudar, a versão muda e o texto novo precisa ser o mesmo da Política de Privacidade.
export const TERMO_VERSAO = '1';

export function textosDoTermo(nomeAluno: string): [string, string, string] {
  return [
    `Sou o responsável legal por ${nomeAluno}.`,
    'Autorizo o uso do SIESAL por ele e o tratamento dos dados descritos na Política de Privacidade.',
    'Declaro que os dados informados são verdadeiros.',
  ];
}
