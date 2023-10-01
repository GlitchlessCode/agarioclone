const crypto = require("crypto");

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {Array} arr
 * @returns {number}
 */
function arrAverage(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * @param {string} str
 * @returns {string}
 */
function stringToColour(str) {
  let hash = 0;
  str.split("").forEach((char) => {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  });
  let colour = "#";
  for (let i = 0; i < 3; i++) {
    const value = clamp((hash >> (i * 8)) & 0xff, 20, 180);
    colour += value.toString(16).padStart(2, "0");
  }
  return colour;
}

class Entity {
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
  }

  get uuid() {
    return this.#uuid;
  }

  update() {}
}

class Circle extends Entity {
  /** @type {string} */
  colour;
  /**@type {number} */
  mass;
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} colour
   */
  constructor(x, y, colour, mass) {
    super(x, y);
    this.colour = colour;
    this.mass = mass;
  }

  get radius() {
    return Math.sqrt(this.mass / Math.PI);
  }
}

class Player extends Circle {
  /** @type {string} */
  #userID;
  /** @type {Object.<string, Player>} */
  siblings;
  /** @type {number} */
  velX;
  /** @type {number} */
  velY;

  /**
   * @param {number} x
   * @param {number} y
   * @param {string} userID
   */
  constructor(x, y, userID) {
    super(x, y, "#00000000", 25);
    this.#userID = userID;
    this.velX = 0;
    this.velY = 0;
  }

  get userID() {
    return this.#userID;
  }
}

class Food extends Circle {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    super(x, y, stringToColour((Math.random() * 10).toString()), 1);
  }
}

class Virus extends Circle {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    super(x, y, "#77ff77", 118);
  }
}

class Mass extends Circle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} colour
   */
  constructor(x, y, colour) {
    super(x, y, colour, 12);
  }
}

class User extends Entity {
  /** @type {{x: number, y:number}} */
  mouse;
  /** @type {Object.<string, Player>} */
  players;
  /** @type {World} */
  world;
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} [UUID]
   * @param {World} world
   */
  constructor(x, y, UUID, world) {
    super(x, y, UUID);
    this.mouse = { x: 0, y: 0 };
    const ref = this;
    this.players = new Proxy(
      {},
      {
        /**
         * @param {{}} target
         * @param {string} prop
         * @param {Player} player
         * @returns
         */
        set(target, property, player) {
          player.colour = stringToColour(ref.uuid.UUID);
          player.siblings = ref.players;
          return Reflect.set(...arguments);
        },
      }
    );
    this.world = world;
  }

  kill() {
    for (const [uuid, player] of Object.entries(this.players)) {
      delete this.world.entities[uuid];
      delete this.world.players[uuid];
    }
    delete this.world.users[this.uuid.UUID];
  }
}

class World {
  /** @type {Object.<string, Circle>} */
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
   * @param  {...Circle} entities
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
   * @param  {...Circle} entities
   */
  addEntities(...entities) {
    entities.forEach(
      /**
       * @param {Circle} element
       */
      (element) => {
        if (!(element instanceof Entity))
          throw new TypeError("entities[] must be of type Entity");
        else {
          if (element instanceof User) this.users[element.uuid.UUID] = element;
          else {
            this.entities[element.uuid.UUID] = element;
            if (element instanceof Player) {
              this.players[element.uuid.UUID] = element;
              this.users[element.userID].players[element.uuid.UUID] = element;
            }
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
      const players = Object.values(user.players);

      players.forEach((player) => {
        player.velX = player.velX * 0.99;
        player.velY = player.velY * 0.99;

        player.x +=
          (5 / (player.radius * 10) + 0.23) *
            4 *
            clamp(user.mouse.x, -0.25, 0.25) +
          player.velX;
        player.y +=
          (5 / (player.radius * 10) + 0.23) *
            4 *
            clamp(user.mouse.y, -0.25, 0.25) +
          player.velY;

        player.x = clamp(player.x, 0, this.width);
        player.y = clamp(player.y, 0, this.height);
      });

      user.x = arrAverage(players.map((player) => player.x));
      user.y = arrAverage(players.map((player) => player.y));

      // Clamp (just in case)
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
  Circle,
  Entity,
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
