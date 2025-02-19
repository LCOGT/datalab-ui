FROM node:16 as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY ./ .
RUN npm run build

FROM nginx:1.15-alpine
RUN mkdir -p /app && rm -rf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /app
RUN echo -e "	server {\n" \
            "		listen	8989;\n" \
            "		listen  [::]:8989;\n" \
            "		server_name	localhost;\n" \
            "		location / {\n" \
            "			root   /app;\n" \
            "			index  index.html;\n" \
            "			try_files \$uri \$uri/ /index.html;\n" \
            "			add_header 'Cross-Origin-Embedder-Policy' 'require-corp';\n" \
            "			add_header 'Cross-Origin-Opener-Policy' 'same-origin';\n" \
            "		}\n" \
            "	}\n" \
            > /etc/nginx/conf.d/datalab.conf

ENTRYPOINT [ "nginx", "-g", "daemon off;" ]
