// Import Statements
const express = require("express");
const ws = require("ws");
const path = require("path");
const { World, Entities, uuid, clamp } = require("./agarServer");

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
  ws.timestamps = [];
  ws.gameStatus = {
    init: false,
    tickReady: false,
  };
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
  if (!(data instanceof Buffer)) {
    console.log(data);
    throw new Error("data is not binary");
  }

  const dataView = new DataView(new Uint8Array(data).buffer.slice(1));

  try {
    switch (new Uint8Array(data)[0]) {
      case 0:
        if (this.gameStatus.init == true)
          throw new Error("Game already initialized");
        console.log("init");
        this.gameStatus.init = true;
        await fetchWorld.bind(this)();
        this.send(await createMessage(2));
        break;
      case 1:
        if (this.queue.length == 0) throw new Error("No queue to process");
        this.send(this.queue.shift());
        break;
      case 7:
        this.gameStatus.tickReady = true;
        break;
      case 9:
        // Rate Limiting
        this.timestamps.push(Date.now());
        if (this.timestamps.length > 16) {
          const length = this.timestamps.length;
          for (let i = 0; i < length - 16; i++) {
            this.timestamps.shift();
          }
          if (this.timestamps[15] - this.timestamps[0] < 1000)
            throw new Error("Rate Limit");
        }
        const user = world.users[this.id.UUID];
        user.mouse.x = clamp(dataView.getFloat64(0), -1, 1);
        user.mouse.y = clamp(dataView.getFloat64(8), -1, 1);
        break;
    }
  } catch (error) {
    console.log(error);
    this.send(await createMessage(255));
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

  this.queue.push(await createMessage(4, await getUser.bind(this)()));

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

  this.queue.push(await createMessage(6));
}

/**
 * @returns {ArrayBuffer}
 */
function getUser() {
  const posBuffer = new ArrayBuffer(16);
  return new Blob([
    (new DataView(posBuffer).setFloat64(0, world.users[this.id.UUID].x),
    posBuffer),
    (new DataView(posBuffer).setFloat64(8, world.users[this.id.UUID].y),
    posBuffer),
  ]).arrayBuffer();
}

/**
 * @param {Array} tickData
 */
function* sendTick(tickData) {
  for (const ws of wsServer.clients) {
    yield new Promise(async function (resolve, reject) {
      if (ws.gameStatus.tickReady) {
        const infoView = new DataView(new ArrayBuffer(4));
        ws.send(
          await createMessage(
            8,
            (infoView.setUint32(
              0,
              new Uint8Array([Object.keys(world.entities).length])
            ),
            infoView),
            await getUser.bind(ws)(),
            ...tickData
          )
        );
      }
      resolve();
    });
  }
}

function* createData() {
  for (const [uuid, entity] of Object.entries(world.entities)) {
    yield new Promise(async function (resolve, reject) {
      try {
        const infoView = new DataView(new ArrayBuffer(20));
        const data = await new Blob([
          new Uint8Array([0]),
          (infoView.setFloat64(0, entity.x),
          infoView.setFloat64(8, entity.y),
          infoView.setFloat32(16, entity.radius),
          infoView.buffer),
          entity.uuid.buff,
        ]).arrayBuffer();
        resolve(data);
      } catch (error) {
        resolve(await new Blob([new Uint8Array([])]).arrayBuffer());
      }
    });
  }
}

/**
 * @param {0|1|2|3} depth
 */
async function gameTick(depth) {
  if (wsServer.clients.size !== 0) {
    // Update World
    world.update();
    if (depth == 0) {
      // Make Tick data
      const tickData = await Promise.all(createData());
      // Send Ticks
      await Promise.all(sendTick(tickData));
    }
  }
  setTimeout(gameTick, 25, (depth + 1) % 4);
}

setTimeout(gameTick, 25, 0);
