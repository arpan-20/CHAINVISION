# CHAINVISION p1-backend — dev-server Dockerfile (hackathon simplicity).
# Runs ts-node-dev directly rather than a build+compile stage, since fast
# iteration matters more than a production build for this timeline.

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
