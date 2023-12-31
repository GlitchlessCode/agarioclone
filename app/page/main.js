// * Import Statements
import Entities, { World, Camera, Leaderboard } from "./modules/agar.js";
//* Classes
class Deferred {
  /** @type {function} */
  resolve;
  /** @type {function} */
  reject;

  /**@type {Promise} */
  promise;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}

// * Variable Initialization
// Canvas
/** @type {HTMLCanvasElement} */
const cnv = document.querySelector("canvas");
const ctx = cnv.getContext("2d", { alpha: false });
const scale = window.devicePixelRatio;
setCanvasScale();

// Interpolator
let interpolator;

// Mouse
const mousePos = {
  x: 0,
  y: 0,
};

// Camera
const camera = new Camera(0, 0, ctx);

// Leaderboard
const leaderboard = new Leaderboard(ctx, 0.6, 0.6, 0.5, 0.2);

// World
/** @type {World} */
let world;

// Alive
let Alive = true;

// TextDecoder
const utf8 = new TextDecoder("utf-8");

// Time average
let average = 100;

// * Event Listeners
window.addEventListener("resize", setCanvasScale);

// Anonymous
cnv.addEventListener("mousemove", function ({ clientX, clientY }) {
  mousePos.x = clientX * window.devicePixelRatio;
  mousePos.y = clientY * window.devicePixelRatio;
});

// * Functions
function setCanvasScale() {
  cnv.height = Math.floor(window.innerHeight * scale);
  cnv.width = Math.floor(window.innerWidth * scale);
}

function drawFrame() {
  ctx.fillStyle = "#ddddee";
  ctx.fillRect(0, 0, cnv.width, cnv.height);
  camera.draw();
  leaderboard.draw();

  if (Alive) requestAnimationFrame(drawFrame);
}

/**
 * @param {ArrayBuffer} buff
 * @returns {string}
 */
function uuid(buff) {
  function getSymbol(_, index) {
    return (
      ([8, 12, 16, 20].includes(index) ? "-" : "") +
      new Uint8Array(buff)[index].toString(16)
    );
  }
  return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, getSymbol);
}

/**
 * @param {number} status
 * @param  {...ArrayBuffer} [data]
 */
async function createMessage(status, ...data) {
  return await new Blob([
    new Uint8Array(1).fill(status),
    ...data,
  ]).arrayBuffer();
}

let prevTime = 0;
/**
 * @this {WebSocket}
 * @param {Blob} data
 * @param {string} name
 */
async function parseMessage(data, name) {
  if (!(data instanceof Blob)) throw new Error("data is not of type Blob");
  if (typeof name !== "string") throw new Error("name is not of type string");
  const dataView = new DataView((await data.arrayBuffer()).slice(1));
  switch (new Uint8Array(await data.arrayBuffer())[0]) {
    case 8:
      average += Date.now() - prevTime;
      average /= 2;
      if (interpolator) clearTimeout(interpolator);
      interpolator = setTimeout(
        interpolatedCam,
        average / 10,
        camera.x,
        camera.y,
        camera.camScale,
        dataView.getFloat64(8),
        dataView.getFloat64(16),
        dataView.getFloat32(24),
        9
      );
      const [entityInfo, killed, syncVal] = getEntities(dataView);
      world.update(entityInfo);
      world.kill(killed);
      if (syncVal) {
        const synced = world.checkSync(syncVal);
        if (!synced) this.send(await createMessage(11));
      }
      prevTime = Date.now();
      break;
    case 14:
      leaderboard.leaders = getLeaders(dataView);
      break;
    case 12:
      world.resync(deconstructResync(dataView));
      break;
    case 0:
      console.log("init");
      this.send(await createMessage(15, new TextEncoder().encode(name)));
      this.send(await createMessage(0));
      break;
    case 2:
      console.log("worldStart");
      this.worldSize = dataView.getInt32(0);
      this.send(await createMessage(1));
      break;
    case 3:
      console.log("incomingWorld");
      world = new World(dataView.getBigInt64(0), dataView.getBigInt64(8));
      this.send(await createMessage(1));
      break;
    case 4:
      console.log("incomingCamera");
      camera.x = dataView.getFloat64(0);
      camera.y = dataView.getFloat64(8);
      camera.camScale = dataView.getFloat32(16);
      this.send(await createMessage(1));
      break;
    case 5:
      this.progress++;
      camera.loadingProgress = Math.floor(
        100 * (this.progress / this.worldSize)
      );
      let params = [
        dataView.getFloat64(1),
        dataView.getFloat64(9),
        dataView.getFloat32(17),
        colour(
          dataView.getUint8(21),
          dataView.getUint8(22),
          dataView.getUint8(23)
        ),
        utf8.decode(dataView.buffer.slice(25, 25 + dataView.getUint8(24))),
        uuid(dataView.buffer.slice(25 + dataView.getUint8(24))),
      ];
      switch (dataView.getUint8(0)) {
        case 0:
          world.addEntities(new Entities.Player(...params));
          break;
        case 1:
          world.addEntities(new Entities.Virus(...params));
          break;
        case 2:
          world.addEntities(new Entities.Food(...params));
          break;
        case 3:
          world.addEntities(new Entities.Mass(...params));
          break;
        default:
          throw new Error("invalid entity configuration recieved");
      }
      this.send(await createMessage(1));
      break;
    case 6:
      console.log("worldFinished");
      camera.changeWorld(world);
      leaderboard.show = true;
      this.send(await createMessage(7));
      prevTime = Date.now();
      setTimeout(mouseTick.bind(this), 100);
      const ws = this;
      document.addEventListener("keydown", async function ({ code }) {
        if (ws.readyState !== 1) return;
        if (code == "Space")
          ws.send(await createMessage(10, new Uint8Array([0])));
        if (code == "KeyW")
          ws.send(await createMessage(10, new Uint8Array([1])));
      });
      break;
    case 16:
      console.log("u r ded");
      Alive = false;
      this.close();
      break;
    case 255:
      throw new Error("server error");
  }
}

