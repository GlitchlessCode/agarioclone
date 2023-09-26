/**
 * Generates a SHA-256 hash of a string.
 *
 * @param {string} message string to be hashed
 * @returns {string} Hash of message as a hex character string
 */
function hash(msg) {
  // Convert to UTF-8, SHA only deals with byte streams (so every character should be 1 byte max)
  msg = utf8Encode(msg);

  // Setting constant values determined by NIST
  // They are the first 32 birs of the fractional parts of the CUBE roots of the first 64 prime numbers
  // prettier-ignore
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  // Setting the inital hash value determined by NIST
  // These are the first 32 bits of the fractional parts of the SQUARE roots of the first 8 prime numbers
  // prettier-ignore
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  // PREPROCESSING

  // Adds a 1 and appropriate padding 0s to the end
  msg += String.fromCharCode(0x80);

  // Convert the message into 512-bit blocks, in the form of an Array composed of indices each containing 16 32-bit blocks
  // Get the overall length of the message (when divided into 32-bit integers), plus additional space for some reason?
  // Fairly certain one of these extra integers is used to store the overall length value of the message
  const length = msg.length / 4 + 2;
  // Get the number of 512-bit blocks are necessary to hold the total length of the message
  const blockNum = Math.ceil(length / 16);
  // This is the array to hold all the blocks. It holds 16*blockNum of 32-bit integers
  const messageArr = new Array(blockNum);

  // 2 dimensional for loop, nesting arrays
  /*
  This encodes 4 characters to a single integer (In big-endian encoding)
  If you were to represent each character as a, b, c and d respectively, in binary, it would be like this:
  aaaaaaaabbbbbbbbccccccccdddddddd
  With each character taking up 8 bits in the integer

  To construct it:
  i * 64 * j * 4 + x is just used to find the ascii character at the correct index
  << 24/16/8/0 is used to shift each set over. After this step, you have:
  aaaaaaaa000000000000000000000000
  00000000bbbbbbbb0000000000000000
  0000000000000000cccccccc00000000
  000000000000000000000000dddddddd
  The pipe operator ( | ) is then used as the bitwise OR operator to combine them together, resulting in
  aaaaaaaabbbbbbbbccccccccdddddddd
  */
  for (let i = 0; i < blockNum; i++) {
    // Each nested array contains 16 32-bit integers
    messageArr[i] = new Array(16);
    for (let j = 0; j < 16; j++) {
      messageArr[i][j] =
        (msg.charCodeAt(i * 64 + j * 4 + 0) << 24) |
        (msg.charCodeAt(i * 64 + j * 4 + 1) << 16) |
        (msg.charCodeAt(i * 64 + j * 4 + 2) << 8) |
        (msg.charCodeAt(i * 64 + j * 4 + 3) << 0);
    } // Running out of message is perfectly OK, because when using the bitwise OR ( | ) NaN just results in 0, not another NaN
  }
  // Don't understand the exact purpose of these two length values, but they definitely do something.
  // What I do know is that these two ints are always stored to the last two integers of the last block
  const lengthHigh = ((msg.length - 1) * 8) / Math.pow(2, 32);
  const lengthLow = ((msg.length - 1) * 8) >>> 0;
  messageArr[blockNum - 1][14] = Math.floor(lengthHigh);
  messageArr[blockNum - 1][15] = lengthLow;

  // HASH COMPUTATION
  // This is where things get really wacky
  // For the most part, as far as I know, this is kinda just messing with the input a whole bunch until you get your hash
  // ¯\_(ツ)_/¯

  // For loop that loops over every block
  // I've left most of this unchanged, just because I don't want to mess anything up
  // Also, remember, H starts as the inital hash, and K are your constants
  // Additionally, anywhere you spot the use of >>> 0, know that that's being used to coerce the number to a 32 bit integer
  for (let i = 0; i < blockNum; i++) {
    const W = new Array(64);

    // 1 - prepare message schedule 'W'
    for (let t = 0; t < 16; t++) W[t] = messageArr[i][t];
    for (let t = 16; t < 64; t++) {
      W[t] =
        (sigma1(W[t - 2]) + W[t - 7] + sigma0(W[t - 15]) + W[t - 16]) >>> 0;
    }

    // 2 - initialise working variables a, b, c, d, e, f, g, h with previous hash value
    let a = H[0],
      b = H[1],
      c = H[2],
      d = H[3],
      e = H[4],
      f = H[5],
      g = H[6],
      h = H[7];

    // 3 - main loop (note '>>> 0' for 'addition modulo 2^32')
    for (let t = 0; t < 64; t++) {
      const T1 = h + SIGMA1(e) + Choice(e, f, g) + K[t] + W[t];
      const T2 = SIGMA0(a) + Majority(a, b, c);
      h = g;
      g = f;
      f = e;
      e = (d + T1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) >>> 0;
    }

    // 4 - compute the new intermediate hash value (note '>>> 0' for 'addition modulo 2^32')
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  // At this point, most of the hashing is done, as everything has been messed around. A whole lot.
  // Now we just need to convert H to a hexadecimal string, with leading 0s
  for (let h = 0; h < H.length; h++)
    H[h] = ("00000000" + H[h].toString(16)).slice(-8);

  return H.join("");
}

// HASHING HELPERS

/**
 * Encodes a string to UTF-8
 *
 * @param {string} str String to encode
 * @returns string Encoded string
 */
function utf8Encode(str) {
  let encoder = new TextEncoder();
  let encodedArray = encoder.encode(str);
  return String.fromCharCode(...encodedArray);
}

/**
 * Rotates value bitwise to the right num number of times
 * @param {number} value value to be rotated
 * @param {number} num number of bits to shift by
 * @returns {number} value rotated to the right bitwise by num
 */
function rotRight(value, num) {
  // (value >>> num): shifts value with an unsigned bitshift by num bits
  // |: Bitwise OR, returns a 1 bit at a position where either original bit is 1
  // (value << (32-num)): shift value with a left bitshift by (32-num) bits
  return (value >>> num) | (value << (32 - num));
}

/* 
Comes from https://www.movable-type.co.uk/scripts/sha256.html
Credit where credit is due, I only have a very vague idea as to what is happening here. I can tell these functions are kinda just for messing with the input values. As for why these specific values? Because NIST says so, apparently.
*/
function SIGMA0(x) {
  return rotRight(x, 2) ^ rotRight(x, 13) ^ rotRight(x, 22);
}
function SIGMA1(x) {
  return rotRight(x, 6) ^ rotRight(x, 11) ^ rotRight(x, 25);
}
function sigma0(x) {
  return rotRight(x, 7) ^ rotRight(x, 18) ^ (x >>> 3);
}
function sigma1(x) {
  return rotRight(x, 17) ^ rotRight(x, 19) ^ (x >>> 10);
}
// Each bit is either from y or z, depending on if that x bit is 1 or 0
function Choice(x, y, z) {
  return (x & y) ^ (~x & z);
}
// Each bit is set to the majority of the three
function Majority(x, y, z) {
  return (x & y) ^ (x & z) ^ (y & z);
}

export { hash };
