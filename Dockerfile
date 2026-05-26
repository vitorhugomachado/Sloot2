# Build sem Nixpacks/Nix — evita "No space left on device" no Railway
FROM node:20-alpine AS build
# Railway injeta RAILWAY_GIT_COMMIT_SHA no build — usado em /health para confirmar versão
ARG RAILWAY_GIT_COMMIT_SHA=unknown
ENV APP_GIT_SHA=$RAILWAY_GIT_COMMIT_SHA

# Vite envs must exist at build-time (VITE_* are baked into the bundle)
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/

# --ignore-scripts: postinstall chama prisma generate antes do schema existir (só package.json nesta camada)
RUN npm ci --include=dev --no-fund --no-audit --ignore-scripts \
  && cd server && npm ci --no-fund --no-audit --ignore-scripts

COPY . .
RUN cd server && npx prisma generate && cd .. && npm run build

FROM node:20-alpine AS runner
ARG RAILWAY_GIT_COMMIT_SHA=unknown
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_SPA=true
ENV APP_GIT_SHA=$RAILWAY_GIT_COMMIT_SHA

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

EXPOSE 3000
CMD ["node", "server/index.js"]
