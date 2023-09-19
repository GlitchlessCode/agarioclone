// * Import Statements
import Entities, { World, Camera } from "./modules/agar.js";
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

// World
/** @type {World} */
let world;

// Camera
const camera = new Camera(0, 0, ctx);

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

function loadWorld() {
  const newWorld = new World(20n, 10n, new Entities.Player(1, 1, 20));
  camera.changeWorld(newWorld);
  return newWorld;
}

loadWorld();

let val = 0;
function drawFrame() {
  val += 0.01;
  ctx.fillStyle = "#ddddee";
  ctx.fillRect(0, 0, cnv.width, cnv.height);
  camera.x = 10 + 8 * Math.sin(val);
  camera.y = 5 + 4 * Math.cos(val);
  camera.draw();
  ctx.fillStyle = "red";
  ctx.fillRect(cnv.width / 2 - 5, cnv.height / 2 - 5, 10, 10);
  requestAnimationFrame(drawFrame);
}

requestAnimationFrame(drawFrame);
