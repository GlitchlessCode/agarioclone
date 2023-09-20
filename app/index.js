// Import Statements
const express = require("express");
const ws = require("ws");
const crypto = require("crypto");
const path = require("path");
const app = express();
const clients = {};

// Websocket Server
const wsServer = new ws.Server({ noServer: true });
wsServer.on("connection", function (ws, req) {
  const UUID = crypto.randomUUID();
  ws.id = UUID;
  ws.queue = [];
  clients[UUID] = ws;
  ws.on("close", function (code, reason) {
    delete clients[this.id];
  });
  ws.on("message", parseMessage);
  console.log("Connection Established!");
  ws.send(new ArrayBuffer(1));
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

// Functions
function parseMessage(data, isBinary) {
  if (!isBinary) throw new Error("data is not binary");
  switch (data[0]) {
    case 0:
      console.log("init");
      this.send(new Uint8Array(new ArrayBuffer(1)).fill(2));
  }
}
