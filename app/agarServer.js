const crypto = require("crypto");

/**
 * @param {Circle} entity
 */
function getType(entity) {
  if (entity instanceof Player) return 0;
  if (entity instanceof Virus) return 1;
  if (entity instanceof Food) return 2;
  if (entity instanceof Mass) return 3;
  throw new Error("Invalid Entity Configuration");
}

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

/**
 * Bentley-Ottmann algorithm adaptation to find all intersecting circles
 * @param {Circle[]} circles
 * @returns {[[Circle, Circle]]}
 */
function findCircleIntersections(circles) {
  /** @type {Array.<{x: number, y:number, circle:Circle, type: "left"|"right"}>} */
  const events = [];
  /** @type {[[Circle, Circle]]} */
  const intersections = [];

  circles.forEach((circle) => {
    const { x, radius } = circle;
    events.push(
      { x: x - radius, circle, type: "left" },
      { x: x + radius, circle, type: "right" }
    );
  });

  events.sort((a, b) => a.x - b.x);

  const activeCircles = new Set();
  events.forEach(({ circle, type }) => {
    if (type === "left") {
      activeCircles.forEach((activeCircle) => {
        if (circle.intersecting(activeCircle)) {
          if (circle.radius >= activeCircle.radius)
            intersections.push([circle, activeCircle]);
          else intersections.push([activeCircle, circle]);
        }
      });
      activeCircles.add(circle);
    } else {
      activeCircles.delete(circle);
    }
  });

  return intersections;
}

function getForce(G, m, M, r) {
  return (G * m * M) / r ** 2;
}

class Entity {
  /** @type {boolean} */
  different;
  /** @type {number} */
  x;
  /** @type {number} */
  y;
  /** @type {{UUID: string, buff: ArrayBuffer}} */
  _uuid;
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} [UUID]
   */
  constructor(x, y, UUID) {
    this._uuid = UUID ? UUID : uuid();
    this.x = x;
    this.y = y;
    this.different = true;
    return new Proxy(this, {
      set(target, prop, value) {
        Reflect.set(target, "different", true);
        return Reflect.set(...arguments);
      },
    });
  }

  get uuid() {
    return this._uuid;
  }

  /**
   * @param {Entity} entity
   */
  getDistance(entity) {
    return Math.hypot(this.x - entity.x, this.y - entity.y);
  }
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

  /**
   * @param {Entity} entity
   * @returns {boolean}
   */
  intersecting(entity) {
    return this.getDistance(entity) <= this.radius + entity.radius;
  }

  /**
   * @param {Entity} entity
   * @returns {boolean}
   */
  encloses(entity) {
    return this.getDistance(entity) + entity.radius <= this.radius;
  }

  get radius() {
    return Math.sqrt(this.mass / Math.PI);
  }
}

class Player extends Circle {
  /** @type {string} */
  _userID;
  /** @type {Object.<string, Player>} */
  siblings;
  /** @type {number} */
  velX;
  /** @type {number} */
  velY;
  /** @type {number} */
  mergeTimer;

  /**
   * @param {number} x
   * @param {number} y
   * @param {string} userID
   */
  constructor(x, y, userID) {
    super(x, y, "#00000000", 25);
    this._userID = userID;
    this.velX = 0;
    this.velY = 0;
    this.mergeTimer = 0;
  }

  get userID() {
    return this._userID;
  }

  /**
   * @param {Vector2} vector
   * @returns {Player}
   */
  split(vector) {
    this.mass = Math.floor(this.mass / 2);
    this.velX -= vector.x / 6;
    this.velY -= vector.y / 6;

    const newPlayer = new Player(this.x, this.y, this.userID);
    newPlayer.velX = vector.x;
    newPlayer.velY = vector.y;
    newPlayer.mass = this.mass;
    return newPlayer;
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
  /** @type {number} */
  scale;
  /** @type {{NAME: string, buff: ArrayBuffer}} */
  name;
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
    this.scale = 1;
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
    const name = stringToColour(this.uuid.UUID); // ! TEMPORARY
    this.name = { NAME: name, buff: new TextEncoder().encode(name).buffer };
  }

  kill() {
    for (const [uuid, player] of Object.entries(this.players)) {
      delete this.world.entities[uuid];
      delete this.world.players[uuid];
      this.world.killed.push(player.uuid);
    }
    delete this.world.users[this.uuid.UUID];
  }

