const crypto = require("crypto");
const { SharedBufferPartition } = require("./modules/sharedData");

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
 * @callback CollisionFilter
 * @param {Circle} circleA
 * @param {Circle} circleB
 * @returns {boolean}
 */
/**
 * Bentley-Ottmann algorithm adaptation to find all intersecting circles
 * @param {Circle[]} circles
 * @param {CollisionFilter} filter
 * @returns {[[Circle, Circle]]}
 */
function findCircleIntersections(circles, filter) {
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
        if (circle.intersecting(activeCircle) && filter(circle, activeCircle)) {
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

class Entity {
  /** @type {SharedBufferPartition} */
  _Partition;
  /** @type {boolean} */
  different;
  /** @type {{UUID: string, buff: ArrayBuffer}} */
  _uuid;
  /**
   * @param {number} x
   * @param {number} y
   * @param {SharedBufferPartition} Partition
   * @param {string} [UUID]
   */
  constructor(x, y, Partition, UUID) {
    this._Partition = Partition;
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

  /**
   * @param {Entity} entity
   */
  getAngle(entity) {
    return Math.atan2(entity.y - this.y, entity.x - this.x);
  }

  get x() {
    return this._Partition.data.getFloat64(0);
  }

  set x(val) {
    this._Partition.data.setFloat64(0, val);
  }

  get y() {
    return this._Partition.data.getFloat64(8);
  }

  set y(val) {
    this._Partition.data.setFloat64(8, val);
  }

  kill() {
    return this._Partition;
  }
}

class Circle extends Entity {
  /** @type {string} */
  colour;
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} colour
   * @param {number} mass
   * @param {SharedBufferPartition} Partition
   */
  constructor(x, y, colour, mass, Partition) {
    super(x, y, Partition);
    this.colour = colour;
    this.mass = mass;
  }

  /**
   * @param {Circle} entity
   * @returns {boolean}
   */
  intersecting(entity) {
    return this.getDistance(entity) <= this.radius + entity.radius;
  }

  /**
   * @param {Circle} entity
   * @returns {boolean}
   */
  encloses(entity) {
    return this.getDistance(entity) + entity.radius <= this.radius;
  }

  /**
   * Credit to https://www.geeksforgeeks.org/area-of-intersection-of-two-circles/
   * @param {Circle} entity
   * @returns {number}
   */
  getOverlap(entity) {
    const dist = this.getDistance(entity);

    if (this.intersecting(entity)) {
      const sqrRadA = this.radius ** 2;
      const sqrRadB = entity.radius ** 2;
      if (dist <= Math.abs(entity.radius - this.radius)) {
        return Math.PI * Math.min(sqrRadA, sqrRadB);
      }
      const ALPHA =
        Math.acos((sqrRadA + dist ** 2 - sqrRadB) / (2 * this.radius * dist)) *
        2;
      const BETA =
        Math.acos(
          (sqrRadB + dist ** 2 - sqrRadA) / (2 * entity.radius * dist)
        ) * 2;
      const a1 = 0.5 * BETA * sqrRadB - 0.5 * sqrRadB * Math.sin(BETA);
      const a2 = 0.5 * ALPHA * sqrRadA - 0.5 * sqrRadA * Math.sin(ALPHA);
      return a1 + a2;
    }
    return 0;
  }

  get mass() {
    return this._Partition.data.getFloat32(16);
  }

  set mass(val) {
    this._Partition.data.setFloat32(16, val);
  }

  get radius() {
    return Math.sqrt(this.mass / Math.PI);
  }

  pack() {
    throw new TypeError("cannot pack Entity of type Circle");
  }

  get name() {
    return "circle";
  }
}

/**
 * @typedef {Object} PseudoPlayer
 * @property {number} x
 * @property {number} y
 * @property {string} uuid
 * @property {number} mass
 * @property {number} radius
 * @property {number} velX
 * @property {number} velY
 * @property {number} mergeTimer
 * @property {string} userID
 */

class Player extends Circle {
  /** @type {string} */
  _userID;
  /** @type {Object.<string, Player>} */
  siblings;

  /**
   * @param {number} x
   * @param {number} y
   * @param {string} userID
   * @param {SharedBufferPartition} Partition
   */
  constructor(x, y, userID, userIndex, Partition) {
    super(x, y, "#00000000", 25, Partition);
    this._userID = userID;
    this._Partition.data.setUint8(30, userIndex);
    this.velX = 0;
    this.velY = 0;
    this.mergeTimer = 0;
  }

  get userID() {
    return this._userID;
  }

  /**
   * @param {Vector2} vector
   * @param {SharedBufferPartition} Partition
   * @returns {Player}
   */
  split(vector, Partition) {
    this.mass = this.mass / 2;
    this.velX -= vector.x / 6;
    this.velY -= vector.y / 6;
    const timer = 30000 + Math.floor(0.02333333333 * this.mass) * 1000;
    this.mergeTimer = timer;

    const newPlayer = new Player(
      this.x + vector.x / 2,
      this.y + vector.y / 2,
      this.userID,
      this.userIndex,
      Partition
    );
    newPlayer.velX = vector.x;
    newPlayer.velY = vector.y;
    newPlayer.mass = this.mass;
    newPlayer.mergeTimer = timer;
    return newPlayer;
  }

  get velX() {
    return this._Partition.data.getFloat32(20);
  }

  set velX(val) {
    this._Partition.data.setFloat32(20, val);
  }

  get velY() {
    return this._Partition.data.getFloat32(24);
  }

  set velY(val) {
    this._Partition.data.setFloat32(24, val);
  }

  get mergeTimer() {
    return this._Partition.data.getUint16(28);
  }

  set mergeTimer(val) {
    this._Partition.data.setUint16(28, val);
  }

  get userIndex() {
    return this._Partition.data.getUint8(30);
  }

  pack() {
    return { type: 0, index: this._Partition.index };
  }

  get name() {
    return "player";
  }
}

class Food extends Circle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {SharedBufferPartition} Partition
   */
  constructor(x, y, Partition) {
    super(x, y, stringToColour((Math.random() * 10).toString()), 1, Partition);
  }

  pack() {
    return { type: 2, index: this._Partition.index };
  }

  get name() {
    return "food";
  }
}

class Virus extends Circle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {SharedBufferPartition} Partition
   */
  constructor(x, y, Partition) {
    super(x, y, "#22ff22", 100, Partition);
  }

  pack() {
    return { type: 1, index: this._Partition.index };
  }

  get name() {
    return "virus";
  }
}

