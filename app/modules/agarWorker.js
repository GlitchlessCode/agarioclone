/** @type {{parentPort:MessagePort, threadId:number, workerData:SharedArrayBuffer}} */
const path = require("path");
const { parentPort, threadId, workerData } = require("worker_threads");
const { SHARED_MEMORY_PARTITIONS } = require("./sharedArrayBuffer");
const { SharedBufferPartition, MutexError } = require("./sharedData");
const SHARED_MEMORY = new Uint8Array(workerData.buff);
const world = {
  width: parseInt(workerData.world[0]),
  height: parseInt(workerData.world[1]),
};

// * Classes
class EntityInterface {
  /** @type {SharedBufferPartition} */
  _Partition;
  constructor() {}
  /**
   * @param {SharedBufferPartition} Partition
   */
  setPartition(Partition) {
    this._Partition = Partition;
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

  /**
   * @param {EntityInterface} entity
   */
  getDistance(entity) {
    return Math.hypot(this.x - entity.x, this.y - entity.y);
  }

  /**
   * @param {EntityInterface} entity
   */
  getAngle(entity) {
    return Math.atan2(entity.y - this.y, entity.x - this.x);
  }
}

class CircleInterface extends EntityInterface {
  constructor() {
    super();
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
   * @param {CircleInterface} entity
   * @returns {boolean}
   */
  intersecting(entity) {
    return this.getDistance(entity) <= this.radius + entity.radius;
  }

  /**
   * @param {CircleInterface} entity
   * @returns {boolean}
   */
  encloses(entity) {
    return this.getDistance(entity) + entity.radius <= this.radius;
  }

  /**
   * Credit to https://www.geeksforgeeks.org/area-of-intersection-of-two-circles/
   * @param {CircleInterface} entity
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
}

class PlayerInterface extends CircleInterface {
  constructor() {
    super();
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
}

class VirusInterface extends CircleInterface {
  constructor() {
    super();
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
}

class FoodInterface extends CircleInterface {
  constructor() {
    super();
  }
}

class UserInterface extends EntityInterface {
  constructor() {
    super();
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
}

// * Setup
const PARTITIONS = {
  /** @type {SharedBufferPartition[]} */
  player: new Array(),
  /** @type {SharedBufferPartition[]} */
  virus: new Array(),
  /** @type {SharedBufferPartition[]} */
  food: new Array(),
  /** @type {SharedBufferPartition[]} */
  mass: new Array(),
  /** @type {SharedBufferPartition[]} */
  user: new Array(),
};
const { player, virus, food, mass, user } = SHARED_MEMORY_PARTITIONS;
let total = 0;
// Player Partitioning
total += SharedBufferPartition.massConstruct(
  SHARED_MEMORY,
  PARTITIONS.player,
  player.count,
  player.size,
  total
);
// Virus Partitioning
total += SharedBufferPartition.massConstruct(
  SHARED_MEMORY,
  PARTITIONS.virus,
  virus.count,
  virus.size,
  total
);
// Food Partitioning
total += SharedBufferPartition.massConstruct(
  SHARED_MEMORY,
  PARTITIONS.food,
  food.count,
  food.size,
  total
);
// Mass Partitioning
total += SharedBufferPartition.massConstruct(
  SHARED_MEMORY,
  PARTITIONS.mass,
  mass.count,
  mass.size,
  total
);
// User Partitioning
SharedBufferPartition.massConstruct(
  SHARED_MEMORY,
  PARTITIONS.user,
  user.count,
  user.size,
  total
);

const Player = new PlayerInterface();
const Player2 = new PlayerInterface();
const Virus = new VirusInterface();
const Food = new FoodInterface();
const User = new UserInterface();
// * End of Setup

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
 * @param {SharedBufferPartition} playerPartition
 */
function playerActive(playerPartition) {
  if (playerPartition.data.getFloat32(16)) return true;
  return false;
}

/**
 * @typedef {Object} task
 * @property {number} type
 * @property {any} data
 */

parentPort.on(
  "message",
  /** @param {{task: task, port: [MessagePort]}} param0 */
  ({ task, port: [port] }) => {
    switch (task.type) {
      case 1:
        let lockCount = 0;
        for (let i = 0; i < SHARED_MEMORY_PARTITIONS.player.count; i++) {
          const player = PARTITIONS.player[i];
          if (!playerActive(player)) break;
          if (!player.mutex.lock()) continue;
          const playerTick = player.data.getUint8(31);
          if (
            playerTick !== (0b00000001 & task.data.tick) &&
            playerTick !== 255
          ) {
            player.data.setUint8(31, task.data.tick);
            lockCount++;

            Player.setPartition(player);
            User.setPartition(PARTITIONS.user[Player.userIndex]);
            updatePlayer(Player, User, task.data.DeltaTime);
          }
          player.mutex.unlock();
        }
        port.postMessage(lockCount);
        break;
      case 2:
        port.postMessage(collisionSim(task.data));
        break;
    }
  }
);

/**
 *
 * @param {PlayerInterface} player
 * @param {UserInterface} user
 * @param {number} DeltaTime
 */
function updatePlayer(player, user, DeltaTime) {
  player.mass = Math.max(player.mass * 0.9998, 10);
  if (player.mergeTimer)
    player.mergeTimer = clamp(
      player.mergeTimer - DeltaTime * 25,
      0,
      Number.MAX_SAFE_INTEGER
    );

  player.velX = player.velX * 0.9 ** DeltaTime;
  player.velY = player.velY * 0.9 ** DeltaTime;

  const cohesionAngle = Math.atan2(user.y - player.y, user.x - player.x);
  const cohesionStrength =
    0.01 * player.getDistance(user) ** (0.1 * player.getDistance(user) + 0.5) +
    0.1;

  const cohereX = Math.cos(cohesionAngle) * cohesionStrength;
  const cohereY = Math.sin(cohesionAngle) * cohesionStrength;

  const speed = 8 / (player.radius * 10) + 0.13;

  player.x += speed * user.mouseVector.x * DeltaTime + player.velX + cohereX;
  player.y += speed * user.mouseVector.y * DeltaTime + player.velY + cohereY;

  player.x = clamp(player.x, 0, world.width);
  player.y = clamp(player.y, 0, world.height);
}

/**
 * @param {number} indexA
 * @param {SharedBufferPartition} partitionA
 * @param {number} indexB
 * @param {SharedBufferPartition} partitionB
 */
function duoLock(indexA, partitionA, indexB, partitionB) {
  if (indexA < indexB) {
    partitionA.mutex.lockWait();
    partitionB.mutex.lockWait();
  } else {
    partitionB.mutex.lockWait();
    partitionA.mutex.lockWait();
  }
}

/**
 * @param {{larger:{type:number, index:number}, smaller:{type:number, index:number}, DeltaTime:number, index:number}} param0
 */
function collisionSim({ larger, smaller, DeltaTime, index }) {
  // Values both from 0-3; Bitshift larger to the left twice; Composes this: 0b0000LLSS
  const bitmask = (larger.type << 2) + smaller.type;
  switch (bitmask) {
    case 0: {
      // (0<<2 = 0) + 0 = 0
      const partitionA = PARTITIONS.player[larger.index];
      const partitionB = PARTITIONS.player[smaller.index];

      duoLock(larger.index, partitionA, smaller.index, partitionB);

      Player.setPartition(partitionA);
      Player2.setPartition(partitionB);

      const result = playerPlayer(Player, Player2, DeltaTime, index);

      partitionA.mutex.unlock();
      partitionB.mutex.unlock();

      return result;
    }
    case 1: {
      // (0<<2 = 0) + 1 = 1
      return playerVirus(DeltaTime);
    }
    case 2: {
      // (0<<2 = 0) + 2 = 2
      const partitionA = PARTITIONS.player[larger.index];
      const partitionB = PARTITIONS.food[smaller.index];

      duoLock(larger.index, partitionA, smaller.index + 4160, partitionB);

      Player.setPartition(partitionA);
      Food.setPartition(partitionB);

      const result = playerFood(Player, Food, DeltaTime, index);

      partitionA.mutex.unlock();
      partitionB.mutex.unlock();

      return result;
    }
    case 3: {
      // (0<<2 = 0) + 3 = 3
      return playerMass(DeltaTime);
    }
    case 7: {
      // (1<<2 = 4) + 3 = 7
      return virusMass(DeltaTime);
    }
  }
}

function getForce(percent, radius) {
  return -Math.max(0.025, radius ** percent - 1) * 0.2;
}

/**
 * @param {PlayerInterface} larger
 * @param {PlayerInterface} smaller
 * @param {number} DeltaTime
 * @param {number} index
 * @returns
 */
function playerPlayer(larger, smaller, DeltaTime, index) {
  // TODO: Add Eating & Merge Timer
  if (
    (larger.userIndex == smaller.userIndex &&
      larger.mass < smaller.mass * 1.1) ||
    larger.mergeTimer ||
    smaller.mergeTimer
  ) {
    // * User is the same And Cannot Merge
    const separation = getForce(
      larger.getOverlap(smaller) / smaller.mass,
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
    // * User is different or can Merge\
    const overlap = larger.getOverlap(smaller) / smaller.mass;
    if (overlap > 0.75) {
      return [index, 0, "eat_other", overlap];
    }
  }
}

function playerVirus(larger, smaller, DeltaTime, index) {}

/**
 * @param {PlayerInterface} larger
 * @param {FoodInterface} smaller
 * @param {number} DeltaTime
 * @param {number} index
 * @returns {undefined|[number, number, string]}
 */
function playerFood(larger, smaller, DeltaTime, index) {
  if (!larger.encloses(smaller)) return;
  larger.mass++;
  return [index, 1, "kill"];
}

function playerMass(larger, smaller, DeltaTime, index) {}

function virusMass(larger, smaller, DeltaTime, index) {}
