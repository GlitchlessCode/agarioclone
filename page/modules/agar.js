import { hash } from "./sha256.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

class Entity {
  /** @type {number} */
  #trueX;
  /** @type {number} */
  #trueY;
  /** @type {number} */
  #currX;
  /** @type {number} */
  #currY;
  /** @type {number} */
  #prevX;
  /** @type {number} */
  #prevY;
  /** @type {number} */
  #trueRadius;
  /** @type {number} */
  #prevRadius;
  /** @type {number} */
  #currRadius;
  /** @type {string} */
  #uuid;
  /** @type {string} */
  #colour;
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} uuid
   */
  constructor(x, y, radius, colour, uuid) {
    this.#uuid = uuid;
    this.#colour = colour;
    this.#trueX = x;
    this.#trueY = y;
    this.#prevX = x;
    this.#prevY = y;
    this.#currX = x;
    this.#currY = y;
    this.#trueRadius = radius;
    this.#prevRadius = radius;
    this.#currRadius = radius;
  }

  get uuid() {
    return this.#uuid;
  }

  get colour() {
    return this.#colour;
  }

  get radius() {
    return this.#trueRadius;
  }

  get x() {
    return this.#trueX;
  }

  get y() {
    return this.#trueY;
  }

  set x(newVal) {
    this.#prevX = this.#trueX;
    this.#currX = newVal;
  }

  set y(newVal) {
    this.#prevY = this.#trueY;
    this.#currY = newVal;
  }

  set radius(newVal) {
    this.#prevRadius = this.#trueRadius;
    this.#currRadius = newVal;
  }

  interpolate(delta) {
    this.#trueX = delta * this.#prevX + (1 - delta) * this.#currX;
    this.#trueY = delta * this.#prevY + (1 - delta) * this.#currY;
    this.#trueRadius =
      delta * this.#prevRadius + (1 - delta) * this.#currRadius;
  }

  draw() {
    return {
      x: this.x,
      y: this.y,
      r: this.radius,
      c: this.colour,
    };
  }
}

class Player extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} uuid
   */
  constructor(x, y, radius, colour, uuid) {
    super(x, y, radius, colour, uuid);
  }
}

class Food extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} uuid
   */
  constructor(x, y, radius, colour, uuid) {
    super(x, y, radius, colour, uuid);
  }
}

class Virus extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} uuid
   */
  constructor(x, y, radius, colour, uuid) {
    super(x, y, radius, colour, uuid);
  }
}

class Mass extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} uuid
   */
  constructor(x, y, radius, colour, uuid) {
    super(x, y, radius, colour, uuid);
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
      if (entity instanceof Entity) result.push(entity.draw());
    }
    return result;
  }

  /**
   * @typedef {Object} PseudoEntity
   * @property {0|1|2|3} type
   * @property {number} x
   * @property {number} y
   * @property {number} radius
   * @property {string} colour
   * @property {string} uuid
   */

  /**
   * @param {Array.<PseudoEntity>} entityInfo
   */
  update(entityInfo) {
    const entities = [];
    for (const pseudoEntity of entityInfo) {
      if (Object.hasOwn(this.#entities, pseudoEntity.uuid)) {
        const entity = this.#entities[pseudoEntity.uuid];
        entity.x = pseudoEntity.x;
        entity.y = pseudoEntity.y;
        entity.radius = pseudoEntity.radius;
      } else {
        const params = [
          pseudoEntity.x,
          pseudoEntity.y,
          pseudoEntity.radius,
          pseudoEntity.colour,
          pseudoEntity.uuid,
        ];
        switch (pseudoEntity.type) {
          case 0:
            entities.push(new Player(...params));
            break;
          case 1:
            entities.push(new Virus(...params));
            break;
          case 2:
            entities.push(new Food(...params));
            break;
          case 3:
            entities.push(new Mass(...params));
            break;
        }
      }
    }
    this.addEntities(...entities);
  }

  interpolate(delta) {
    for (const [uuid, entity] of Object.entries(this.#entities)) {
      entity.interpolate(delta);
    }
  }

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
      this.ctx.moveTo(
        i * scale + this.cnv.width / 2 - ((this.x * scale) % scale),
        0
      );
      this.ctx.lineTo(
        i * scale + this.cnv.width / 2 - ((this.x * scale) % scale),
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
      this.ctx.moveTo(
        0,
        i * scale + this.cnv.height / 2 - ((this.y * scale) % scale)
      );
      this.ctx.lineTo(
        this.cnv.width,
        i * scale + this.cnv.height / 2 - ((this.y * scale) % scale)
      );
      this.ctx.stroke();
    }

    if (this.world instanceof World) {
      // Draw Entities
      const drawArray = this.world.draw();
      drawArray.sort((a, b) => {
        return a.r - b.r;
      });
      drawArray.forEach(({ x, y, r, c }) => {
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

    this.ctx.fillStyle = "red";
    this.ctx.beginPath();
    this.ctx.arc(
      this.cnv.width / 2,
      this.cnv.height / 2,
      scale / 2,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
  }

  get x() {
    if (this.world instanceof World) {
      return clamp(this.#x, 0, this.world.width);
    } else {
      return 0;
    }
  }

  set x(value) {
    this.#x = value;
  }

  get y() {
    if (this.world instanceof World) {
      return clamp(this.#y, 0, this.world.height);
    } else {
      return 0;
    }
  }

  set y(value) {
    this.#y = value;
  }
}

export { World, Camera };
export default { Player, Food, Virus, Mass };
