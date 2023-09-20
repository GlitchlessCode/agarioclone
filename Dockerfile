FROM oven/bun:1.0.1
WORKDIR /renderwebsocket
COPY . .
RUN bun install
CMD [ "bun", "app/index.js" ]
EXPOSE 3000