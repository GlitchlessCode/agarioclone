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

  // Empty draw method
  draw() {}
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

  draw(scale) {
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
  /** @type {World} */
  world;
  /** @type {number} */
  camScale;
  /**
   * @param {number} x
   * @param {number} y
   * @param {CanvasRenderingContext2D} context
   * @param {World} world
   */
  constructor(x, y, context) {
    this.x = x;
    this.y = y;
    this.ctx = context;
    this.cnv = context.canvas;
    this.camScale = 1;
  }
  /**
   * @param {World} world
   */
  changeWorld(world) {
    if (!(world instanceof World))
      throw new TypeError("world must be of type World");
    this.world = world;
  }

  draw() {
    const largestSize = Math.max(this.cnv.width, this.cnv.height);
    const scale = (largestSize / 1000) * this.camScale;

    for (let i = 0; i < 100; i++) {
      for (let n = 0; n < 100; n++) {
        let Uhex = Math.floor((i / 100) * 256)
          .toString(16)
          .padStart(2, "0");
        let Vhex = Math.floor((n / 100) * 256)
          .toString(16)
          .padStart(2, "0");
        this.ctx.fillStyle = "#" + Uhex + Vhex + "00";
        this.ctx.fillRect(
          scale * 10 * i,
          scale * 10 * n,
          scale * 10,
          scale * 10
        );
      }
    }
  }
}

export { World, Camera };
export default { Player, Food, Virus };
