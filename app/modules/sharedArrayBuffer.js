/*
Bytes per player: 35 + 1 blank space
Bytes per Virus: 32
Bytes per Food: 24
Bytes per Mass: 32
| Total Max Player Count: 4096 => 147456 Bytes
|| Max User Count: 256
||| Max Player per User Count: 16
| Total Virus Count: 64 => 2048 Bytes
| Total Food Count: 1024 => 24576 Bytes
| Max Mass Allowance: 512 => 16384 Bytes
Total Byte Size: 186368
*/
const SHARED_MEMORY_PARTITIONS = {
  player: { count: 4096, size: 36 },
  virus: { count: 64, size: 32 },
  food: { count: 1024, size: 24 },
  mass: { count: 512, size: 32 },
  user: { count: 256, size: 32 },
};

module.exports = {
  SHARED_MEMORY_PARTITIONS,
};
