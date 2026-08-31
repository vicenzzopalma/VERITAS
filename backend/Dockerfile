FROM node:18-bullseye-slim

WORKDIR /usr/src/app

# Instala dependências básicas de compilação
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

# Build do código TypeScript
RUN npm run build || true

ENV NODE_ENV=production
ENV PORT=6002

EXPOSE 6002

CMD ["node", "dist/server.js"]