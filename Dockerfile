FROM node:4.2

COPY package.json /src/package.json
RUN cd /src; npm install

COPY . /src

EXPOSE 5000

WORKDIR /src
CMD ["npm", "start"]
