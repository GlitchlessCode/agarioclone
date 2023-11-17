// Import Statements
const readline = require("readline");
const express = require("express");
const ws = require("ws");
const path = require("path");
const {
  World,
  Entities,
  Circle,
  uuid,
  clamp,
  getType,
  Player,
} = require("./agarServer");
const {
  SHARED_MEMORY_PARTITIONS,
  WORLD_SETTINGS,
} = require("./modules/config.js");
const { availableParallelism } = require("os");
const { Worker } = require("worker_threads");

const TOTAL_MEMORY_SIZE = Object.values(SHARED_MEMORY_PARTITIONS)
  .map(({ count, size }) => count * size)
  .reduce((prev, curr) => {
    return prev + curr;
  }, 0);
const SHARED_MEMORY = new Uint8Array(new SharedArrayBuffer(TOTAL_MEMORY_SIZE));

const worldParams = [
  450n,
  450n,
  SHARED_MEMORY_PARTITIONS.food.count,
  SHARED_MEMORY_PARTITIONS.virus.count,
  SHARED_MEMORY,
  SHARED_MEMORY_PARTITIONS,
  WORLD_SETTINGS,
];

const utf8 = new TextDecoder("utf-8");

/** @type {Object.<string, {changes: ArrayBuffer[], killed:{UUID:string, buff:ArrayBuffer}[]}}>} */
const syncingClients = {};

let run = true;

class Deferred {
  /** @type {function} */
  resolve;
  /** @type {function} */
  reject;

  /**@type {Promise<void>} */
  promise;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}

class Workers {
  /** @type {{worker: Worker, ready: boolean}[]} */
  static #workers;
  /** @type {{worker: Worker, ready: boolean}[]} */
  static #ready;
  static {
    this.#workers = Array.from(
      { length: Math.ceil(availableParallelism / 2) },
      () => {
        const worker = new Worker(
          path.join(__dirname, "./modules/agarWorker.js"),
          {
            workerData: {
              buff: SHARED_MEMORY.buffer,
              world: worldParams.slice(0, 2),
            },
          }
        );
        return {
          worker,
          ready: true,
        };
      }
    );
    this.#ready = [...this.#workers];
  }

  /**
   * @typedef {Object} task
   * @property {number} type
   * @property {any} data
   */

  /**
   * @param {task} task
   */
  static assign(task) {
    const channel = new MessageChannel();
    const worker = this.#ready.pop();
    worker.ready = false;

    const res = new Promise((resolve) => {
      channel.port1.once("message", (result) => {
        resolve(result);
        worker.ready = true;
        this.#ready.push(worker);
      });
    });

    const port = [channel.port2];
    worker.worker.postMessage({ task, port }, port);
    return res;
  }

  /**
   * @param  {...task} input
   */
  static async massAssign(...input) {
    let tasks =
      input.length == 1 && input[0] instanceof Array ? input[0] : input;
    if (tasks.length == 0) return [];
    let results = [];
    let complete = { count: 0, defer: new Deferred(), loopDone: false };
    let defer = new Deferred();
    let waiting = false;
    for (const [index, task] of tasks.entries()) {
      this.assign(task).then((result) => {
        if (result) results.push(result);
        complete.count++;
        if (waiting) defer.resolve();
        if (complete.loopDone && complete.count == tasks.length)
          complete.defer.resolve();
      });
      if (this.#ready.length == 0 && index < tasks.length - 1) {
        waiting = true;
        await defer.promise;
        defer = new Deferred();
        waiting = false;
      }
    }
    complete.loopDone = true;
    await complete.defer.promise;
    return results;
  }
  /**
   * @param {task} task
   */
  static async assignAll(task) {
    const defer = new Deferred();
    let complete = 0;
    /** @type {{worker:Worker, ready: boolean}[]} */
    const ready = [];
    const results = [];

    while (this.#ready.length > 0) {
      ready.push(this.#ready.pop());
    }

    for (const [i, worker] of ready.entries()) {
      const channel = new MessageChannel();
      worker.ready = false;

      const res = new Promise((resolve) => {
        channel.port1.once("message", (result) => {
          resolve(result);
          worker.ready = true;
          this.#ready.push(worker);
        });
      });

      const port = [channel.port2];
      res.then((result) => {
        complete++;
        results.push(result);
        if (complete >= ready.length) defer.resolve();
      });
      worker.worker.postMessage({ task, port }, port);
    }
    await defer.promise;
    return results;
  }
  static get length() {
    return this.#workers.length;
  }
  static async killAll() {
    for (const { worker } of Object.values(this.#workers)) {
      await worker.terminate();
    }
  }
}

const app = express();

/** @type {Object.<string, WebSocket>} */
const clients = {};

const world = new World(...worldParams);
world.update(0, Workers);

// Websocket Server
const wsServer = new ws.Server({ noServer: true });
wsServer.on("connection", async function (ws, req) {
  if (world.dealloc.user.length == 0) {
    ws.close();
    return;
  }
  const UUID = uuid();
  ws.id = UUID;
  ws.queue = [];
  ws.mouseTimestamps = [];
  ws.keyTimestamps = [];
  ws.gameStatus = {
    init: false,
    nameSet: false,
    tickReady: false,
  };
  clients[UUID.UUID] = ws;
  const rand = {
    x: Math.random() * world.width,
    y: Math.random() * world.height,
  };
  const index = world.newUserIndex;
  world.addEntities(
    new Entities.User(rand.x, rand.y, UUID, world, index),
    new Entities.Player(rand.x, rand.y, UUID.UUID, index)
  );
  ws.on("close", function (code, reason) {
    delete clients[this.id.UUID];
    if (Object.hasOwn(world.users, this.id.UUID))
      world.mem.user.deallocate(world.users[this.id.UUID].kill());
    console.log("Connection Closed!");
  });
  ws.on("message", parseMessage);
  console.log("Connection Established!");
  ws.send(await createMessage(0));
});

world.on(
  "userDeath",
  /** @param {string} result  */
  async (result) => {
    clients[result.uuid].send(await createMessage(16));
    delete clients[result.uuid];
    world.mem.user.deallocate(world.users[result.uuid].kill());
  }
);

// Express Server
const server = app.listen(3000);
server.on("upgrade", (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (socket) => {
    wsServer.emit("connection", socket, request);
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "./page/index.html"));
});

