FROM node:latest

WORKDIR /web-safety

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 8080 8000

CMD ["node", "server.js"]