class MutexError extends Error {
  constructor(message) {
    super(message);
    this.name = "MutexError";
  }
}

/**
 * Based on https://stackoverflow.com/questions/45870869/whats-the-actual-use-of-the-atomics-object-in-ecmascript
 * @class
 */
class Mutex {
  /** @type {Int32Array} */
  #resource;
  /** @type {number} */
  #cell;
  /** @type {boolean} */
  #lockAcquired;
  /**
   *
   * @param {Int32Array} resource
   * @param {number} cell
   */
  constructor(resource, cell) {
    this.#resource = resource;
    this.#cell = cell;
    this.#lockAcquired = false;
  }

  /**
   * locks the Mutex if unlocked, else, waits
   * @returns {void}
   */
  lockWait() {
    if (this.#lockAcquired)
      throw new MutexError("lock failed because this Mutex already has lock");

    const [resource, cell] = [this.#resource, this.#cell];
    while (true) {
      // lock is already acquired, wait
      if (Atomics.load(resource, cell) > 0) {
        while (Atomics.load(resource, cell) > 0);
      }
      const countOfAcquiresBeforeMe = Atomics.add(resource, cell, 1);
      // someone was faster than me, try again later
      if (countOfAcquiresBeforeMe >= 1) {
        Atomics.sub(resource, cell, 1);
        continue;
      }
      this.#lockAcquired = true;
      return;
    }
  }

  /**
   * locks the Mutex if unlocked, else, throws MutexError
   * @returns {boolean}
   */
  lock() {
    if (this.#lockAcquired) return false;

    const [resource, cell] = [this.#resource, this.#cell];
    if (Atomics.load(resource, cell) > 0) return false;

    const countOfAcquiresBeforeMe = Atomics.add(resource, cell, 1);

    // someone was faster than me, throw error
    if (countOfAcquiresBeforeMe >= 1) {
      Atomics.sub(resource, cell, 1);
      return false;
    }

    this.#lockAcquired = true;
    return true;
  }

  /**
   * unlocks the mutex
   * @returns {void}
   */
  unlock() {
    if (!this.#lockAcquired)
      throw new MutexError("unlock failed because Mutex does not have lock");

    Atomics.sub(this.#resource, this.#cell, 1);
    Atomics.notify(this.#resource, this.#cell, 1);
    this.#lockAcquired = false;
  }

  get lockAcquired() {
    return this.#lockAcquired;
  }
}

class SharedBufferPartition {
  /** @type {Mutex} */
  mutex;
  /** @type {DataView} */
  data;
  /** @type {number} */
  #index;
  /**
   * @param {Uint8Array} typedArray
   */
  constructor(typedArray, index) {
    const len = typedArray.byteLength,
      pos = typedArray.byteOffset;
    this.data = new DataView(typedArray.buffer, pos + 4, len - 4);
    this.mutex = new Mutex(new Int32Array(typedArray.buffer), pos / 4);
    this.#index = index;
  }

  get index() {
    return this.#index;
  }

  /**
   * @param {Uint8Array} resource
   * @param {Array} location
   * @param {number} count
   * @param {number} size
   * @param {number} start
   * @returns {number}
   */
  static massConstruct(resource, location, count, size, start) {
    for (let i = 0; i < count; i++) {
      location.push(
        new SharedBufferPartition(
          resource.subarray(start + i * size, start + (i + 1) * size),
          i
        )
      );
    }
    return count * size;
  }
}

module.exports = {
  SharedBufferPartition,
  MutexError,
};
