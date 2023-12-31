function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {string} hex
 * @param {number} val
 */
function shade(hex, val) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);

  const rMod = clamp(r + val, 0, 255),
    gMod = clamp(g + val, 0, 255),
    bMod = clamp(b + val, 0, 255);

  return (
    "#" +
    rMod.toString(16).padStart(2, 0) +
    gMod.toString(16).padStart(2, 0) +
    bMod.toString(16).padStart(2, 0)
  );
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
  /** @type {string} */
  #name;
  /** @type {number} */
  #type;
  /** @type {boolean} */
  #updated;
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} colour
   * @param {string} name
   * @param {number} type
   * @param {string} uuid
   */
  constructor(x, y, radius, colour, name, type, uuid) {
    this.#uuid = uuid;
    this.#colour = colour;
    this.#name = name;
    this.#trueX = x;
    this.#trueY = y;
    this.#prevX = x;
    this.#prevY = y;
    this.#currX = x;
    this.#currY = y;
    this.#trueRadius = radius;
    this.#prevRadius = radius;
    this.#currRadius = radius;
    this.#type = type;
    this.#updated = true;
  }

  get uuid() {
    return this.#uuid;
  }

  get colour() {
    return this.#colour;
  }

  get name() {
    return this.#name;
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
    this.#updated = true;
  }

  set y(newVal) {
    this.#prevY = this.#trueY;
    this.#currY = newVal;
    this.#updated = true;
  }

  set radius(newVal) {
    this.#prevRadius = this.#trueRadius;
    this.#currRadius = newVal;
    this.#updated = true;
  }

  get syncVal() {
    return this.#currX;
  }

  interpolate(delta, lock) {
    if (lock) {
      if (!this.#updated) {
        this.#prevX = this.#currX;
        this.#prevY = this.#currY;
        this.#prevRadius = this.#currRadius;
      }
      this.#updated = false;
    }
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
      n: this.name,
      t: this.#type,
    };
  }
}

class Player extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} colour
   * @param {string} name
   * @param {string} uuid
   */
  constructor(x, y, radius, colour, name, uuid) {
    super(x, y, radius, colour, name, 0, uuid);
  }
}

class Food extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} colour
   * @param {string} name
   * @param {string} uuid
   */
  constructor(x, y, radius, colour, name, uuid) {
    super(x, y, radius, colour, name, 2, uuid);
  }
}

class Virus extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} colour
   * @param {string} name
   * @param {string} uuid
   */
  constructor(x, y, radius, colour, name, uuid) {
    super(x, y, radius, colour, name, 1, uuid);
  }
}

class Mass extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} colour
   * @param {string} name
   * @param {string} uuid
   */
  constructor(x, y, radius, colour, name, uuid) {
    super(x, y, radius, colour, name, 3, uuid);
  }
}

class World {
  /** @type {Object.<string, Entity>} */
  #entities;
  /** @type {bigint} */
  #width;
  /** @type {bigint} */
  #height;
  /** @type {string[]} */
  #toKill;

