import { criarApp } from './app.js';
import { criarEnviadorSmtp } from './auth/email.js';
import { criarBanco } from './banco/withTenant.js';

// Rotas de autenticação só entram com DATABASE_URL e AUTH_SECRET; sem eles, só /saude
const urlBanco = process.env.DATABASE_URL;
const app = criarApp({
  banco: urlBanco ? criarBanco(urlBanco) : undefined,
  authSecret: process.env.AUTH_SECRET,
  cookieLocal: process.env.AUTH_MODO_LOCAL === 'sim',
  instituicaoPadrao: process.env.INSTITUICAO_PADRAO_ID || undefined,
  trustProxy: process.env.TRUST_PROXY === 'sim',
  logger: true,
  // 20c-2: chave do CPF (segredo próprio) e caixa de teste de e-mail (Mailpit); sem elas, o recurso fica desligado
  chaveCpf: process.env.CPF_CHAVE || undefined,
  enviarEmail: process.env.EMAIL_TESTE_HOST
    ? criarEnviadorSmtp(
        process.env.EMAIL_TESTE_HOST,
        Number(process.env.EMAIL_TESTE_PORTA ?? 1025),
        'nao-responda@siesal.local',
      )
    : undefined,
  linkBase: process.env.LINK_BASE || undefined,
  ambiente: process.env.SIESAL_AMBIENTE,
});

// Porta interna fixa; a publicação no host é feita pelo compose.yaml
await app.listen({ port: 3000, host: '0.0.0.0' });
