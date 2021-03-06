FROM node:14.15.3

ENV BASE_URL=http://localhost:3000
ENV HOST=0.0.0.0
ENV PORT=3000

RUN mkdir -p /usr/src/nuxt-app
WORKDIR /usr/src/nuxt-app
COPY . /usr/src/nuxt-app

RUN npm ci
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
