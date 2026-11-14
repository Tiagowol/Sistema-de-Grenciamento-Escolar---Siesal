// Termo 6 (instituição/Admin), minuta v0.1 de 12/11/2026: texto sem parecer jurídico (o parecer vem no L25).
// A versão abaixo é a mesma que a API guarda na instituição (api/src/auth/termo.ts).
export const TERMO_INSTITUICAO_VERSAO = 'T6-v0.1';
export const TERMO_INSTITUICAO_ITENS: string[] = [
  'Eu declaro que represento a instituição que estou cadastrando e que tenho autorização dela para isso.',
  'A instituição responde pelas pessoas que cadastra (alunos, professores, pedagógicos e responsáveis) e pela veracidade desses dados.',
  'A instituição obtém a autorização dos responsáveis pelos alunos menores antes de cadastrá-los.',
  'O Admin cria e desativa contas só da própria instituição.',
  'Se a instituição ligar "aceitar pedidos de acompanhamento", ela decide quem atende cada pedido de aluno de fora.',
  'Notas lançadas no SIESAL e notas vindas de outro sistema são tratadas separadas. A nota vinda de outro sistema é cópia; a correção se pede no sistema de origem.',
  'A instituição avisa os administradores gerais se desconfiar de uso indevido.',
];