/**
 *
 * @param {number} startX
 * @param {number} startY
 * @param {number} startScale
 * @param {number} targetX
 * @param {number} targetY
 * @param {number} targetScale
 * @param {number} depth
 * @param {number} [divide]
 */
function interpolatedCam(
  startX,
  startY,
  startScale,
  targetX,
  targetY,
  targetScale,
  depth,
  divide = depth + 1
) {
  camera.x = (depth / divide) * startX + (1 - depth / divide) * targetX;
  camera.y = (depth / divide) * startY + (1 - depth / divide) * targetY;
  camera.camScale =
    (depth / divide) * startScale + (1 - depth / divide) * targetScale;
  world.interpolate(depth / divide, depth == 9);
  if (depth > 0) {
    interpolator = setTimeout(
      interpolatedCam,
      average / divide,
      startX,
      startY,
      startScale,
      targetX,
      targetY,
      targetScale,
      depth - 1,
      divide
    );
  }
}

/**
 * @this WebSocket
 */
async function mouseTick() {
  const mouseView = new DataView(new ArrayBuffer(16));
  const largestSize = Math.max(cnv.width, cnv.height);
  const scale = (largestSize / 100) * camera.camScale;

  this.send(
    await createMessage(
      9,
      (mouseView.setFloat64(
        0,
        (mousePos.x + camera.x * scale - cnv.width / 2) / scale
      ),
      mouseView.setFloat64(
        8,
        (mousePos.y + camera.y * scale - cnv.height / 2) / scale
      ),
      mouseView.buffer)
    )
  );

  if (this.readyState == 1) setTimeout(mouseTick.bind(this), 100);
}

/**
 *
 * @param {...number} values
 * @returns {string}
 */
function colour(...values) {
  let result = "#";
  result += values[0].toString(16).padStart(2, 0);
  result += values[1].toString(16).padStart(2, 0);
  result += values[2].toString(16).padStart(2, 0);
  return result;
}

/**
 * @typedef {Object} PseudoEntity
 * @property {0|1|2|3} type
 * @property {number} x
 * @property {number} y
 * @property {number} radius
 * @property {string} colour
 * @property {string} uuid
 */
const BUFFERSIZE = 57;
/**
 * @param {DataView} dataSet
 * @returns {[PseudoEntity[], PseudoEntity[]]}
 */
