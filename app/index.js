// Import Statements
const express = require("express");
const ws = require("ws");
const crypto = require("crypto");
const path = require("path");
const app = express();
const clients = {};

// Websocket Server
const wsServer = new ws.Server({ noServer: true });
wsServer.on("connection", async function (ws, req) {
  const UUID = crypto.randomUUID();
  ws.id = UUID;
  ws.queue = [];
  clients[UUID] = ws;
  ws.on("close", function (code, reason) {
    delete clients[this.id];
  });
  ws.on("message", parseMessage);
  console.log("Connection Established!");
  ws.send(await createMessage(0));
});

// Express Server
const server = app.listen(3000);
server.on("upgrade", (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (socket) => {
    wsServer.emit("connection", socket, request);
  });
});

app.use(express.static("page"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/index.html"));
});

// * Functions
/**
 * @this WebSocket
 * @param {Buffer} data
 * @param {boolean} isBinary
 */
async function parseMessage(data, isBinary) {
  if (!isBinary) throw new Error("data is not binary");
  const dataView = new DataView(new Uint8Array(data).buffer);
  switch (new Uint8Array(data)[0]) {
    case 0:
      console.log("init");
      this.send(await createMessage(2));
      break;
    case 1:
      console.log("next");
      if (this.queue.length == 0) this.send(await createMessage(255));
      else this.send(this.queue.shift());
      break;
  }
}

/**
 * @param {number} status
 * @param  {...ArrayBuffer} [data]
 */
async function createMessage(status, ...data) {
  return await new Blob([
    new Uint8Array(1).fill(status),
    ...data,
  ]).arrayBuffer();
}
