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
   * @param {string} uuid
   */
  constructor(x, y, radius, uuid) {
    this.#uuid = uuid;
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  get uuid() {
    return this.#uuid;
  }

  update() {}
}

class Player extends Entity {
  constructor(...args) {
    super(...args);
  }
}

class Food extends Entity {
  constructor(...args) {
    super(...args);
  }
}

class Virus extends Entity {
  constructor(...args) {
    super(...args);
  }
}

class World {
  /** @type {Object.<string, Entity>} */
  #entities;
  /** @type {bigint} */
  #width;
  /** @type {bigint} */
  #height;

  /**
   * @param {bigint} width
   * @param {bigint} height
   */
  constructor(width, height) {
    this.#entities = {};
    this.#width = width;
    this.#height = height;
  }

  /**
   * @param  {...Entity} entities
   */
  addEntities(...entities) {
    entities.forEach(
      /**
       * @param {Entity} element
       */
      (element) => {
        if (!(element instanceof Entity))
          throw new TypeError("entities[] must be of type Entity");
        else this.#entities[element.uuid] = element;
      }
    );
  }

  draw() {
    /** @type {Array.<{x:number, y:number, r:number, c:string}>}*/
    const result = new Array();
    for (const [key, entity] of Object.entries(this.#entities)) {
      if (entity instanceof Entity)
        result.push({
          x: entity.x,
          y: entity.y,
          r: entity.radius,
          c: stringToColour(entity.uuid),
        });
    }
    return result;
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

    // Draw World Border
    if (this.world instanceof World) {
      this.ctx.fillStyle = "#eeeeff";
      this.ctx.fillRect(
        this.cnv.width / 2 - this.x * scale,
        this.cnv.height / 2 - this.y * scale,
        this.world.width * scale,
        this.world.height * scale
      );
    }

    // Draw Grid Lines
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

    if (this.world instanceof World) {
      // Draw Entities
      this.world.draw().forEach(({ x, y, r, c }) => {
        this.ctx.fillStyle = c;
        this.ctx.beginPath();
        this.ctx.arc(
          this.cnv.width / 2 - this.x * scale + x * scale,
          this.cnv.height / 2 - this.y * scale + y * scale,
          r * scale,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      });
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

// ! TEMPORARY
const stringToColour = (str) => {
  let hash = 0;
  str.split("").forEach((char) => {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  });
  let colour = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    colour += value.toString(16).padStart(2, "0");
  }
  return colour;
};
