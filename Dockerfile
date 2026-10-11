# ---- Build stage: install all deps, generate Prisma client, compile TS ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma7.config.ts tsconfig.json ./
COPY src ./src

RUN npx prisma generate && npm run build

# ---- Runtime stage: production deps only ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
COPY prisma7.config.ts ./
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/index.js"]
