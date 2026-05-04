FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.base.json /app/
COPY packages/contracts /app/packages/contracts
COPY apps/web /app/apps/web
COPY data /app/data

RUN npm install
RUN npm run build:web

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone /app/
COPY --from=builder /app/apps/web/.next/static /app/apps/web/.next/static

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
