FROM node:10-buster

RUN apt update
RUN apt install -y apt-transport-https ca-certificates

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

RUN apt install -y --no-install-recommends yarn

WORKDIR /usr/src/app
COPY package.json ./
COPY yarn.lock ./

RUN yarn install
RUN yarn add medooze-media-server

COPY tsconfig.json ./
COPY typings/ typings/

COPY src/*.ts ./src/
COPY common/*.ts ./common/

ENV PORT 9000
ENV RTC_PORTS_BEGIN 9001
ENV RTC_PORTS_END 9100

EXPOSE 9000-9100/udp
EXPOSE 9000-9100/tcp

CMD [ "node", "-r", "ts-node/register", "src/App.ts" ]
