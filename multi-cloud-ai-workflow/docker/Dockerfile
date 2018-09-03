FROM node:8

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY bin ./bin
COPY server.js ./
COPY routes.js ./
COPY transform.js ./
COPY package*.json ./

RUN npm install

# If you are building your code for production

# RUN npm install --only=production

# Bundle app sourceCOPY . .

EXPOSE 8080
CMD [ "npm", "start" ]