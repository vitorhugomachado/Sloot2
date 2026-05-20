# Build sem Nixpacks/Nix — evita "No space left on device" no Railway
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/

RUN npm ci --include=dev --no-fund --no-audit \
  && cd server && npm ci --no-fund --no-audit && npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

EXPOSE 3000
CMD ["node", "server/index.js"]
