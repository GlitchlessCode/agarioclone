class Entity {
  /** @type {number} */
  x;
  /** @type {number} */
  y;
  /** @type {string} */
  #uuid;
  constructor(x, y) {
    this.#uuid = crypto.randomUUID();
    this.x = x;
    this.y = y;
  }

  get uuid() {
    return this.#uuid;
  }
}

class Player extends Entity {
  constructor(x, y) {
    super(x, y);
  }
}

class Food extends Entity {
  constructor(x, y) {
    super(x, y);
  }
}

class Virus extends Entity {
  constructor(x, y) {
    super(x, y);
  }
}

class World {
  /** @type {Object} */
  #entities;
  /** @type {bigint} */
  #width;
  /** @type {bigint} */
  #height;

  /**
   *
   * @param {bigint} width
   * @param {bigint} height
   * @param  {...Entity} entities
   */
  constructor(width, height, ...entities) {
    this.#entities = {};
    entities.forEach((element) => {
      if (!(element instanceof Entity))
        throw new TypeError("entities[] must be of type Entity");
    });
  }
}

export { World };
export default { Player, Food, Virus };
