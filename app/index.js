// Import Statements
const express = require("express");
const ws = require("ws");
const path = require("path");
const { World, Entities, uuid, clamp, getType } = require("./agarServer");

const app = express();
const clients = {};

const world = new World(200n, 200n, 100);

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
  const rand = {
    x: Math.random() * world.width,
    y: Math.random() * world.height,
  };
  world.addEntities(
    new Entities.User(rand.x, rand.y, UUID, world),
    new Entities.Player(rand.x, rand.y, UUID.UUID)
  );
  ws.on("close", function (code, reason) {
    delete clients[this.id.UUID];
    world.users[this.id.UUID].kill();
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
        const infoView = new DataView(new ArrayBuffer(4));
        this.send(
          await createMessage(
            2,
            (infoView.setInt32(0, Object.values(world.entities).length),
            infoView.buffer)
          )
        );
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

  this.queue.push(await createMessage(4, getUser.bind(this)()));

  for (const [uuid, entity] of Object.entries(world.entities)) {
    const infoView = new DataView(new ArrayBuffer(23));
    const colourValue = colour(entity.colour);
    this.queue.push(
      await createMessage(
        5,
        new Uint8Array([getType(entity)]),
        (infoView.setFloat64(0, entity.x),
        infoView.setFloat64(8, entity.y),
        infoView.setFloat32(16, entity.radius),
        infoView.setUint8(20, colourValue[0]),
        infoView.setUint8(21, colourValue[1]),
        infoView.setUint8(22, colourValue[2]),
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
  const posView = new DataView(new ArrayBuffer(20));
  return (
    posView.setFloat64(0, world.users[this.id.UUID].x),
    posView.setFloat64(8, world.users[this.id.UUID].y),
    posView.setFloat32(16, world.users[this.id.UUID].scale),
    posView.buffer
  );
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
            getUser.bind(ws)(),
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
        const infoView = new DataView(new ArrayBuffer(23));
        const colourValue = colour(entity.colour);
        const data = await new Blob([
          new Uint8Array([getType(entity)]),
          (infoView.setFloat64(0, entity.x),
          infoView.setFloat64(8, entity.y),
          infoView.setFloat32(16, entity.radius),
          infoView.setUint8(20, colourValue[0]),
          infoView.setUint8(21, colourValue[1]),
          infoView.setUint8(22, colourValue[2]),
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
 *
 * @param {string} hex
 * @returns {Array}
 */
function colour(hex) {
  const result = [];
  result.push(parseInt(hex.slice(1, 3), 16));
  result.push(parseInt(hex.slice(3, 5), 16));
  result.push(parseInt(hex.slice(5), 16));
  return result;
}

let count = 0;
/**
 * @param {0|1|2|3} depth
 */
async function gameTick(depth) {
  if (wsServer.clients.size !== 0) {
    count++; // ! TEMPORARY
    if (count == 200) {
      const { players } = Object.values(world.users)[0];
      world.addEntities(Object.values(players)[0].split({ x: 5, y: 0 })); // ! TEMPORARY
    } // ! TEMPORARY

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
