# Build context: monorepo root (set Dockerfile Path to server/Dockerfile in Railway)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy all workspace manifests so npm ci can resolve workspaces
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci

# Copy source needed for server build
COPY shared ./shared
COPY server/tsconfig.json ./server/tsconfig.json
COPY server/prisma ./server/prisma
COPY server/src ./server/src

# Generate Prisma client and compile TypeScript
RUN node_modules/.bin/prisma generate --schema=server/prisma/schema.prisma
RUN npm run build --workspace=shared
RUN npm run build --workspace=server

# ── Production image ─────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --omit=dev

# Carry over Prisma CLI (devDep) for migration at startup
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY server/prisma ./server/prisma

EXPOSE 4000
CMD ["sh", "-c", "node_modules/.bin/prisma db push --schema=server/prisma/schema.prisma --accept-data-loss && node server/dist/server/src/index.js"]
