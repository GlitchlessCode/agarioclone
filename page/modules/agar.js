function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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
    this.#width = width;
    this.#height = height;
  }

  draw(scale) {
    return this;
  }

  update() {}

  get width() {
    return parseInt(this.#width);
  }

  get height() {
    return parseInt(this.#height);
  }
}

class Camera {
  /** @type {number} */
  #x;
  /** @type {number} */
  #y;
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
    this.#x = x;
    this.#y = y;
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
    this.#x = world.width / 2;
    this.#y = world.height / 2;
  }

  draw() {
    const largestSize = Math.max(this.cnv.width, this.cnv.height);
    const scale = (largestSize / 100) * this.camScale;

    this.ctx.lineWidth = scale / 30;
    this.ctx.strokeStyle = "#bbbbbb";

    if (this.world instanceof World) {
      this.ctx.fillStyle = "#eeeeff";
      this.ctx.fillRect(
        this.cnv.width / 2 - this.x * scale,
        this.cnv.height / 2 - this.y * scale,
        this.world.width * scale,
        this.world.height * scale
      );
    }

    for (
      let i = -Math.ceil(this.cnv.width / scale / 2);
      i < this.cnv.width / scale;
      i++
    ) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * scale + this.cnv.width / 2 - this.x * scale, 0);
      this.ctx.lineTo(
        i * scale + this.cnv.width / 2 - this.x * scale,
        this.cnv.height
      );
      this.ctx.stroke();
    }
    for (
      let i = -Math.ceil(this.cnv.height / scale / 2);
      i < this.cnv.height / scale;
      i++
    ) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * scale + this.cnv.height / 2 - this.y * scale);
      this.ctx.lineTo(
        this.cnv.width,
        i * scale + this.cnv.height / 2 - this.y * scale
      );
      this.ctx.stroke();
    }
  }

  get x() {
    if (this.world instanceof World) {
      return clamp(this.#x, 0, this.world.width);
    } else {
      return 0;
    }
  }

  set x(value) {
    if (this.world instanceof World) {
      this.#x = clamp(value, 0, this.world.width);
    } else {
      this.#x = 0;
    }
  }

  get y() {
    if (this.world instanceof World) {
      return clamp(this.#y, 0, this.world.height);
    } else {
      return 0;
    }
  }

  set y(value) {
    if (this.world instanceof World) {
      this.#y = clamp(value, 0, this.world.height);
    } else {
      this.#y = 0;
    }
  }
}

export { World, Camera };
export default { Player, Food, Virus };
