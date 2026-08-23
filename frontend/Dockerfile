# CHAINVISION frontend — dev-server Dockerfile (hackathon simplicity).
# Runs the Vite dev server directly rather than a build+static-serve stage,
# since fast iteration matters more than a production build for this timeline.

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
