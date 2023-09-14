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
  world = new World(100n, 100n, new Entities.Player(1, 1, 20));
}

loadWorld();

function drawFrame() {
  ctx.fillStyle = "#eeeeff";
  ctx.fillRect(0, 0, cnv.width, cnv.height);

  requestAnimationFrame(drawFrame);
}

requestAnimationFrame(drawFrame);
