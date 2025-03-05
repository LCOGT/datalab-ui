# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
FROM node:22
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY ./ .
RUN npm run build
