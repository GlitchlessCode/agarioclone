const express = require("express");
const app = express();
const expressWs = require("express-ws")(app);

app.get("/", function (req, res, next) {
  console.log("get route");
  res.end();
});

app.ws("/", function (ws, req) {
  ws.on("message", function (msg) {
    console.log(msg);
  });
  console.log("socket");
});

app.listen(3000);
console.log("listening");
