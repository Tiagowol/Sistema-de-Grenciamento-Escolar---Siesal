# Etapa 1: compila o site (React + Vite)
FROM node:26 AS build
WORKDIR /app
RUN npm install -g pnpm@12.18.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN pnpm run build

# Etapa 2: nginx sem privilégios serve o site e repassa /api para a API
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY seguranca.conf /etc/nginx/seguranca.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
