import Fastify from 'fastify';

const app = Fastify({ logger: true });

// Rota de saúde: confirma que a API está de pé (sem dados, sem login)
app.get('/saude', async () => ({ status: 'ok' }));

// Porta interna fixa; a publicação no host é feita pelo compose.yaml
await app.listen({ port: 3000, host: '0.0.0.0' });
