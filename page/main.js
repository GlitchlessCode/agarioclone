// * Import Statements
import Entities, { World } from "./modules/agar.js";
const test = [new Entities.Player(1, 1), new Entities.Food(1, 2)];
console.log(new World(50, 50, ...test));
// * Variable Initialization
// Canvas
/** @type {HTMLCanvasElement} */
const cnv = document.querySelector("canvas");
const ctx = cnv.getContext("2d");
const scale = window.devicePixelRatio;
setCanvasScale();

// Mouse
const mouseRatio = {
  x: 0,
  y: 0,
};

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
  ctx.fillStyle = "red";
  ctx.arc(50, 50, 20, 0, 2 * Math.PI);
  ctx.fill();
  requestAnimationFrame(drawFrame);
}

requestAnimationFrame(drawFrame);
