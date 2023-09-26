const crypto = require("crypto");

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

class Entity {
  /** @type {boolean} */
  different;
  /** @type {number} */
  x;
  /** @type {number} */
  y;
  /** @type {{UUID: string, buff: ArrayBuffer}} */
  #uuid;
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} [UUID]
   */
  constructor(x, y, UUID) {
    this.#uuid = UUID ? UUID : uuid();
    this.x = x;
    this.y = y;
    this.different = true;
  }

  get uuid() {
    return this.#uuid;
  }

  update() {}
}

class Circle extends Entity {
  /** @type {number} */
  radius;
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} [UUID]
   */
  constructor(x, y, radius, UUID) {
    super(x, y, UUID);
    this.radius = radius;
  }
}

class Player extends Circle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   */
  constructor(x, y, radius) {
    super(x, y, radius);
  }
}

class Food extends Circle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   */
  constructor(x, y, radius) {
    super(x, y, radius);
  }
}

class Virus extends Circle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   */
  constructor(x, y, radius) {
    super(x, y, radius);
  }
}

class Mass extends Circle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   */
  constructor(x, y, radius) {
    super(x, y, radius);
  }
}

class User extends Entity {
  /** @type {{x: number, y:number}} */
  mouse;
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} [UUID]
   */
  constructor(x, y, UUID) {
    super(x, y, UUID);
    this.mouse = { x: 0, y: 0 };
  }
}

class World {
  /** @type {Object.<string, Entity>} */
  entities;
  /** @type {Object.<string, Player>} */
  players;
  /** @type {Object.<string, Virus>} */
  viruses;
  /** @type {Object.<string, Food>} */
  food;
  /** @type {Object.<string, Mass>} */
  mass;
  /** @type {Object.<string, User>} */
  users;
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
    this.entities = {};
    this.players = {};
    this.viruses = {};
    this.food = {};
    this.mass = {};
    this.users = {};
    this.addEntities(...entities);
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
        else {
          if (element instanceof User) this.users[element.uuid.UUID] = element;
          else {
            this.entities[element.uuid.UUID] = element;
            if (element instanceof Player)
              this.players[element.uuid.UUID] = element;
            if (element instanceof Virus)
              this.viruses[element.uuid.UUID] = element;
            if (element instanceof Food) this.food[element.uuid.UUID] = element;
            if (element instanceof Mass) this.mass[element.uuid.UUID] = element;
          }
        }
      }
    );
  }

  update() {
    for (const [uuid, user] of Object.entries(this.users)) {
      user.x += clamp(user.mouse.x, -0.5, 0.5) / 1.6;
      user.y += clamp(user.mouse.y, -0.5, 0.5) / 1.6;
      user.x = clamp(user.x, 0, this.width);
      user.y = clamp(user.y, 0, this.height);
    }
  }

  get width() {
    return parseInt(this.#width);
  }

  get height() {
    return parseInt(this.#height);
  }
}

/**
 * Adapted function from StackOverflow
 * @returns {{UUID:string, buff:ArrayBuffer}}
 */
function uuid() {
  function getRandomSymbol(symbol) {
    let array;

    if (symbol === "y") {
      array = ["8", "9", "a", "b"];
      return array[Math.floor(Math.random() * array.length)];
    }

    array = new Uint8Array(1);
    crypto.getRandomValues(array);
    return (array[0] % 16).toString(16);
  }

  const UUID = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    getRandomSymbol
  );
  const buff = new Uint8Array(
    UUID.match(/[a-f0-9]/g).map((h) => parseInt(h, 16))
  ).buffer;
  return { UUID, buff };
}

module.exports = {
  World,
  uuid,
  clamp,
  Entities: {
    Player,
    Virus,
    Food,
    Mass,
    User,
  },
};