app.get("/main.js", (req, res) => {
  res.sendFile(path.join(__dirname, "./page/main.js"));
});

app.get("/modules/agar.js", (req, res) => {
  res.sendFile(path.join(__dirname, "./page/modules/agar.js"));
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(__dirname, "./page/style.css"));
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
      case 0: {
        if (this.gameStatus.init == true)
          throw new Error("Game already initialized");
        console.log("init");
        this.gameStatus.init = true;
        await fetchWorld.bind(this)();
        const infoView = new DataView(new ArrayBuffer(4));
        syncingClients[this.id.UUID] = { changes: [], killed: [] };
        const user = world.users[this.id.UUID];
        user.mouse.x = Object.values(user.players)[0].x;
        user.mouse.y = Object.values(user.players)[0].y;
        this.send(
          await createMessage(
            2,
            (infoView.setInt32(0, Object.values(world.entities).length),
            infoView.buffer)
          )
        );
        break;
      }
      case 1:
        if (this.queue.length == 0) throw new Error("No queue to process");
        this.send(this.queue.shift());
        break;
      case 7:
        this.send(
          await endLoad(syncingClients[this.id.UUID], getUser.bind(this)())
        );

        delete syncingClients[this.id.UUID];
        this.gameStatus.tickReady = true;
        break;
      case 9:
        // Rate Limiting
        this.mouseTimestamps.push(Date.now());
        if (this.mouseTimestamps.length > 16) {
          const length = this.mouseTimestamps.length;
          for (let i = 0; i < length - 16; i++) {
            this.mouseTimestamps.shift();
          }
          if (this.mouseTimestamps[15] - this.mouseTimestamps[0] < 1000)
            throw new Error("Rate Limit");
        }
        const user = world.users[this.id.UUID];
        user.mouse.x = clamp(dataView.getFloat64(0), 0, world.width);
        user.mouse.y = clamp(dataView.getFloat64(8), 0, world.height);
        break;
      case 10:
        // Rate Limiting
        this.keyTimestamps.push(Date.now());
        if (this.keyTimestamps.length > 16) {
          const length = this.keyTimestamps.length;
          for (let i = 0; i < length - 16; i++) {
            this.keyTimestamps.shift();
          }
          if (this.keyTimestamps[15] - this.keyTimestamps[0] < 1000)
            throw new Error("Rate Limit");
        }
        handleKey.bind(this, dataView.getInt8(0))();
        break;
      case 11:
        syncingClients[this.id.UUID] = { changes: [], killed: [] };
        this.gameStatus.tickReady = false;

        const entities = Object.values(world.entities);
        const infoView = new DataView(new ArrayBuffer(4));
        infoView.setUint32(0, entities.length);

        constructResync(entities).then(async (value) => {
          this.send(await createMessage(12, infoView.buffer, ...value));

          this.send(
            await endLoad(syncingClients[this.id.UUID], getUser.bind(this)())
          );
          delete syncingClients[this.id.UUID];
          this.gameStatus.tickReady = true;
        });

        break;
      case 15:
        if (this.gameStatus.nameSet == true)
          throw new Error("Name already set");

        world.users[this.id.UUID].setName(
          utf8.decode(dataView.buffer.slice(0, 72))
        );

        this.gameStatus.nameSet = true;
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
 * @param {{changes:ArrayBuffer[], killed:{UUID:string, buff:ArrayBuffer}[]}} changeData
 * @param {ArrayBuffer} user
 */
async function endLoad({ changes, killed }, user) {
  const infoView = new DataView(new ArrayBuffer(8));
  infoView.setUint32(0, changes.length);
  infoView.setUint32(4, killed.length);

  try {
    return await createMessage(
      8,
      infoView,
      user,
      ...changes,
      ...killed.map((uuid) => uuid.buff)
    );
  } catch (error) {
    console.log(error);
    return await createMessage(255);
  }
}

/**
 * @param {import('./agarServer.js').Circle[]} entities
 */
async function constructResync(entities) {
  /** @type {ArrayBuffer[]} */
  const result = [];
  for (const entity of entities) {
    result.push(await getEntity(entity));
  }
  return result;
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
    const entityData = await getEntity(entity);

    this.queue.push(await createMessage(5, entityData));
  }

  this.queue.push(await createMessage(6));
}

