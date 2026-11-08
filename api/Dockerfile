# Etapa 1 (dev): todas as dependências, código e esquema; base do build e dos testes
FROM node:26 AS dev
WORKDIR /app
RUN npm install -g pnpm@12.18.0
COPY package.json pnpm-lock.yaml ./
# Prisma não precisa rodar scripts de instalação (o cliente é gerado abaixo)
RUN pnpm install --frozen-lockfile --allow-build '!prisma' --allow-build '!@prisma/engines'
COPY tsconfig.json tsconfig.build.json prisma.config.ts vitest.integracao.config.ts ./
COPY prisma ./prisma
COPY migracoes ./migracoes
COPY src ./src
RUN pnpm exec prisma generate

# Etapa 2 (teste): usada só pelo serviço "teste" do compose (perfil teste)
FROM dev AS teste
CMD ["pnpm", "run", "teste:integracao"]

# Etapa 3 (build): compila e remove dependências de desenvolvimento
FROM dev AS build
RUN pnpm run build && pnpm prune --prod

# Etapa 4: imagem final, sem ferramentas de build, usuário sem privilégios
FROM node:26
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/migracoes ./migracoes
COPY --chown=node:node package.json ./
USER node
CMD ["node", "dist/servidor.js"]
