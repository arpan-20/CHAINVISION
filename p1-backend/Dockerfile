# CHAINVISION p1-backend — dev-server Dockerfile (hackathon simplicity).
# Runs ts-node-dev directly rather than a build+compile stage, since fast
# iteration matters more than a production build for this timeline.

FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["npm", "start"]
