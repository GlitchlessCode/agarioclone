class Entity {
  /** @type {number} */
  x;
  /** @type {number} */
  y;
  /** @type {number} */
  radius;
  /** @type {string} */
  #uuid;
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   */
  constructor(x, y, radius) {
    this.#uuid = crypto.randomUUID();
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  get uuid() {
    return this.#uuid;
  }
}

class Player extends Entity {
  constructor(x, y, radius) {
    super(x, y, radius);
  }
}

class Food extends Entity {
  constructor(x, y, radius) {
    super(x, y, radius);
  }
}

class Virus extends Entity {
  constructor(x, y, radius) {
    super(x, y, radius);
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

  draw() {
    return this;
  }

  update() {}
}

class Camera {
  /** @type {number} */
  x;
  /** @type {number} */
  y;
  /** @type {CanvasRenderingContext2D} */
  ctx;
  /** @type {HTMLCanvasElement} */
  cnv;
  /**
   * @param {number} x
   * @param {number} y
   * @param {CanvasRenderingContext2D} context
   */
  constructor(x, y, context) {
    this.x = x;
    this.y = y;
    this.ctx = context;
    this.cnv = context.canvas;
  }
}

export { World, Camera };
export default { Player, Food, Virus };
