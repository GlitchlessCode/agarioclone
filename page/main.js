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

function newWorld(width, height) {
  const newWorld = new World(width, height);
  camera.changeWorld(newWorld);
  return newWorld;
}

function drawFrame() {
  ctx.fillStyle = "#ddddee";
  ctx.fillRect(0, 0, cnv.width, cnv.height);
  camera.draw();
  requestAnimationFrame(drawFrame);
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
      console.log(dataView.getInt32(0));
      this.send(await createMessage(1));
      break;
    case 3:
      console.log("incomingWorld");
      console.log(new Uint8Array(dataView.buffer));
      this.send(await createMessage(1));
      break;
    case 5:
      console.log("worldFinished");
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
