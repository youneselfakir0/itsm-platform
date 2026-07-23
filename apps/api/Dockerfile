# Build stage
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json ./apps/api/
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build:api

# Runtime stage
FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY package.json ./
EXPOSE 8080
CMD ["node", "apps/api/dist/main.js"]
