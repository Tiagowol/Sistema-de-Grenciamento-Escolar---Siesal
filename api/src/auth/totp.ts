import { createHmac, randomBytes } from 'node:crypto';

// TOTP (RFC 6238) com HMAC-SHA1, 30 s e 6 dígitos: compatível com os aplicativos comuns.
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PASSO_SEGUNDOS = 30;

export function base32Codificar(dados: Buffer): string {
  let bits = 0;
  let valor = 0;
  let saida = '';
  for (const byte of dados) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

export function base32Decodificar(texto: string): Buffer {
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const letra of texto.toUpperCase().replace(/=+$/, '')) {
    const indice = ALFABETO.indexOf(letra);
    if (indice < 0) throw new Error('Base32 inválido');
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function gerarSegredoTotp(): Buffer {
  return randomBytes(20);
}

export function passoDe(agora: Date): number {
  return Math.floor(agora.getTime() / 1000 / PASSO_SEGUNDOS);
}

export function codigoTotp(segredo: Buffer, passo: number): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const hmac = createHmac('sha1', segredo).update(contador).digest();
  const deslocamento = (hmac[19] ?? 0) & 0x0f;
  const numero =
    (((hmac[deslocamento] ?? 0) & 0x7f) << 24) |
    (((hmac[deslocamento + 1] ?? 0) & 0xff) << 16) |
    (((hmac[deslocamento + 2] ?? 0) & 0xff) << 8) |
    ((hmac[deslocamento + 3] ?? 0) & 0xff);
  return String(numero % 1_000_000).padStart(6, '0');
}

// Aceita o passo atual e 1 anterior/seguinte (relógios um pouco diferentes).
// Um passo já usado (ultimoPasso) nunca vale de novo. Devolve o passo aceito ou null.
export function verificarTotp(
  segredo: Buffer,
  codigo: string,
  agora: Date,
  ultimoPasso: number | null,
): number | null {
  if (!/^\d{6}$/.test(codigo)) return null;
  const atual = passoDe(agora);
  for (const passo of [atual - 1, atual, atual + 1]) {
    if (ultimoPasso !== null && passo <= ultimoPasso) continue;
    if (codigoTotp(segredo, passo) === codigo) return passo;
  }
  return null;
}

export function uriOtpauth(emissor: string, conta: string, segredo: Buffer): string {
  const rotulo = encodeURIComponent(`${emissor}:${conta}`);
  return `otpauth://totp/${rotulo}?secret=${base32Codificar(segredo)}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=6&period=${PASSO_SEGUNDOS}`;
}
