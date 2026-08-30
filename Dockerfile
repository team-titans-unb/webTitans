# Etapa 0: dependências (node_modules do Linux) — usada pelo docker compose no dev
FROM node:22.19.0-alpine3.22 AS deps
WORKDIR /app
COPY package*.json ./
COPY scripts/ ./scripts/
RUN npm ci

# Etapa 1: build da aplicação Next.js
FROM deps AS builder
COPY . .
RUN npm run build

# Etapa 2: imagem final enxuta (usa o output "standalone" do Next)
FROM node:22.19.0-alpine3.22 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8080
CMD ["node", "server.js"]
