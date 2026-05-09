FROM node:22-alpine AS base
RUN npm install -g @angular/cli
WORKDIR /app

# ── development ────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4200
CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--disable-host-check"]

# ── builder ────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN ng build --configuration production

# ── production (nginx) ─────────────────────────────
FROM nginx:alpine AS production
COPY --from=builder /app/dist/erp-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
