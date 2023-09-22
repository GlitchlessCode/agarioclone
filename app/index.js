// Import Statements
const express = require("express");
const ws = require("ws");
const crypto = require("crypto");
const path = require("path");
const { World, Entity, Entities } = require("./agarServer");

const app = express();
const clients = {};

const world = new World(100n, 60n, new Entities.Player(10, 20, 2));

// Websocket Server
const wsServer = new ws.Server({ noServer: true });
wsServer.on("connection", async function (ws, req) {
  const UUID = crypto.randomUUID();
  ws.id = UUID;
  ws.queue = [];
  clients[UUID] = ws;
  ws.on("close", function (code, reason) {
    delete clients[this.id];
    console.log("Connection Closed!");
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
      const entityCount = await fetchWorld.bind(this)();
      this.send(await createMessage(2, entityCount));
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
function createMessage(status, ...data) {
  return new Blob([new Uint8Array([status]), ...data]).arrayBuffer();
}

/**
 * @this WebSocket
 */
async function fetchWorld() {
  const widthBuffer = new ArrayBuffer(8);
  const heightBuffer = new ArrayBuffer(8);
  this.queue.push(
    await createMessage(
      3,
      (new DataView(widthBuffer).setBigInt64(0, world.width), widthBuffer),
      (new DataView(heightBuffer).setBigInt64(0, world.height), heightBuffer)
    )
  );
  let count = 1;
  for (const [uuid, entity] of Object.entries(world.entities)) {
    count++;
    const infoView = new DataView(new ArrayBuffer(20));
    this.queue.push(
      await createMessage(
        4,
        new Uint8Array([0]),
        (infoView.setFloat64(0, entity.x),
        infoView.setFloat64(8, entity.y),
        infoView.setFloat32(16, entity.radius),
        infoView.buffer),
        entity.uuid.buff
      )
    );
  }
  this.queue.push(await createMessage(5));
  const countBuff = new DataView(new ArrayBuffer(4));
  countBuff.setInt32(0, count);
  return countBuff;
}
