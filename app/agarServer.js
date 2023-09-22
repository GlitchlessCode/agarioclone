const crypto = require("crypto");

class Entity {
  /** @type {number} */
  x;
  /** @type {number} */
  y;
  /** @type {number} */
  radius;
  /** @type {{UUID: string, buff: ArrayBuffer}} */
  #uuid;
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   */
  constructor(x, y, radius) {
    this.#uuid = uuid();
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

class User extends Entity {
  constructor(...args) {
    super(...args);
  }
}

class World {
  /** @type {Object.<string, Entity>} */
  entities;
  /** @type {Object.<string, Entity>} */
  players;
  /** @type {Object.<string, Entity>} */
  viruses;
  /** @type {Object.<string, Entity>} */
  food;
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
    entities.forEach(
      /**
       * @param {Entity} element
       */
      (element) => {
        if (!(element instanceof Entity))
          throw new TypeError("entities[] must be of type Entity");
        else {
          this.entities[element.uuid.UUID] = element;
          if (element instanceof Player)
            this.players[element.uuid.UUID] = element;
          if (element instanceof Virus)
            this.viruses[element.uuid.UUID] = element;
          if (element instanceof Food) this.food[element.uuid.UUID] = element;
        }
      }
    );
    this.#width = width;
    this.#height = height;
  }

  update() {}

  get width() {
    return this.#width;
  }

  get height() {
    return this.#height;
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
  Entities: {
    Player,
    Virus,
    Food,
    User,
  },
};