  get bounds() {
    return {
      left: Math.min(
        ...Object.values(this.players).map((player) => player.x - player.radius)
      ),
      right: Math.max(
        ...Object.values(this.players).map((player) => player.x + player.radius)
      ),
      top: Math.min(
        ...Object.values(this.players).map((player) => player.y - player.radius)
      ),
      bottom: Math.max(
        ...Object.values(this.players).map((player) => player.y + player.radius)
      ),
    };
  }

  /**
   * @typedef {{x: number, y:number}} Vector2
   */

  /**
   * @returns {Vector2}
   */
  get mouseVector() {
    const clampedX = this.mouse.x;
    const clampedY = this.mouse.y;
    const dist = Math.min(Math.hypot(clampedX, clampedY) * 14, 1);
    const angle = Math.atan2(clampedX, clampedY);
    return {
      x: Math.sin(angle) * dist,
      y: Math.cos(angle) * dist,
    };
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
  /** @type {number} */
  minFood;
  /** @type {{UUID: string, buff: ArrayBuffer}[]} */
  killed;

  /**
   * @param {bigint} width
   * @param {bigint} height
   * @param  {...Circle} entities
   */
  constructor(width, height, minFood, ...entities) {
    this.entities = {};
    this.players = {};
    this.viruses = {};
    this.food = {};
    this.mass = {};
    this.users = {};
    this.addEntities(...entities);
    this.#width = width;
    this.#height = height;
    this.minFood = minFood;
    this.killed = [];
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
    const intersections = findCircleIntersections(Object.values(this.entities));
    intersections.forEach(([larger, smaller]) => {
      if (larger instanceof Player && smaller instanceof Food) {
        if (!larger.encloses(smaller)) return;
        larger.mass++;
        delete this.entities[smaller.uuid.UUID];
        delete this.food[smaller.uuid.UUID];
        this.killed.push(smaller.uuid);
      } else if (larger instanceof Player && smaller instanceof Player) {
        // TODO: Add Eating & Merge Timer
        const separation = getForce(
          -0.01,
          larger.mass,
          smaller.mass,
          larger.getDistance(smaller)
        );
        if (
          separation > Number.MAX_SAFE_INTEGER ||
          separation < Number.MIN_SAFE_INTEGER
        )
          return;
        const largerSepVelocity = (separation / larger.mass) * 0.25;
        const smallerSepVelocity = (separation / smaller.mass) * 0.25;
        const angle = Math.atan2(larger.y - smaller.y, larger.x - smaller.x);
        smaller.velX += Math.cos(angle) * smallerSepVelocity;
        larger.velX += Math.cos(angle + Math.PI) * largerSepVelocity;
      } else if (larger instanceof Player && smaller instanceof Virus) {
      } else if (larger instanceof Player && smaller instanceof Mass) {
      } else if (larger instanceof Virus && smaller instanceof Mass) {
      }
    });

    for (const [uuid, user] of Object.entries(this.users)) {
      const players = Object.values(user.players);

      players.forEach((player) => {
        player.velX = player.velX * 0.9;
        player.velY = player.velY * 0.9;

        const cohesionAngle = Math.atan2(user.y - player.y, user.x - player.x);
        const cohesionStrength =
          0.1 * Math.log10(0.8 * player.getDistance(user) + 1);

        const cohereX = Math.cos(cohesionAngle) * cohesionStrength;
        const cohereY = Math.sin(cohesionAngle) * cohesionStrength;

        player.x +=
          (8 / (player.radius * 10) + 0.13) * user.mouseVector.x +
          player.velX +
          cohereX;
        player.y +=
          (8 / (player.radius * 10) + 0.13) * user.mouseVector.y +
          player.velY +
          cohereY;

        player.x = clamp(player.x, 0, this.width);
        player.y = clamp(player.y, 0, this.height);
      });

      user.x = (user.bounds.left + user.bounds.right) / 2;
      user.y = (user.bounds.top + user.bounds.bottom) / 2;

      user.scale =
        100 /
        (Math.max(
          user.bounds.bottom - user.bounds.top,
          user.bounds.right - user.bounds.left
        ) +
          60);

      // Clamp (just in case)
      user.x = clamp(user.x, 0, this.width);
      user.y = clamp(user.y, 0, this.height);
    }

    if (Object.keys(this.food).length < this.minFood) {
      this.addEntities(
        ...Array.from(
          { length: this.minFood - Object.keys(this.food).length },
          () =>
            new Food(
              Math.random() * this.width,
              Math.random() * this.height,
              0.3
            )
        )
      );
    }
  }

  reset() {
    Object.values(this.entities)
      .filter((a) => a.different)
      .forEach((circle) => (circle.different = false));
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
  getType,
  Entities: {
    Player,
    Virus,
    Food,
    Mass,
    User,
  },
};
