// Import Statements
const express = require("express");
const ws = require("ws");
const app = express();

// Websocket Server
const wsServer = new ws.Server({ noServer: true });
wsServer.on("connection", (socket) => {
  console.log("socket");
  socket.on("message", (message) => console.log(message.toString()));
});

// Express Server
const server = app.listen(3000);
console.log("listening");
server.on("upgrade", (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (socket) => {
    wsServer.emit("connection", socket, request);
  });
});

app.get("/", (req, res) => {
  console.log("get route");
  res.end();
});
