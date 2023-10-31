const SHARED_MEMORY_PARTITIONS = {
  player: { count: 4096, size: 36 },
  virus: { count: 40, size: 32 },
  food: { count: 2560, size: 24 },
  mass: { count: 512, size: 32 },
  user: { count: 256, size: 32 },
};

module.exports = {
  SHARED_MEMORY_PARTITIONS,
};
