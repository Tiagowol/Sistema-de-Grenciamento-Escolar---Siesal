import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/prisma';
import { generateSessionToken, publicUser, createDefaultStudentData } from './authController';

/**
 * Login com Google — OAuth 2.0 Authorization Code Flow REAL.
 *
 * Fluxo completo:
 *  1. O frontend redireciona o navegador para GET /api/auth/google?state=...
 *     (o `state` é gerado no frontend e guardado no sessionStorage);
 *  2. O backend valida a configuração (GOOGLE_CLIENT_ID/SECRET) e redireciona
 *     para a tela de consentimento oficial do Google;
 *  3. O Google redireciona para GET /api/auth/google/callback?code=...&state=...;
 *  4. O backend troca o `code` pelos tokens do Google (POST /token com o
 *     client_secret), consulta o perfil em /userinfo e confere se o e-mail é
 *     verificado;
 *  5. Localiza (ou cadastra) o aluno pelo e-mail, emite o JWT padrão do SIESAL
 *     e redireciona o navegador para o frontend com um `login_code` de uso
 *     único (60 s) — o token NUNCA trafega na URL;
 *  6. O frontend troca o `login_code` por { token, usuario } em
 *     POST /api/auth/google/exchange e salva a sessão.
 *
 * Configuração necessária (backend/.env):
 *   GOOGLE_CLIENT_ID=...      → Google Cloud Console → APIs e Serviços → Credenciais
 *   GOOGLE_CLIENT_SECRET=...  → (mesma tela)
 *   Redirect URI autorizada no Google Console:
 *     http://localhost:3001/api/auth/google/callback
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

// Endpoints oficiais do Google (sobrescritáveis via .env para testes)
const GOOGLE_AUTH_URL =
  process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL =
  process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL =
  process.env.GOOGLE_USERINFO_URL || 'https://www.googleapis.com/oauth2/v3/userinfo';

// Origem do frontend para os redirects de volta (callback do navegador)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export function isGoogleConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

/** state enviados ao Google → timestamp de expiração (10 minutos) */
const pendingStates = new Map<string, number>();

/** login_code de uso único → sessão pronta (60 segundos) */
interface PendingLogin {
  token: string;
  usuario: ReturnType<typeof publicUser>;
  expires_at: number;
}
const pendingLogins = new Map<string, PendingLogin>();

const STATE_TTL_MS = 10 * 60 * 1000;
const LOGIN_CODE_TTL_MS = 60 * 1000;

// Limpeza periódica de states/códigos expirados
setInterval(() => {
  const now = Date.now();
  for (const [state, expires] of pendingStates) {
    if (expires < now) pendingStates.delete(state);
  }
  for (const [code, entry] of pendingLogins) {
    if (entry.expires_at < now) pendingLogins.delete(code);
  }
}, 60 * 1000).unref();

/** Monta a redirect_uri registrada no Google Console (sobrescritível via .env). */
function buildRedirectUri(req: Request): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
}

