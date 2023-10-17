const { parentPort, threadId } = require("worker_threads");

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
