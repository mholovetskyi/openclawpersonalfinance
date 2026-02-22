FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY tsconfig.json ./
COPY src ./src

RUN npm install -g typescript && tsc

EXPOSE 3001

CMD ["node", "dist/index.js"]
