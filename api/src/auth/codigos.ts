import { createHash, randomBytes } from 'node:crypto';

// Códigos de recuperação do TOTP: 10 códigos de uso único, no formato XXXXX-XXXXX.
// Alfabeto sem letras parecidas (sem I, O, 0, 1).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashCodigo(codigo: string): string {
  return createHash('sha256').update(normalizarCodigo(codigo)).digest('hex');
}

export function pareceCodigoRecuperacao(codigo: string): boolean {
  return normalizarCodigo(codigo).length === 10;
}

export function gerarCodigosRecuperacao(quantidade = 10): { texto: string; hash: string }[] {
  return Array.from({ length: quantidade }, () => {
    const letras = Array.from(randomBytes(10), (b) => ALFABETO[b % ALFABETO.length]).join('');
    const texto = `${letras.slice(0, 5)}-${letras.slice(5)}`;
    return { texto, hash: hashCodigo(texto) };
  });
}