/** Monta a URL de retorno ao frontend (/oauth/callback) com os parâmetros dados. */
function frontendCallback(params: Record<string, string>): string {
  const url = new URL(`${FRONTEND_URL}/oauth/callback`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

interface GoogleProfile {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}

export const googleAuthController = {
  /**
   * GET /api/auth/google/status
   * Informa ao frontend se o login com Google já está configurado no servidor.
   */
  async status(_req: Request, res: Response) {
    return res.json({
      configured: isGoogleConfigured(),
      client_id: isGoogleConfigured() ? GOOGLE_CLIENT_ID : null,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || null,
    });
  },

  /**
   * GET /api/auth/google?state=...
   * Inicia o fluxo: redireciona o navegador para o consentimento do Google.
   */
  async redirectToGoogle(req: Request, res: Response) {
    const stateFromFrontend = typeof req.query.state === 'string' ? req.query.state : '';
    const state = stateFromFrontend || crypto.randomBytes(24).toString('base64url');

    // Sem credenciais configuradas: volta ao frontend com erro explicativo
    if (!isGoogleConfigured()) {
      return res.redirect(
        302,
        frontendCallback({ error: 'google_nao_configurado', state })
      );
    }

    pendingStates.set(state, Date.now() + STATE_TTL_MS);

    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', buildRedirectUri(req));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('prompt', 'select_account');

    return res.redirect(302, authUrl.toString());
  },

  /**
   * GET /api/auth/google/callback?code=...&state=...
   * Recebe a resposta do Google, valida o state, troca o código pelos tokens,
   * obtém o perfil verificado e devolve o navegador ao frontend com um
   * login_code de uso único.
   */
  async googleCallback(req: Request, res: Response) {
    const { code, state, error } = req.query as Record<string, string | undefined>;

    // Usuário cancelou o consentimento no Google
    if (error) {
      return res.redirect(
        302,
        frontendCallback({ error: 'google_autorizacao_recusada', state: state || '' })
      );
    }

    // Validação anti-CSRF do state (uso único)
    if (!state || !pendingStates.has(state)) {
      return res.redirect(302, frontendCallback({ error: 'state_invalido' }));
    }
    pendingStates.delete(state);

    if (!code) {
      return res.redirect(302, frontendCallback({ error: 'google_codigo_ausente' }));
    }

    try {
      // 1. Troca o código de autorização pelos tokens do Google
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: buildRedirectUri(req),
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        console.error('[GOOGLE OAUTH] Falha ao trocar o código:', await tokenRes.text().catch(() => ''));
        return res.redirect(302, frontendCallback({ error: 'google_token_invalido' }));
      }

      const tokens: any = await tokenRes.json();
      if (!tokens.access_token) {
        return res.redirect(302, frontendCallback({ error: 'google_token_invalido' }));
      }

      // 2. Consulta o perfil oficial do Google (e-mail verificado pelo Google)
      const userinfoRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userinfoRes.ok) {
        return res.redirect(302, frontendCallback({ error: 'google_perfil_indisponivel' }));
      }

      const profile: GoogleProfile = await userinfoRes.json();

      if (!profile.email || profile.email_verified !== true) {
        return res.redirect(302, frontendCallback({ error: 'google_email_nao_verificado' }));
      }

      const email = profile.email.trim().toLowerCase();

      // 3. Localiza ou cadastra o aluno (identidade verificada pelo Google)
      let user = await prisma.usuario.findUnique({ where: { email } });

      if (!user) {
        // Senha aleatória inutilizável: o acesso desta conta é via Google
        const unusablePassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
        user = await prisma.usuario.create({
          data: {
            nome: (profile.name || email.split('@')[0]).trim().slice(0, 100),
            email,
            senha: unusablePassword,
            status: true,
            is_admin: false,
            tentativas_falhas: 0,
          },
        });

        await createDefaultStudentData(user);
      }

      if (!user.status) {
        return res.redirect(302, frontendCallback({ error: 'conta_desativada', state }));
      }

      // 4. Emite o JWT do SIESAL e entrega via login_code de uso único (60 s)
      const token = generateSessionToken(user);
      const loginCode = crypto.randomBytes(32).toString('base64url');

      pendingLogins.set(loginCode, {
        token,
        usuario: publicUser(user),
        expires_at: Date.now() + LOGIN_CODE_TTL_MS,
      });

      return res.redirect(
        302,
        frontendCallback({ login_code: loginCode, state })
      );
    } catch (err: any) {
      console.error('[GOOGLE OAUTH] Erro no callback:', err);
      return res.redirect(302, frontendCallback({ error: 'google_falha_interna' }));
    }
  },

  /**
   * POST /api/auth/google/exchange
   * O frontend troca o login_code (uso único, 60 s) pela sessão completa.
   */
  async exchangeLoginCode(req: Request, res: Response) {
    try {
      const { code } = req.body || {};

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Código de login ausente.' });
      }

      const entry = pendingLogins.get(code);
      pendingLogins.delete(code);

      if (!entry || entry.expires_at < Date.now()) {
        return res.status(400).json({
          error: 'Código de login inválido ou expirado. Faça login com o Google novamente.',
        });
      }

      return res.json({
        message: 'Login com Google realizado com sucesso!',
        token: entry.token,
        usuario: entry.usuario,
      });
    } catch (err: any) {
      console.error('[GOOGLE OAUTH] Erro ao trocar login_code:', err);
      return res.status(500).json({ error: 'Erro ao concluir o login com Google.' });
    }
  },
};