class Mass extends Circle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} colour
   */
  constructor(x, y, colour, Partition) {
    super(x, y, colour, 12, Partition);
  }

  pack() {
    return { type: 3, index: this._Partition.index };
  }

  get name() {
    return "mass";
  }
}

class User extends Entity {
  /** @type {Object.<string, Player>} */
  players;
  /** @type {World} */
  world;
  /** @type {number} */
  scale;
  /** @type {{NAME: string, buff: ArrayBuffer}} */
  name;
  /** @type {number} */
  _userIndex;
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} [UUID]
   * @param {World} world
   */
  constructor(x, y, UUID, world, userIndex) {
    super(x, y, world.dealloc.user.shift(), UUID); // ! Temporary
    this.mouse.x = 0;
    this.mouse.y = 0;
    this._userIndex = userIndex;
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

  get userIndex() {
    return this._userIndex;
  }

  kill() {
    for (const [uuid, player] of Object.entries(this.players)) {
      this.world.dealloc.player.unshift(player.kill());
      delete this.world.entities[uuid];
      delete this.world.players[uuid];
      this.world.killed.push(player.uuid);
      delete this.players[uuid];
    }
    delete this.world.users[this.uuid.UUID];
    return this._Partition;
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

  get mouse() {
    const ref = this;
    return {
      get x() {
        return ref._Partition.data.getFloat32(16);
      },
      set x(val) {
        ref._Partition.data.setFloat32(16, val);
      },
      get y() {
        return ref._Partition.data.getFloat32(20);
      },
      set y(val) {
        ref._Partition.data.setFloat32(20, val);
      },
    };
  }

  pack(bitmask) {
    let result = {};
    if (bitmask & 0b0001) {
      // x
      result.x = this.x;
    }
    if (bitmask & 0b0010) {
      // y
      result.y = this.y;
    }
    if (bitmask & 0b0100) {
      // uuid
      result.uuid = this.uuid.UUID;
    }
    if (bitmask & 0b1000) {
      // mouseVector
      result.mouseVector = this.mouseVector;
    }
    return result;
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
  /** @type {number} */
  minViruses;
  /** @type {{UUID: string, buff: ArrayBuffer}[]} */
  killed;
  /** @type {{player: SharedBufferPartition[], virus: SharedBufferPartition[], food: SharedBufferPartition[], mass: SharedBufferPartition[], user: SharedBufferPartition[]}} */
  dealloc;
  /** @type {number} */
  tick;
  /** @type {{player: Partition, virus: Partition, food: Partition, mass: Partition, user: Partition}}*/
  partitionData;
  /** @type {Object.<string, Circle>} */
  collisionWait;

  /**
   * @typedef {Object} Partition
   * @property {number} size
   * @property {number} count
   */
  /**
   * @param {bigint} width
   * @param {bigint} height
   * @param {number} minFood
   * @param {number} minViruses
   * @param {Uint8Array} sharedMemory
   * @param {{player: Partition, virus: Partition, food: Partition, mass: Partition, user: Partition}} partitionData
   * @param  {...Circle} entities
   */
  constructor(
    width,
    height,
    minFood,
    minViruses,
    sharedMemory,
    partitionData,
    ...entities
  ) {
    this.dealloc = {
      player: new Array(),
      virus: new Array(),
      food: new Array(),
      mass: new Array(),
      user: new Array(),
    };
    const { player, virus, food, mass, user } = partitionData;
    let total = 0;
    // Player Partitioning
    total += SharedBufferPartition.massConstruct(
      sharedMemory,
      this.dealloc.player,
      player.count,
      player.size,
      total
    );
    // Virus Partitioning
    total += SharedBufferPartition.massConstruct(
      sharedMemory,
      this.dealloc.virus,
      virus.count,
      virus.size,
      total
    );
    // Food Partitioning
    total += SharedBufferPartition.massConstruct(
      sharedMemory,
      this.dealloc.food,
      food.count,
      food.size,
      total
    );
    // Mass Partitioning
    total += SharedBufferPartition.massConstruct(
      sharedMemory,
      this.dealloc.mass,
      mass.count,
      mass.size,
      total
    );
    // User Partitioning
    SharedBufferPartition.massConstruct(
      sharedMemory,
      this.dealloc.user,
      user.count,
      user.size,
      total
    );

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
    this.minViruses = minViruses;
    this.killed = [];
    this.tick = 0;
    this.partitionData = partitionData;
    this.collisionWait = {};
  }

  /**
   * @param  {...Circle} entities
   */
  addEntities(...entities) {
    entities.forEach(
      /**
       * @param {Circle|PlayerParams|User} element
       */
      (element) => {
        if (element instanceof PlayerParams) {
          this.addEntities(
            new Player(
              element.x,
              element.y,
              element.UUID,
              element.userIndex,
              this.dealloc.player.shift() // ! Temporary
            )
          );
          return;
        }

        if (!(element instanceof Entity))
          throw new TypeError("entities[] must be of type Entity");
        else {
          if (element instanceof User) {
            this.users[element.uuid.UUID] = element;
          } else if (element instanceof Virus) {
            this.viruses[element.uuid.UUID] = element;
            this.collisionWait[element.uuid.UUID] = element;
          } else {
            this.entities[element.uuid.UUID] = element;
            if (element instanceof Player) {
              this.players[element.uuid.UUID] = element;
              this.users[element.userID].players[element.uuid.UUID] = element;
            }
            if (element instanceof Food) this.food[element.uuid.UUID] = element;
            if (element instanceof Mass) this.mass[element.uuid.UUID] = element;
          }
        }
      }
    );
  }

  /**
   * @param {number} DeltaTime
   */
  async update(DeltaTime, Workers) {
    this.tick = (this.tick + 1) % 2;
    const intersections = findCircleIntersections(
      Object.values(this.entities),
      (circleA, circleB) => {
        return !(
          (circleA instanceof Food && circleB instanceof Food) ||
          (circleA instanceof Virus && circleB instanceof Food)
        );
      }
    );
    const intersectionTasks = intersections.map(([larger, smaller], index) => {
      return {
        type: 2,
        data: {
          index,
          smaller: smaller.pack(),
          larger: larger.pack(),
          DeltaTime,
        },
      };
    });

    /** @type {[number, number, string, ?number][]} */
    const intersectionResult = await Workers.massAssign(intersectionTasks);

    /** @type {Object.<string,{target: Player, eaters: {circle: Player, percent: number}[]}>} */
    const playerMerges = {};
    /** @type {Object.<string,{target: Virus, eaters: {circle: Player, percent: number}[]}>} */
    const virusMerges = {};

    intersectionResult.forEach(([index, target, effect, extra]) => {
      const circle = intersections[index][target];
      switch (effect) {
        case "kill": {
          const name = circle.name;
          this.dealloc[name].unshift(circle.kill());
          delete this.entities[circle.uuid.UUID];
          delete this[name][circle.uuid.UUID];
          this.killed.push(circle.uuid);
          break;
        }
        case "eat_player": {
          const other = intersections[index][(target + 1) % 2]; // Selects the other Circle in the Intersection Set
          if (Object.hasOwn(playerMerges, other.uuid.UUID)) {
            playerMerges[other.uuid.UUID].eaters.push(circle);
          } else {
            playerMerges[other.uuid.UUID] = {
              target: other,
              eaters: [{ circle, percent: extra }],
            };
          }
          break;
        }
        case "eat_virus": {
          const other = intersections[index][(target + 1) % 2]; // Selects the other Circle in the Intersection Set
          if (Object.hasOwn(virusMerges, other.uuid.UUID)) {
            virusMerges[other.uuid.UUID].eaters.push(circle);
          } else {
            virusMerges[other.uuid.UUID] = {
              target: other,
              eaters: [{ circle, percent: extra }],
            };
          }
          break;
        }
      }
    });

    Object.values(playerMerges)
      .sort((a, b) => a.target.mass - b.target.mass)
      .forEach(({ eaters, target }) => {
        if (!(target instanceof Circle)) return;
        eaters.sort((a, b) => a.percent - b.percent);
        let eater = eaters.pop();
        while (!(eater.circle instanceof Player) && eaters.length)
          eater = eaters.pop();
        if (eater.circle instanceof Player) {
          eater.circle.mass += target.mass;
          this.dealloc.player.unshift(target.kill()); // ! Temporary
          delete this.entities[target.uuid.UUID];
          delete this.players[target.uuid.UUID];
          delete target.siblings[target.uuid.UUID];
          this.killed.push(target.uuid);
        }
      });

    Object.values(virusMerges)
      .sort((a, b) => a.target.mass - b.target.mass)
      .forEach(({ eaters, target }) => {
        if (!(target instanceof Circle)) return;
        eaters.sort((a, b) => a.percent - b.percent);
        let eater = eaters.pop();
        while (!eater instanceof Player) eater = eaters.pop();
        eater.circle.mass += target.mass;
        this.dealloc.virus.unshift(target.kill()); // ! Temporary
        delete this.entities[target.uuid.UUID];
        delete this.viruses[target.uuid.UUID];
        this.killed.push(target.uuid);

        const player = eater.circle;
        const mult = 3 * Math.sqrt(player.radius) * Math.log10(player.radius);
        const newPlayers = [];
        while (
          Object.keys(this.users[player.userID].players).length +
            newPlayers.length <
            16 &&
          Math.max(...[player, ...newPlayers].map((a) => a.mass)) >= 35
        ) {
          /** @type {Player} */
          const largest = [player, ...newPlayers].sort(
            (a, b) => b.mass - a.mass
          )[0];

          const angle = Math.random() * Math.PI * 2;

          newPlayers.push(
            largest.split(
              {
                x: Math.cos(angle) * mult,
                y: Math.sin(angle) * mult,
              },
              this.dealloc.player.shift() // ! Temporary
            )
          );
        }
        this.addEntities(...newPlayers);
      });

    await Workers.assignAll({
      type: 1,
      data: { tick: this.tick, DeltaTime },
    });

    for (const [uuid, user] of Object.entries(this.users)) {
      user.x = (user.bounds.left + user.bounds.right) / 2;
      user.y = (user.bounds.top + user.bounds.bottom) / 2;

      user.scale =
        100 /
        (Math.max(
          (user.bounds.bottom - user.bounds.top) * 1.1,
          (user.bounds.right - user.bounds.left) * 1.1
        ) +
          100);

      // Clamp (just in case)
      user.x = clamp(user.x, 0, this.width);
      user.y = clamp(user.y, 0, this.height);
    }

    try {
      if (Object.keys(this.food).length < this.minFood) {
        this.addEntities(
          ...Array.from(
            { length: this.minFood - Object.keys(this.food).length },
            () =>
              new Food(
                Math.random() * this.width,
                Math.random() * this.height,
                this.dealloc.food.shift() // ! Temporary
              )
          )
        );
      }
    } catch (err) {
      console.error(err);
    }

    try {
      if (Object.keys(this.viruses).length < this.minViruses) {
        this.addEntities(
          ...Array.from(
            { length: this.minViruses - Object.keys(this.viruses).length },
            () => {
              return new Virus(
                Math.random() * this.width,
                Math.random() * this.height,
                this.dealloc.virus.shift() // ! Temporary
              );
            }
          )
        );
      }
    } catch (err) {
      console.error(err);
    }

    if (Object.values(this.collisionWait).length > 0) {
      const placementIntersections = findCircleIntersections(
        [...Object.values(this.collisionWait), ...Object.values(this.players)],
        (circleA, circleB) => {
          return !(
            (Object.hasOwn(this.collisionWait, circleA.uuid.UUID) &&
              Object.hasOwn(this.collisionWait, circleB.uuid.UUID)) ||
            (Object.hasOwn(this.players, circleA.uuid.UUID) &&
              Object.hasOwn(this.players, circleB.uuid.UUID))
          );
        }
      );
      let spawnList = Object.keys(this.collisionWait);
      placementIntersections.forEach(([a, b]) => {
        spawnList = spawnList.filter(
          (str) => !(str == a.uuid.UUID || str == b.uuid.UUID)
        );
      });
      spawnList.forEach((id) => {
        this.entities[id] = this.collisionWait[id];
        delete this.collisionWait[id];
      });
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

  get newUserIndex() {
    if (this.dealloc.user.length == 0)
      throw new Error(
        `Cannot have more than ${this.partitionData.user.count} users`
      );
    return this.dealloc.user[0].index;
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

class PlayerParams {
  x;
  y;
  UUID;
  userIndex;
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} UUID
   * @param {number} userIndex
   */
  constructor(x, y, UUID, userIndex) {
    this.x = x;
    this.y = y;
    this.UUID = UUID;
    this.userIndex = userIndex;
  }
}

module.exports = {
  World,
  Circle,
  Entity,
  uuid,
  clamp,
  getType,
  Entities: {
    Player: PlayerParams,
    Virus,
    Food,
    Mass,
    User,
  },
  Player,
};
