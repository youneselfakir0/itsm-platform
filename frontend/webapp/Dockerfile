# Build stage
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
COPY frontend/webapp/package.json ./frontend/webapp/
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build --workspace @itsm/webapp

# Static serve stage
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/frontend/webapp/dist /usr/share/nginx/html
COPY nginx/webapp.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
