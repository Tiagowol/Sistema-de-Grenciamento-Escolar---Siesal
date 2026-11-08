import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const argon2Async = promisify(argon2);

// Argon2id com os parâmetros mínimos da OWASP (19 MiB, 2 passadas, 1 vía). Formato PHC.
const PARAMETROS = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };

export const SENHA_MINIMA = 12;
export const SENHA_MAXIMA = 128;

// Regra por comprimento (NIST SP 800-63B-4): sem exigir símbolos nem troca periódica.
export function validarSenha(senha: string): string | null {
  if (senha.length < SENHA_MINIMA)
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (senha.length > SENHA_MAXIMA) return `A senha pode ter no máximo ${SENHA_MAXIMA} caracteres.`;
  return null;
}

const sem = (b: Buffer) => b.toString('base64').replace(/=+$/, '');

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const { memory: m, passes: t, parallelism: p } = PARAMETROS;
  const etiqueta = await argon2Async('argon2id', { message: senha, nonce: sal, ...PARAMETROS });
  return `$argon2id$v=19$m=${m},t=${t},p=${p}$${sem(sal)}$${sem(etiqueta)}`;
}

// Confere a senha com o hash PHC. Hash malformado = falso (nunca lança por entrada do banco).
export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  const partes = hash.split('$');
  const parametros = partes[3]?.match(/^m=(\d+),t=(\d+),p=(\d+)$/);
  if (partes[1] !== 'argon2id' || !parametros || !partes[4] || !partes[5]) return false;
  try {
    const esperado = Buffer.from(partes[5], 'base64');
    const calculado = await argon2Async('argon2id', {
      message: senha,
      nonce: Buffer.from(partes[4], 'base64'),
      memory: Number(parametros[1]),
      passes: Number(parametros[2]),
      parallelism: Number(parametros[3]),
      tagLength: esperado.length,
    });
    return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
  } catch {
    return false;
  }
}

// Hash fixo para gastar o mesmo tempo quando o usuário não existe (evita descobrir contas pelo tempo)
let falso: Promise<string> | undefined;
export async function verificarSenhaFalsa(senha: string): Promise<false> {
  falso ??= hashSenha(randomBytes(16).toString('hex'));
  await verificarSenha(senha, await falso);
  return false;
}
