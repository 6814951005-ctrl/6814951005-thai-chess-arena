FROM node:26-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY package*.json ./
RUN npm install
COPY . .
RUN DATABASE_URL="postgres://cpe:1234@localhost:5432/mydb" npx prisma generate
EXPOSE 5000
CMD ["node", "src/index.js"]