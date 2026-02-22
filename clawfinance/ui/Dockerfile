FROM node:22-alpine AS builder

WORKDIR /app

# Declare build-time env vars — Vite embeds them at build time
ARG VITE_API_URL=""
ARG VITE_WS_URL="/ws"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve with nginx — /api and /ws are proxied to the API container
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
