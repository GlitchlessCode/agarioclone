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

function getForce(percent, radius) {
  return -Math.min(
    0.1 * radius,
    Math.max(0.005, 0.1 * radius * Math.log10(8 * percent))
  );
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
  /** @type {{tick:number, data:{}}} */
  packData;
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
    this.packData = { tick: Number.MIN_SAFE_INTEGER, data: {} }; // ! Going to remove
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

  /**
   * @param {number} tick
   */
  collisionPack(tick) {
    return { type: 255 };
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

    const newPlayer = new Player(
      this.x,
      this.y,
      this.userID,
      this.userIndex,
      Partition
    );
    newPlayer.velX = vector.x;
    newPlayer.velY = vector.y;
    newPlayer.mass = this.mass;
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

  /**
   * @param {number} bitmask
   */
  pack(bitmask) {
    let result = { type: 0 };
    if (bitmask & 0b000000001) {
      // x
      result.x = this.x;
    }
    if (bitmask & 0b000000010) {
      // y
      result.y = this.y;
    }
    if (bitmask & 0b000000100) {
      // uuid
      result.uuid = this.uuid.UUID;
    }
    if (bitmask & 0b000001000) {
      // mass
      result.mass = this.mass;
    }
    if (bitmask & 0b000010000) {
      // radius
      result.radius = this.radius;
    }
    if (bitmask & 0b000100000) {
      // velX
      result.velX = this.velX;
    }
    if (bitmask & 0b001000000) {
      // velY
      result.velY = this.velY;
    }
    if (bitmask & 0b010000000) {
      // mergeTimer
      result.mergeTimer = this.mergeTimer;
    }
    if (bitmask & 0b100000000) {
      // userID
      result.userID = this.userID;
    }
    return result;
  }

  /**
   * @param {number} tick
   */
  collisionPack(tick) {
    if (tick !== this.packData) {
      this.packData.tick = tick;
      this.packData.data = this.pack(0b110011111);
    }
    return this.packData.data;
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

  /**
   * @param {number} bitmask
   */
  pack(bitmask) {
    let result = { type: 2 };
    if (bitmask & 0b00001) {
      // x
      result.x = this.x;
    }
    if (bitmask & 0b00010) {
      // y
      result.y = this.y;
    }
    if (bitmask & 0b00100) {
      // uuid
      result.uuid = this.uuid.UUID;
    }
    if (bitmask & 0b01000) {
      // mass
      result.mass = this.mass;
    }
    if (bitmask & 0b10000) {
      // radius
      result.radius = this.radius;
    }
    return result;
  }

  /**
   * @param {number} tick
   */
  collisionPack(tick) {
    if (tick !== this.packData) {
      this.packData.tick = tick;
      this.packData.data = this.pack(0b11111);
    }
    return this.packData.data;
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

  /**
   * @param {number} bitmask
   */
  pack(bitmask) {
    let result = { type: 1 };
    if (bitmask & 0b00001) {
      // x
      result.x = this.x;
    }
    if (bitmask & 0b00010) {
      // y
      result.y = this.y;
    }
    if (bitmask & 0b00100) {
      // uuid
      result.uuid = this.uuid.UUID;
    }
    if (bitmask & 0b01000) {
      // mass
      result.mass = this.mass;
    }
    if (bitmask & 0b10000) {
      // radius
      result.radius = this.radius;
    }
    return result;
  }

  /**
   * @param {number} tick
   */
  collisionPack(tick) {
    if (tick !== this.packData) {
      this.packData.tick = tick;
      this.packData.data = this.pack(0b11111);
    }
    return this.packData.data;
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

  /**
   * @param {number} bitmask
   */
  pack(bitmask) {
    let result = { type: 3 };
    if (bitmask & 0b00001) {
      // x
      result.x = this.x;
    }
    if (bitmask & 0b00010) {
      // y
      result.y = this.y;
    }
    if (bitmask & 0b00100) {
      // uuid
      result.uuid = this.uuid.UUID;
    }
    if (bitmask & 0b01000) {
      // mass
      result.mass = this.mass;
    }
    if (bitmask & 0b10000) {
      // radius
      result.radius = this.radius;
    }
    return result;
  }

  /**
   * @param {number} tick
   */
  collisionPack(tick) {
    if (tick !== this.packData) {
      this.packData.tick = tick;
      this.packData.data = this.pack(0b11111);
    }
    return this.packData.data;
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
    super(x, y, world.dealloc.user.shift(), UUID);
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
  /** @type {{UUID: string, buff: ArrayBuffer}[]} */
  killed;
  /** @type {{player: SharedBufferPartition[], virus: SharedBufferPartition[], food: SharedBufferPartition[], mass: SharedBufferPartition[], user: SharedBufferPartition[]}} */
  dealloc;
  /** @type {number} */
  tick;

  /**
   * @typedef {Object} Partition
   * @property {number} size
   * @property {number} count
   */
  /**
   * @param {bigint} width
   * @param {bigint} height
   * @param {number} minFood
   * @param {Uint8Array} sharedMemory
   * @param {{player: Partition, virus: Partition, food: Partition, mass: Partition, user: Partition}} partitionData
   * @param  {...Circle} entities
   */
  constructor(
    width,
    height,
    minFood,
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
    this.killed = [];
    this.tick = 0;
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

  /**
   * @param {number} DeltaTime
   */
  async update(DeltaTime, Workers) {
    this.tick = (this.tick + 1) % 2;
    const intersections = findCircleIntersections(Object.values(this.entities));
    // const intersectionTasks = intersections.map(([larger, smaller]) => {
    //   return {
    //     type: 2,
    //     data: {
    //       smaller: smaller.collisionPack(this.tick),
    //       larger: larger.collisionPack(this.tick),
    //       DeltaTime,
    //     },
    //   };
    // });
    // await Workers.massAssign(intersectionTasks);
    this.collisionSim(intersections, DeltaTime);

    Workers.assignAll({
      type: 1,
      data: { tick: this.tick, DeltaTime },
    });

    for (const [uuid, user] of Object.entries(this.users)) {
      // * Newer
      // const players = Object.values(user.players);

      // const packedUser = user.pack(0b1111);
      // const packedWorld = { width: this.width, height: this.height };
      // const moveTasks = players.map((player) => {
      //   return {
      //     type: 1,
      //     data: {
      //       player: player.pack(0b001111111),
      //       user: packedUser,
      //       world: packedWorld,
      //       DeltaTime,
      //     },
      //   };
      // });

      // const result = await Workers.massAssign(moveTasks);

      // result.forEach(
      //   /** @param {PseudoPlayer} result */
      //   (result) => {
      //     user.players[result.uuid].x = result.x;
      //     user.players[result.uuid].y = result.y;
      //     user.players[result.uuid].mass = result.mass;
      //     user.players[result.uuid].velX = result.velX;
      //     user.players[result.uuid].velY = result.velY;
      //   }
      // );

      // ! Original
      // players.forEach((player) => {
      //   player.mass = Math.max(player.mass * 0.9998, 10);

      //   player.velX = player.velX * 0.9 ** DeltaTime;
      //   player.velY = player.velY * 0.9 ** DeltaTime;

      //   const cohesionAngle = Math.atan2(user.y - player.y, user.x - player.x);
      //   const cohesionStrength =
      //     0.01 *
      //     player.getDistance(user) ** (0.1 * player.getDistance(user) + 0.5);

      //   const cohereX = Math.cos(cohesionAngle) * cohesionStrength;
      //   const cohereY = Math.sin(cohesionAngle) * cohesionStrength;

      //   player.x +=
      //     (8 / (player.radius * 10) + 0.13) * user.mouseVector.x * DeltaTime +
      //     player.velX +
      //     cohereX;
      //   player.y +=
      //     (8 / (player.radius * 10) + 0.13) * user.mouseVector.y * DeltaTime +
      //     player.velY +
      //     cohereY;

      //   player.x = clamp(player.x, 0, this.width);
      //   player.y = clamp(player.y, 0, this.height);
      // });

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
  }

  /**
   * @param {[Circle, Circle][]} intersections
   */
  collisionSim(intersections, DeltaTime) {
    intersections.forEach(([larger, smaller]) => {
      if (larger instanceof Player && smaller instanceof Food) {
        if (!larger.encloses(smaller)) return;
        larger.mass++;
        this.dealloc.food.unshift(smaller.kill());
        delete this.entities[smaller.uuid.UUID];
        delete this.food[smaller.uuid.UUID];
        this.killed.push(smaller.uuid);
      } else if (larger instanceof Player && smaller instanceof Player) {
        // TODO: Add Eating & Merge Timer
        if (larger.userID == smaller.userID) {
          // * User is the same
          const separation = getForce(
            1 - larger.getDistance(smaller) / (larger.radius + smaller.radius),
            larger.radius
          );
          if (
            separation > Number.MAX_SAFE_INTEGER ||
            separation < Number.MIN_SAFE_INTEGER
          )
            return;
          const angle = Math.atan2(larger.y - smaller.y, larger.x - smaller.x);
          smaller.velX += Math.cos(angle) * separation * DeltaTime;
          smaller.velY += Math.sin(angle) * separation * DeltaTime;
          larger.velX += Math.cos(angle + Math.PI) * separation * DeltaTime;
          larger.velY += Math.sin(angle + Math.PI) * separation * DeltaTime;
        } else {
          // * User is different
          console.log(larger.getOverlap(smaller) / smaller.mass);
        }
      } else if (larger instanceof Player && smaller instanceof Virus) {
      } else if (larger instanceof Player && smaller instanceof Mass) {
      } else if (larger instanceof Virus && smaller instanceof Mass) {
      }
    });
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
      throw new Error("Cannot have more than 255 users");
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
