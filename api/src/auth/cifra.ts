import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

// AES-256-GCM para guardar o segredo do TOTP cifrado no banco. A chave vem de AUTH_SECRET.
export function derivarChave(segredoMestre: string): Buffer {
  if (segredoMestre.length < 32)
    throw new Error('AUTH_SECRET precisa ter pelo menos 32 caracteres.');
  return Buffer.from(hkdfSync('sha256', segredoMestre, 'siesal-sal-v1', 'siesal-totp', 32));
}

export function cifrar(texto: Buffer, chave: Buffer): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave, iv);
  const conteudo = Buffer.concat([cifra.update(texto), cifra.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cifra.getAuthTag().toString('base64url'),
    conteudo.toString('base64url'),
  ].join('.');
}

// Texto adulterado ou chave errada lança erro (GCM confere a etiqueta)
export function decifrar(valor: string, chave: Buffer): Buffer {
  const [versao, iv, etiqueta, conteudo] = valor.split('.');
  if (versao !== 'v1' || !iv || !etiqueta || !conteudo) throw new Error('Formato cifrado inválido');
  const decifra = createDecipheriv('aes-256-gcm', chave, Buffer.from(iv, 'base64url'));
  decifra.setAuthTag(Buffer.from(etiqueta, 'base64url'));
  return Buffer.concat([decifra.update(Buffer.from(conteudo, 'base64url')), decifra.final()]);
}
