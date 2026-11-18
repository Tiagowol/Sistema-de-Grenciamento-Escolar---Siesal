// Os códigos de convite individual nunca têm 0, 1, I nem O (letras e números que se confundem).
// Se a pessoa digitou um destes, o código está errado: avisamos na hora, sem perguntar ao servidor.
export const codigoTemCaractereInvalido = (codigo: string): boolean =>
  /[01IO]/.test(codigo.toUpperCase().replace(/[^A-Z0-9]/g, ''));

export const AVISO_CODIGO_INVALIDO =
  'Este código tem uma letra ou número que não existe nos convites (0, 1, I ou O). Confira o código com quem enviou.';
