import { criarApp } from './app.js';
import { criarBanco } from './banco/withTenant.js';

// Rotas de autenticação só entram com DATABASE_URL e AUTH_SECRET; sem eles, só /saude
const urlBanco = process.env.DATABASE_URL;
const app = criarApp({
  banco: urlBanco ? criarBanco(urlBanco) : undefined,
  authSecret: process.env.AUTH_SECRET,
  logger: true,
});

// Porta interna fixa; a publicação no host é feita pelo compose.yaml
await app.listen({ port: 3000, host: '0.0.0.0' });
