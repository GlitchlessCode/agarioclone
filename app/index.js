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
  console.log("socket");
  const UUID = crypto.randomUUID();
  ws.id = UUID;
  clients[UUID] = ws;
  ws.on("close", function (code, reason) {
    delete clients[this.id];
  });
  ws.on("message", function (data, isBinary) {
    console.log(isBinary ? data : data.toString());
  });
  console.log(Object.keys(clients));
});

// Express Server
const server = app.listen(3000);
console.log("listening");
server.on("upgrade", (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (socket) => {
    wsServer.emit("connection", socket, request);
  });
});

app.use(express.static("page"));

app.get("/", (req, res) => {
  console.log("get route");
  res.sendFile(path.join(__dirname, "/index.html"));
});
