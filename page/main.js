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
let world = newWorld(
  new Entities.Player(1, 1, 1),
  new Entities.Player(5, 1, 1),
  new Entities.Player(8, 4, 1)
);

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

function newWorld(...entities) {
  const newWorld = new World(30n, 50n, ...entities);
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
 * @param {{data:Blob}} param0
 */
async function parseMessage({ data }) {
  if (!(data instanceof Blob)) throw new Error("data is not of type Blob");
  const dataView = new Uint8Array(await data.arrayBuffer());
  switch (dataView[0]) {
    case 0:
      console.log("init");
      this.send(new ArrayBuffer(1));
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
  await resolver.promise;
  requestAnimationFrame(drawFrame);
};