/**
 * @returns {ArrayBuffer}
 */
function getUser() {
  const posView = new DataView(new ArrayBuffer(20));
  if (!(world.users[this.id.UUID] instanceof Entities.User))
    delete world.users[this.id.UUID];
  return (
    posView.setFloat64(0, world.users[this.id.UUID].x),
    posView.setFloat64(8, world.users[this.id.UUID].y),
    posView.setFloat32(16, world.users[this.id.UUID].scale),
    posView.buffer
  );
}

/**
 * @this WebSocket
 * @param {0|1} keypress
 */
function handleKey(keypress) {
  const user = world.users[this.id.UUID];
  const players = Object.values(user.players);
  switch (keypress) {
    case 0:
      if (players.length >= 16) break;
      for (const player of players) {
        if (player.mass >= 35 && players.length < 16) {
          player._Partition.mutex.lockWait();
          const { x, y } = player.getVector(user.mouse, 1);
          const mult =
            2.5 * Math.sqrt(player.radius) * Math.log10(player.radius);
          world.addEntities(
            player.split(
              { x: x * mult, y: y * mult },
              world.mem.player.allocate()
            )
          );
          player._Partition.mutex.unlock();
        }
      }
      break;
    case 1:
      const { mass } = SHARED_MEMORY_PARTITIONS;
      for (const player of players) {
        if (player.mass >= 35) {
          const length = Object.values(world.mass).length;
          if (length + 1 > mass.count) {
            const culled = Object.values(world.mass)[
              Math.floor(length * Math.random())
            ];
            world.mem.mass.deallocate(culled.kill());
            delete world.mass[culled.uuid.UUID];
            delete world.entities[culled.uuid.UUID];
            world.killed.push(culled.uuid);
          }
          player._Partition.mutex.lockWait();
          const { x, y } = player.getVector(user.mouse, 1);
          world.addEntities(
            player.eject({ x: x, y: y }, world.mem.mass.allocate())
          );

          player._Partition.mutex.unlock();
        }
      }
      break;
    default:
      throw new Error("Invalid keypress");
  }
}

/**
 * @param {ArrayBuffer[]} tickData
 * @param {string[]} killedEntities
 */
function saveData(tickData, killedEntities) {
  for (const { changes, killed } of Object.values(syncingClients)) {
    changes.push(...tickData);
    killed.push(...killedEntities);
  }
}

/**
 * @param {ArrayBuffer[]} tickData
 * @param {{UUID: string, buff: ArrayBuffer}[]} killed
 * @param {number} [syncVal]
 */
function* sendTick(tickData, killed, syncVal) {
  const infoView = new DataView(new ArrayBuffer(8));
  infoView.setUint32(0, tickData.length);
  infoView.setUint32(4, killed.length);
  const msgParams = [
    8,
    infoView,
    null,
    ...tickData,
    ...killed.map((uuid) => uuid.buff),
  ];
  for (const ws of wsServer.clients) {
    yield new Promise(async function (resolve, reject) {
      if (ws.gameStatus.tickReady) {
        try {
          msgParams[2] = getUser.bind(ws)();
          if (syncVal) {
            msgParams.push(syncVal);
          }
          ws.send(await createMessage(...msgParams));
        } catch (error) {
          console.log(error);
        }
      }
      resolve();
    });
  }
}

function* createData(filter) {
  for (const [uuid, entity] of Object.entries(world.entities).filter(filter)) {
    yield new Promise(async function (resolve, reject) {
      resolve(await getEntity(entity));
    });
  }
}

