// Import Statements
const express = require("express");
const ws = require("ws");
const crypto = require("crypto");
const path = require("path");
const { World, Entities, uuid } = require("./agarServer");

const app = express();
const clients = {};

const world = new World(
  100n,
  60n,
  new Entities.Player(10, 20, 2),
  new Entities.Player(50, 35, 1.5)
);

// Websocket Server
const wsServer = new ws.Server({ noServer: true });
wsServer.on("connection", async function (ws, req) {
  const UUID = uuid();
  ws.id = UUID;
  ws.queue = [];
  clients[UUID] = ws;
  world.addEntities(
    new Entities.User(
      Math.random() * world.width,
      Math.random() * world.height,
      UUID
    )
  );
  ws.on("close", function (code, reason) {
    delete clients[this.id.UUID];
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
      await fetchWorld.bind(this)();
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
function createMessage(status, ...data) {
  return new Blob([new Uint8Array([status]), ...data]).arrayBuffer();
}

/**
 * @this WebSocket
 */
async function fetchWorld() {
  // World
  const widthBuffer = new ArrayBuffer(8);
  const heightBuffer = new ArrayBuffer(8);
  this.queue.push(
    await createMessage(
      3,
      (new DataView(widthBuffer).setBigInt64(0, BigInt(world.width)),
      widthBuffer),
      (new DataView(heightBuffer).setBigInt64(0, BigInt(world.height)),
      heightBuffer)
    )
  );

  await enqueueUser.bind(this)();

  await enqueueEntities.bind(this)();

  this.queue.push(await createMessage(6));
}

async function enqueueUser() {
  const posBuffer = new ArrayBuffer(16);
  this.queue.push(
    await createMessage(
      4,
      (new DataView(posBuffer).setFloat64(0, world.users[this.id.UUID].x),
      posBuffer),
      (new DataView(posBuffer).setFloat64(8, world.users[this.id.UUID].y),
      posBuffer)
    )
  );
}

async function enqueueEntities() {
  for (const [uuid, entity] of Object.entries(world.entities)) {
    const infoView = new DataView(new ArrayBuffer(20));
    this.queue.push(
      await createMessage(
        5,
        new Uint8Array([0]),
        (infoView.setFloat64(0, entity.x),
        infoView.setFloat64(8, entity.y),
        infoView.setFloat32(16, entity.radius),
        infoView.buffer),
        entity.uuid.buff
      )
    );
  }
}
