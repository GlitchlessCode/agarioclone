const WebSocket = require("ws");
const express = require("express");

const app = express();

const wss = new WebSocket.Server({ port: 3000 });
wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    console.log(`Received message => ${message}`);
  });
  ws.send("Hello! Message From Server!!");
});

app.get("/", async (req, res) => {
  res.status(200).send();
});

app.listen(5000, () => {
  console.log("Running on port 5000.");
});
