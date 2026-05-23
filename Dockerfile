# Build sem Nixpacks/Nix — evita "No space left on device" no Railway
FROM node:20-alpine AS build
# Railway injeta RAILWAY_GIT_COMMIT_SHA no build — usado em /health para confirmar versão
ARG RAILWAY_GIT_COMMIT_SHA=unknown
ENV APP_GIT_SHA=$RAILWAY_GIT_COMMIT_SHA
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/

RUN npm ci --include=dev --no-fund --no-audit \
  && cd server && npm ci --no-fund --no-audit && npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
ARG RAILWAY_GIT_COMMIT_SHA=unknown
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV APP_GIT_SHA=$RAILWAY_GIT_COMMIT_SHA

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

EXPOSE 3000
CMD ["node", "server/index.js"]
