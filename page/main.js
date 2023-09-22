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
  mouseRatio.x = (clientX - this.width / 2) / (this.width / 2);
  mouseRatio.y = (clientY - this.height / 2) / (this.height / 2);
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
      console.log("incomingEntity");
      switch (dataView.getUint8(0)) {
        case 0:
          world.addEntities(
            new Entities.Player(
              dataView.getFloat64(1),
              dataView.getFloat64(9),
              dataView.getFloat32(17),
              uuid(dataView.buffer.slice(-32))
            )
          );
          break;
        case 1:
          break;
        case 2:
          break;
        default:
          throw new Error("invalid entity configuration recieved");
      }
      this.send(await createMessage(1));
      break;
    case 5:
      console.log("worldFinished");
      camera.changeWorld(world);
      break;
    case 255:
      throw new Error("server error");
  }
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
