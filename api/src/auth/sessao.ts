import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

// Token de sessão opaco: "<instituicao>.<segredo>". A instituição não é segredo; serve para abrir o contexto
// da RLS antes de procurar a sessão. No banco fica só o SHA-256 do token inteiro.
export const NOME_COOKIE = '__Host-siesal_sessao';
export const DURACAO_SESSAO_SEGUNDOS = 8 * 60 * 60;
export const DURACAO_CONFIGURAR_TOTP_SEGUNDOS = 15 * 60;

const esquemaUuid = z.uuid();

export function gerarToken(instituicaoId: string): { token: string; hash: string } {
  const token = `${instituicaoId}.${randomBytes(32).toString('base64url')}`;
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function lerToken(
  token: string | undefined,
): { instituicaoId: string; hash: string } | null {
  if (!token) return null;
  const [instituicaoId, segredo, resto] = token.split('.');
  if (resto !== undefined || !segredo || !/^[A-Za-z0-9_-]{43}$/.test(segredo)) return null;
  if (!esquemaUuid.safeParse(instituicaoId).success) return null;
  return { instituicaoId: instituicaoId as string, hash: hashToken(token) };
}

// Nome e atributos do cookie. Padrão: prefixo __Host- (exige HTTPS), HttpOnly, Secure e SameSite=Strict.
// Modo local (AUTH_MODO_LOCAL=sim): só para demonstração em http://localhost ou http://IP:porta, sem Secure.
export const NOME_COOKIE_LOCAL = 'siesal_sessao';

export type ConfigCookie = { nome: string; seguro: boolean };
export const COOKIE_PADRAO: ConfigCookie = { nome: NOME_COOKIE, seguro: true };
export const COOKIE_LOCAL: ConfigCookie = { nome: NOME_COOKIE_LOCAL, seguro: false };

export function serializarCookie(
  token: string,
  duracaoSegundos: number,
  config: ConfigCookie = COOKIE_PADRAO,
): string {
  const seguro = config.seguro ? ' Secure;' : '';
  return `${config.nome}=${token}; Max-Age=${duracaoSegundos}; Path=/; HttpOnly;${seguro} SameSite=Strict`;
}

export function cookieDeSaida(config: ConfigCookie = COOKIE_PADRAO): string {
  return serializarCookie('', 0, config);
}

export function lerCookie(cabecalho: string | undefined, nome = NOME_COOKIE): string | undefined {
  for (const parte of (cabecalho ?? '').split(';')) {
    const [chave, ...valor] = parte.trim().split('=');
    if (chave === nome) return valor.join('=');
  }
  return undefined;
}
