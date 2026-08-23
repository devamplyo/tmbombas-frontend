FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY nginx.conf.template /etc/nginx/templates/default.conf.template


COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

ENV API_BACKEND_URL=http://th_piscinas_api:4015

EXPOSE 80

# localhost → 127.0.0.1
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ || exit 1