  /**
   * @param {bigint} width
   * @param {bigint} height
   */
  constructor(width, height) {
    this.#entities = {};
    this.#width = width;
    this.#height = height;
    this.#toKill = [];
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

  /**
   * @param {{x:{min:number, max:number},y:{min:number, max:number}}} bounds
   */
  draw(bounds) {
    /** @type {Array.<{x:number, y:number, r:number, c:string, n:string, t: number}>}*/
    const result = new Array();
    for (const [key, entity] of Object.entries(this.#entities).sort(
      ([_, a], [__, b]) => {
        return a.x - a.radius - (b.x - b.radius);
      }
    )) {
      if (entity instanceof Entity) {
        if (
          entity.x + entity.radius < bounds.x.min ||
          entity.y + entity.radius < bounds.y.min ||
          entity.y - entity.radius > bounds.y.max
        )
          continue;
        if (entity.x - entity.radius > bounds.x.max) break;
        result.push(entity.draw());
      }
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
   * @property {string} name
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
          pseudoEntity.name,
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

  /**
   * @param {string[]} killed
   */
  kill(killed) {
    this.#toKill.forEach((uuid) => delete this.#entities[uuid]);
    this.#toKill = killed;
  }

  /**
   * @param {number} delta
   * @param {boolean} lock
   */
  interpolate(delta, lock) {
    for (const [uuid, entity] of Object.entries(this.#entities)) {
      entity.interpolate(delta, lock);
    }
  }

  /**
   * @param {number} syncVal
   */
  checkSync(syncVal) {
    let total = 0;
    for (const entity of Object.values(this.#entities)) {
      if (this.#toKill.includes(entity.uuid)) continue;
      total += Math.round(entity.syncVal * 10);
    }
    return syncVal == total;
  }

  /**
   * @param {PseudoEntity[]} EntityInfo
   */
  resync(EntityInfo) {
    console.log("resyncing");
    const UuidList = Object.values(this.#entities).map((a) => a.uuid);
    const entities = [];
    for (const pseudoEntity of EntityInfo) {
      if (Object.hasOwn(this.#entities, pseudoEntity.uuid)) {
        UuidList.splice(UuidList.indexOf(pseudoEntity.uuid), 1);
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
          pseudoEntity.name,
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

    for (const culledUUID of UuidList) {
      delete this.#entities[culledUUID];
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
  /** @type {number} */
  loadingProgress;
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
    this.loadingProgress = 0;
  }
  /**
   * @param {World} world
   */
  changeWorld(world) {
    if (!(world instanceof World)) this.world = undefined;
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
      const offset = 50 / this.camScale;
      const drawArray = this.world.draw({
        x: {
          min: this.x - offset,
          max: this.x + offset,
        },
        y: {
          min: this.y - offset,
          max: this.y + offset,
        },
      });
      drawArray.sort((a, b) => {
        return a.r - b.r;
      });
      drawArray.forEach(({ x, y, r, c, n, t }) => {
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

        if (t !== 2) {
          this.ctx.fillStyle = shade(c, -40);
          this.ctx.beginPath();
          this.ctx.arc(
            this.cnv.width / 2 - this.x * scale + x * scale,
            this.cnv.height / 2 - this.y * scale + y * scale,
            r * scale * 0.98 - 0.12 * scale,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
        }
        if (t == 0) {
          this.ctx.fillStyle = "#eeeeee";
          this.ctx.strokeStyle = "#111111";
          this.ctx.lineWidth = (r * scale) / 40;
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.font = `bold ${(r * scale) / 3.7}px sans-serif`;
          const mass = Math.floor(r ** 2 * Math.PI);
          this.ctx.fillText(
            mass,
            this.cnv.width / 2 - this.x * scale + x * scale,
            this.cnv.height / 2 - this.y * scale + y * scale + (r * scale) / 3.7
          );
          this.ctx.strokeText(
            mass,
            this.cnv.width / 2 - this.x * scale + x * scale,
            this.cnv.height / 2 - this.y * scale + y * scale + (r * scale) / 3.7
          );
        }

        this.ctx.fillStyle = "#eeeeee";
        this.ctx.strokeStyle = "#111111";
        this.ctx.lineWidth = (r * scale) / 34;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.font = `bold ${(r * scale) / 2.7}px sans-serif`;
        this.ctx.fillText(
          n,
          this.cnv.width / 2 - this.x * scale + x * scale,
          this.cnv.height / 2 - this.y * scale + y * scale
        );
        this.ctx.strokeText(
          n,
          this.cnv.width / 2 - this.x * scale + x * scale,
          this.cnv.height / 2 - this.y * scale + y * scale
        );
      });
    } else {
      this.ctx.fillStyle = "#eeeeee";
      this.ctx.strokeStyle = "#111111";
      this.ctx.font = `bold ${this.cnv.height / 32}px sans-serif`;
      this.ctx.lineWidth = this.cnv.height / 402;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      const result = this.loadingProgress + "%";
      this.ctx.fillText(result, this.cnv.width / 2, this.cnv.height / 2);
      this.ctx.strokeText(result, this.cnv.width / 2, this.cnv.height / 2);
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

class Leaderboard {
  /** @type {CanvasRenderingContext2D} */
  ctx;
  /** @type {HTMLCanvasElement} */
  cnv;
  /** @type {number} */
  margin;
  /** @type {number} */
  padding;
  /** @type {number} */
  gap;
  /** @type {number} */
  leading;
  /** @type {boolean} */
  show;
  /** @type {{name: string, mass: number}[]} */
  leaders;

  /**
   * @param {CanvasRenderingContext2D} context
   * @param {number} margin
   * @param {number} padding
   * @param {number} gap
   * @param {number} leading
   */
  constructor(context, margin, padding, gap, leading) {
    this.ctx = context;
    this.cnv = context.canvas;
    this.show = false;
    this.margin = margin;
    this.padding = padding;
    this.gap = gap;
    this.leading = leading;
    this.leaders = [];
  }

  draw() {
    if (!this.show) return;

    const largestSize = Math.max(this.cnv.width, this.cnv.height);
    const scale = largestSize / 100;

    const margin = this.margin * scale;
    const padding = this.padding * scale;
    const gap = this.gap * scale;
    const leading = this.leading * scale;

    this.ctx.font = `bold ${scale / 1.4}px sans-serif`;

    const nameMetrics = this.ctx.measureText("WWWWWWWWWWWWWWWWWW");
    const countMetrics = this.ctx.measureText("888888");
    const totalWidth = gap + nameMetrics.width + countMetrics.width;
    const totalHeight = (scale / 1.4) * 10 + leading * 9;

    this.ctx.fillStyle = "#0007";
    this.ctx.fillRect(
      this.cnv.width - (totalWidth + padding * 2) - margin,
      margin,
      totalWidth + padding * 2,
      totalHeight + padding * 2
    );

    this.ctx.textBaseline = "top";
    this.ctx.fillStyle = "#fff";

    for (const [i, leader] of this.leaders.entries()) {
      this.ctx.textAlign = "left";
      this.ctx.fillText(
        leader.name,
        this.cnv.width - (totalWidth + padding) - margin,
        margin + padding + i * (scale / 1.4 + leading)
      );

      this.ctx.textAlign = "right";
      this.ctx.fillText(
        leader.mass,
        this.cnv.width - padding - margin,
        margin + padding + i * (scale / 1.4 + leading)
      );
    }
  }
}

export { World, Camera, Leaderboard };
export default { Player, Food, Virus, Mass };
