const { availableParallelism } = require("os");
const { Worker } = require("worker_threads");
const {
  SHARED_MEMORY,
  SHARED_MEMORY_PARTITIONS,
} = require("./sharedArrayBuffer");
const path = require("path");

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

class Workers {
  /** @type {{worker: Worker, ready: boolean}[]} */
  static #workers;
  /** @type {{worker: Worker, ready: boolean}[]} */
  static #ready;
  static {
    this.#workers = Array.from(
      { length: Math.ceil(availableParallelism / 2) },
      () => {
        const worker = new Worker(path.join(__dirname, "/agarWorker.js"), {
          workerData: SHARED_MEMORY,
        });
        return {
          worker,
          ready: true,
        };
      }
    );
    this.#ready = [...this.#workers];
  }

  /**
   * @typedef {Object} task
   * @property {number} type
   * @property {any} data
   */

  /**
   * @param {task} task
   */
  static assign(task) {
    const channel = new MessageChannel();
    const worker = this.#ready.pop();
    worker.ready = false;

    const res = new Promise((resolve) => {
      channel.port1.once("message", (result) => {
        resolve(result);
        worker.ready = true;
        this.#ready.push(worker);
      });
    });

    const port = [channel.port2];
    worker.worker.postMessage({ task, port }, port);
    return res;
  }

  /**
   * @param  {...task} input
   */
  static async massAssign(...input) {
    let tasks =
      input.length == 1 && input[0] instanceof Array ? input[0] : input;
    if (tasks.length == 0) return [];
    let results = [];
    let complete = { count: 0, defer: new Deferred(), loopDone: false };
    let defer = new Deferred();
    let waiting = false;
    for (const [index, task] of tasks.entries()) {
      this.assign(task).then((result) => {
        results.push(result);
        complete.count++;
        if (waiting) defer.resolve();
        if (complete.loopDone && complete.count == tasks.length)
          complete.defer.resolve();
      });
      if (this.#ready.length == 0 && index < tasks.length - 1) {
        waiting = true;
        await defer.promise;
        defer = new Deferred();
        waiting = false;
      }
    }
    complete.loopDone = true;
    await complete.defer.promise;
    return results;
  }
  static get length() {
    return this.#workers.length;
  }
}

module.exports = {
  Deferred,
  Workers,
};
