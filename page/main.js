// * Import Statements
import Entities, { World, Camera } from "./modules/agar.js";
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
const mouseRatio = {
  x: 0,
  y: 0,
};

// Camera
const camera = new Camera(0, 0, ctx);

// World
/** @type {World} */
let world;

// * Event Listeners
window.addEventListener("resize", setCanvasScale);

// Anonymous
cnv.addEventListener("mousemove", function ({ clientX, clientY }) {
  const largest = Math.max(cnv.width, cnv.height);
  mouseRatio.x =
    (clientX * window.devicePixelRatio - this.width / 2) / (largest / 2);
  mouseRatio.y =
    (clientY * window.devicePixelRatio - this.height / 2) / (largest / 2);
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

  requestAnimationFrame(drawFrame);
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

/**
 * @this {WebSocket}
 * @param {{data:Blob}} param0
 */
async function parseMessage({ data }) {
  if (!(data instanceof Blob)) throw new Error("data is not of type Blob");
  const dataView = new DataView((await data.arrayBuffer()).slice(1));
  switch (new Uint8Array(await data.arrayBuffer())[0]) {
    case 8:
      if (interpolator) clearTimeout(interpolator);
      interpolator = setTimeout(
        interpolatedCam,
        10,
        camera.x,
        camera.y,
        dataView.getFloat64(4),
        dataView.getFloat64(12),
        9
      );
      console.log(await Promise.all(getEntities(dataView)));
      break;
    case 0:
      console.log("init");
      this.send(await createMessage(0));
      break;
    case 2:
      console.log("worldStart");
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
      this.send(await createMessage(1));
      break;
    case 5:
      console.log("incomingEntity");
      let params = [
        dataView.getFloat64(1),
        dataView.getFloat64(9),
        dataView.getFloat32(17),
        colour(
          dataView.getUint8(21),
          dataView.getUint8(22),
          dataView.getUint8(23)
        ),
        uuid(dataView.buffer.slice(-32)),
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
      this.send(await createMessage(7));
      setTimeout(mouseTick.bind(this), 100);
      break;
    case 255:
      throw new Error("server error");
  }
}

/**
 *
 * @param {number} startX
 * @param {number} startY
 * @param {number} targetX
 * @param {number} targetY
 * @param {number} depth
 * @param {number} [divide]
 */
function interpolatedCam(
  startX,
  startY,
  targetX,
  targetY,
  depth,
  divide = depth + 1
) {
  camera.x = (depth / divide) * startX + (1 - depth / divide) * targetX;
  camera.y = (depth / divide) * startY + (1 - depth / divide) * targetY;
  if (depth > 0)
    interpolator = setTimeout(
      interpolatedCam,
      100 / divide,
      startX,
      startY,
      targetX,
      targetY,
      depth - 1,
      divide
    );
}

// When window is loaded
window.onload = async function () {
  let resolver = new Deferred();
  const ws = new WebSocket(
    `${location.protocol == "http:" ? "ws" : "wss"}://${location.host}`
  );
  ws.addEventListener("open", function () {
    console.log("Connection Established!");
    resolver.resolve();
  });
  ws.addEventListener("message", parseMessage.bind(ws));
  ws.addEventListener("close", function () {
    console.log("Connection Closed!");
  });
  await resolver.promise;
  requestAnimationFrame(drawFrame);
};

/**
 * @this WebSocket
 */
async function mouseTick(mouseX, mouseY) {
  if (!(mouseX == mouseRatio.x && mouseY == mouseRatio.y)) {
    const mouseView = new DataView(new ArrayBuffer(16));
    this.send(
      await createMessage(
        9,
        (mouseView.setFloat64(0, mouseRatio.x),
        mouseView.setFloat64(8, mouseRatio.y),
        mouseView.buffer)
      )
    );
  }
  if (this.readyState == 1)
    setTimeout(mouseTick.bind(this), 100, mouseRatio.x, mouseRatio.y);
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
 * @param {ArrayBuffer} dataSet
 */
function* getEntities(dataSet) {
  for (let i = 0; i < dataSet.getUint32(0); i++) {
    yield new Promise((resolve, reject) => {
      const entityView = new DataView(
        dataSet.buffer.slice(20 + i * 56, 20 + (i + 1) * 56)
      );
      resolve({
        type: entityView.getUint8(0),
        x: entityView.getFloat64(1),
        y: entityView.getFloat64(9),
        radius: entityView.getFloat32(17),
        colour: colour(
          entityView.getUint8(21),
          entityView.getUint8(22),
          entityView.getUint8(23)
        ),
        uuid: uuid(entityView.buffer.slice(-32)),
      });
    });
  }
}
