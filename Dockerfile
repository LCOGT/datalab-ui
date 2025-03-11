# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY ./ .
RUN npm run build

FROM ghcr.io/static-web-server/static-web-server:2-alpine

COPY --from=build /app /app
WORKDIR /app

RUN <<EOF cat > /etc/sws.toml
[general]
host = "0.0.0.0"
port = 8080

root = "/app/dist"
health = true

page-fallback = "/app/dist/index.html"

[advanced]

[[advanced.headers]]
source = "**/*"
[advanced.headers.headers]
Cross-Origin-Embedder-Policy = "require-corp"
Cross-Origin-Opener-Policy = "same-origin"
EOF

CMD ["static-web-server", "--config-file=/etc/sws.toml"]
EXPOSE 8080/tcp