function getEntities(dataSet) {
  const entities = [];
  let nameOffset = 0;

  for (let i = 0; i < dataSet.getUint32(0); i++) {
    const entityView = new DataView(
      dataSet.buffer.slice(28 + nameOffset + i * BUFFERSIZE)
    );
    nameOffset += entityView.getUint8(24);
    entities.push({
      type: entityView.getUint8(0),
      x: entityView.getFloat64(1),
      y: entityView.getFloat64(9),
      radius: entityView.getFloat32(17),
      colour: colour(
        entityView.getUint8(21),
        entityView.getUint8(22),
        entityView.getUint8(23)
      ),
      name: utf8.decode(
        entityView.buffer.slice(25, 25 + entityView.getUint8(24))
      ),
      uuid: uuid(entityView.buffer.slice(25 + entityView.getUint8(24))),
    });
  }
  const killed = [];
  for (let i = 0; i < dataSet.getUint32(4); i++) {
    killed.push(
      uuid(
        dataSet.buffer.slice(
          28 + nameOffset + dataSet.getUint32(0) * BUFFERSIZE + i * 32,
          60 + nameOffset + dataSet.getUint32(0) * BUFFERSIZE + i * 32
        )
      )
    );
  }
  if (
    60 +
      nameOffset +
      dataSet.getUint32(0) * BUFFERSIZE +
      (dataSet.getUint32(4) - 1) * 32 !==
    dataSet.byteLength
  ) {
    const syncVal = dataSet.getUint32(
      60 +
        nameOffset +
        dataSet.getUint32(0) * BUFFERSIZE +
        (dataSet.getUint32(4) - 1) * 32
    );
    return [entities, killed, syncVal];
  }
  return [entities, killed];
}

/**
 * @param {DataView} dataSet
 */
function deconstructResync(dataSet) {
  const entityCount = dataSet.getUint32(0);

  const entities = [];
  let nameOffset = 0;

  for (let i = 0; i < entityCount; i++) {
    const entityView = new DataView(
      dataSet.buffer.slice(4 + nameOffset + i * BUFFERSIZE)
    );
    nameOffset += entityView.getUint8(24);
    entities.push({
      type: entityView.getUint8(0),
      x: entityView.getFloat64(1),
      y: entityView.getFloat64(9),
      radius: entityView.getFloat32(17),
      colour: colour(
        entityView.getUint8(21),
        entityView.getUint8(22),
        entityView.getUint8(23)
      ),
      name: utf8.decode(
        entityView.buffer.slice(25, 25 + entityView.getUint8(24))
      ),
      uuid: uuid(entityView.buffer.slice(25 + entityView.getUint8(24))),
    });
  }

  return entities;
}

/**
 * @param {DataView} dataSet
 */
function getLeaders(dataSet) {
  const leaderCount = dataSet.getUint8(0);

  const leaders = [];
  let nameOffset = 0;

  for (let i = 0; i < leaderCount; i++) {
    const leaderView = new DataView(
      dataSet.buffer.slice(1 + nameOffset + i * 5)
    );
    nameOffset += leaderView.getUint8(4);
    const leaderData = {
      mass: leaderView.getUint32(0),
      name: utf8.decode(leaderView.buffer.slice(5, 5 + leaderView.getUint8(4))),
    };
    if (leaderData.name == "") leaderData.name = "An unnamed cell";
    leaders.push(leaderData);
  }

  return leaders;
}

// When window is loaded
window.onload = async function () {
  requestAnimationFrame(drawFrame);
  const nameWait = new Deferred();

  const modal = document.querySelector("dialog");
  modal.showModal();

  const confirmBtn = modal.querySelector("button");
  confirmBtn.addEventListener("click", function buttonClick() {
    const input = modal.querySelector("input").value.trim();
    if (input.length > 18) {
      document.documentElement.style.setProperty("--input-color", "#f77");
      return;
    }
    modal.close();
    nameWait.resolve(input);
    this.removeEventListener("click", buttonClick);
  });

  /** @type {string} */
  const name = await nameWait.promise;
  const ws = new WebSocket(
    `${location.protocol == "http:" ? "ws" : "wss"}://${location.host}`
  );
  ws.worldSize = 0;
  ws.progress = 0;
  ws.addEventListener("open", function () {
    console.log("Connection Established!");
  });
  ws.addEventListener("message", ({ data }) => {
    parseMessage.bind(ws, data, name)();
  });
  ws.addEventListener("close", function () {
    console.log("Connection Closed!");
  });
};
