const SHARED_MEMORY_PARTITIONS = {
  player: { count: 4096, size: 36 },
  virus: { count: 64, size: 32 },
  food: { count: 2560, size: 24 },
  mass: { count: 512, size: 32 },
  user: { count: 256, size: 32 },
};

const WORLD_SETTINGS = {
  drag: 0.85,
};

module.exports = {
  SHARED_MEMORY_PARTITIONS,
  WORLD_SETTINGS,
};
