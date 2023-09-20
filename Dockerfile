FROM oven/bun
WORKDIR /renderwebsocket
COPY . .
RUN bun install
CMD [ "bun", "app/index.js" ]
EXPOSE 3000