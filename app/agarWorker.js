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
    port[0].postMessage(0);
  }
);
