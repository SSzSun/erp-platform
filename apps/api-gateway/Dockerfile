FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g @nestjs/cli

# ── development ────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "start:dev"]

# ── builder ────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── production ─────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/main"]
