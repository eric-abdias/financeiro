FROM node:22-bookworm-slim

WORKDIR /app

# O subdomínio usa a raiz do domínio, sem BASE_PATH.
ENV BASE_PATH=""

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Compila a aplicação para produção.
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
