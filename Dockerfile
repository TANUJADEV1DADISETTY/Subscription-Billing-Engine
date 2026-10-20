FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src/ ./src/
COPY legacy/ ./legacy/

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/infrastructure/database/init.sql ./src/infrastructure/database/init.sql
COPY src/infrastructure/api/public ./dist/src/infrastructure/api/public
COPY src/infrastructure/api/public ./src/infrastructure/api/public

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/src/infrastructure/api/server.js"]