async function getEntity(entity) {
  try {
    const infoView = new DataView(new ArrayBuffer(24));
    const colourValue = colour(entity.colour);

    let params = [new Uint8Array([getType(entity)]), infoView.buffer];
    infoView.setFloat64(0, entity.x);
    infoView.setFloat64(8, entity.y);
    infoView.setFloat32(16, entity.radius);
    infoView.setUint8(20, colourValue[0]);
    infoView.setUint8(21, colourValue[1]);
    infoView.setUint8(22, colourValue[2]);

    if (entity instanceof Player) {
      const user = world.users[entity.userID];
      const nameLength = user.name.buff.byteLength;
      infoView.setUint8(23, nameLength);
      params.push(user.name.buff);
    }

    params.push(entity.uuid.buff);

    return await new Blob(params).arrayBuffer();
  } catch (error) {
    return await new Blob([new Uint8Array([])]).arrayBuffer();
  }
}

/**
 * @param {{name:{NAME: string, buff: ArrayBuffer}, mass:number}[]} leaders
 */
async function sendLeaders(leaders) {
  const infoView = new DataView(new ArrayBuffer(1));
  infoView.setUint8(0, leaders.length);

  const params = [14, infoView.buffer];

  for (const leader of leaders) {
    const leaderView = new DataView(new ArrayBuffer(5));
    leaderView.setUint32(0, leader.mass);
    leaderView.setUint8(4, leader.name.buff.byteLength);
    params.push(leaderView.buffer, leader.name.buff);
  }

  for (const ws of wsServer.clients) {
    if (ws.gameStatus.tickReady) {
      try {
        ws.send(await createMessage(...params));
      } catch (error) {
        console.log(error);
      }
    }
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

const log = [];
const finalWait = new Deferred();
let max = 0;
/**
 * @param {0|1|2|3} depth
 * @param {ArrayBuffer[]} tickData
 */
async function gameTick(depth, tickData, prevTime) {
  const start = Date.now();
  if (wsServer.clients.size !== 0) {
    // Update World
    await world.update((Date.now() - prevTime) / 25, Workers);
    const end = Date.now();
    log.push(end - start);
    if (end - start > max) {
      max = end - start;
      console.log(`New Peak: ${max}ms`);
    }
    // Make Tick data
    tickData.push(
      ...(await Promise.all(
        createData((a) => {
          if (a[1] instanceof Player) {
            return true;
          }
          return a[1].different;
        })
      ))
    );
    if (depth == 0) {
      // Send Ticks w/ desync check
      await Promise.all(sendTick(tickData, world.killed, world.syncVal));
      if (Object.keys(syncingClients).length) saveData(tickData, world.killed);
      world.killed = [];
    } else if (depth % 2 == 0) {
      // Send Ticks
      await Promise.all(sendTick(tickData, world.killed));
      if (Object.keys(syncingClients).length) saveData(tickData, world.killed);
      world.killed = [];
    }

    if (depth % 20 == 0) {
      world.getLeaders().then((leaders) => {
        sendLeaders(leaders);
      });
    }

    world.reset();
  }

  if (run) {
    setTimeout(
      gameTick,
      25,
      (depth + 1) % 200,
      depth % 4 == 0 ? [] : tickData,
      start
    );
  } else {
    finalWait.resolve();
  }
}

function readLineAsync() {
  const rl = readline.createInterface({
    input: process.stdin,
  });

  return new Promise((resolve) => {
    rl.prompt();
    rl.on("line", (line) => {
      rl.close();
      resolve(line);
    });
  });
}

(async () => {
  setTimeout(gameTick, 25, 0, [], Date.now());
  console.log("Press Enter to exit");
  await readLineAsync();
  run = false;
  await finalWait.promise;
  for (const [uuid, client] of Object.entries(clients)) {
    client.send(await createMessage(255));
    client.close();
    delete clients[uuid];
    world.mem.user.deallocate(world.users[uuid].kill());
  }
  const fs = require("fs");
  if (!fs.existsSync(path.join(__dirname, "/logs/"))) {
    fs.mkdirSync(path.join(__dirname, "/logs/"), { recursive: true });
  }
  fs.writeFileSync(
    path.join(
      __dirname,
      "/logs/",
      new Date().toUTCString().replace(/(?![a-zA-Z0-9 ])./gm, "") + ".txt"
    ),
    `Time spent (ms), Tick Number${log.reduce((prev, curr, i) => {
      return prev + "\n" + curr + "," + i;
    }, "")}`
  );
  wsServer.close();
  server.close();
  await Workers.killAll();

  console.log(`Goodbye!`);

  process.exit();
})();
