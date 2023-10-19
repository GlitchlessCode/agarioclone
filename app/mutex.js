/**
 * Based on https://stackoverflow.com/questions/45870869/whats-the-actual-use-of-the-atomics-object-in-ecmascript
 * @class
 */
class Mutex {
  /**
   *
   * @param {Int32Array} resource
   * @param {number} cell
   */
  constructor(resource, cell) {
    this.resource = resource;
    this.cell = cell;
    this.lockAcquired = false;
  }

  /**
   * locks the mutex
   */
  lock() {
    if (this.lockAcquired) {
      console.warn("you already acquired the lock you stupid");
      return;
    }
    const { resource, cell } = this;
    while (true) {
      // lock is already acquired, wait
      if (Atomics.load(resource, cell) > 0) {
        while ("ok" !== Atomics.wait(resource, cell, 0));
      }
      const countOfAcquiresBeforeMe = Atomics.add(resource, cell, 1);
      // someone was faster than me, try again later
      if (countOfAcquiresBeforeMe >= 1) {
        Atomics.sub(resource, cell, 1);
        continue;
      }
      this.lockAcquired = true;
      return;
    }
  }

  /**
   * unlocks the mutex
   */
  unlock() {
    if (!this.lockAcquired) {
      console.warn("you didn't acquire the lock you stupid");
      return;
    }
  }
}

module.exports = {
  Mutex,
};
