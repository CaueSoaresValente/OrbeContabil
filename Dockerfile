# ==========================================
# Dockerfile para Deploy de Produção
# ==========================================

# 1. Etapa de dependências e build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Instala dependências do Next.js
COPY package*.json ./
RUN npm ci

# Copia código fonte
COPY . .

# Desativa coleta de telemetria do Next.js durante build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Executa build de produção
RUN npm run build

# 2. Etapa de execução (Runtime leve)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Instala dependências nativas no Linux Alpine (incluindo libc6-compat para sharp)
RUN apk add --no-cache graphicsmagick ghostscript libc6-compat

# Cria o usuário do Next.js para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia apenas os arquivos necessários do build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copia a pasta de testes contendo o PDF dummy do pdf-parse
COPY --from=builder --chown=nextjs:nodejs /app/test ./test

# Cria a pasta de clientes e atribui permissões
RUN mkdir -p /app/clientes && chown -R nextjs:nodejs /app/clientes

# Define volumes para persistência de dados fora do container
VOLUME ["/app/clientes"]

USER nextjs

EXPOSE 3000

# Executa o servidor stand-alone do Next.js
CMD ["node", "server.js"]
