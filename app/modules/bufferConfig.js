const SHARED_MEMORY_PARTITIONS = {
  player: { count: 4096, size: 36 },
  virus: { count: 32, size: 32 },
  food: { count: 2048, size: 24 },
  mass: { count: 512, size: 32 },
  user: { count: 2, size: 32 },
};

module.exports = {
  SHARED_MEMORY_PARTITIONS,
};
