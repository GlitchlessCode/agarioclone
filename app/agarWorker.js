/** @type {{parentPort:MessagePort, threadId:number, workerData:SharedArrayBuffer}} */
const { parentPort, threadId, workerData } = require("worker_threads");
const SHARED_MEMORY = new Uint8Array(workerData);
const { Mutex } = require("./mutex");

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function getDistance(entityA, entityB) {
  return Math.hypot(entityA.x - entityB.x, entityA.y - entityB.y);
}

/**
 * @typedef {Object} task
 * @property {number} type
 * @property {any} data
 */

parentPort.on(
  "message",
  /** @param {{task: task, port: [MessagePort]}} param0 */
  ({ task, port }) => {
    switch (task.type) {
      case 1:
        port[0].postMessage(movePlayer(task.data));
        break;
      case 2:
        port[0].postMessage(collisionSim(task.data));
        break;
    }
  }
);

function movePlayer({ player, user, world, DeltaTime }) {
  player.mass = Math.max(player.mass * 0.9998, 10);

  player.velX = player.velX * 0.9 ** DeltaTime;
  player.velY = player.velY * 0.9 ** DeltaTime;

  const cohesionAngle = Math.atan2(user.y - player.y, user.x - player.x);
  const cohesionStrength =
    0.01 * getDistance(player, user) ** (0.1 * getDistance(player, user) + 0.5);

  const cohereX = Math.cos(cohesionAngle) * cohesionStrength;
  const cohereY = Math.sin(cohesionAngle) * cohesionStrength;

  player.x +=
    (8 / (player.radius * 10) + 0.13) * user.mouseVector.x * DeltaTime +
    player.velX +
    cohereX;
  player.y +=
    (8 / (player.radius * 10) + 0.13) * user.mouseVector.y * DeltaTime +
    player.velY +
    cohereY;

  player.x = clamp(player.x, 0, world.width);
  player.y = clamp(player.y, 0, world.height);

  return player;
}

function collisionSim(data) {
  const { larger, smaller } = data;
  // Values both from 0-3; Bitshift larger to the left twice; Composes this: 0b0000LLSS
  const bitmask = (larger.type << 2) + smaller.type;
  switch (bitmask) {
    case 0: // (0<<2 = 0) + 0 = 0
      return playerPlayer(data);
    case 1: // (0<<2 = 0) + 1 = 1
      return playerVirus(data);
    case 2: // (0<<2 = 0) + 2 = 2
      return playerFood(data);
    case 3: // (0<<2 = 0) + 3 = 3
      return playerMass(data);
    case 7: // (1<<2 = 4) + 3 = 7
      return virusMass(data);
  }
}

function playerPlayer({ larger, smaller, DeltaTime }) {}

function playerVirus({ larger, smaller, DeltaTime }) {}

function playerFood({ larger, smaller, DeltaTime }) {
  console.log("PlayerFood");
}

function playerMass({ larger, smaller, DeltaTime }) {}

function virusMass({ larger, smaller, DeltaTime }) {}
