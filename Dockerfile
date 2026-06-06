FROM node:22-alpine AS dependencies

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install


FROM node:22-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY . .

RUN npm run build


FROM node:22-alpine AS production

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /usr/src/app/dist ./dist

EXPOSE 4001

CMD ["node", "dist/main.js"]