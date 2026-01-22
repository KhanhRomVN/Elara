import { randomBytes } from 'crypto';

// Manual UUIDv7 generator (time-based UUID)
export const uuidv7 = (): string => {
  const timestamp = Date.now();
  const bytes = randomBytes(16);

  // Set timestamp (48 bits = 6 bytes)
  // JS bitwise operators truncate to 32 bits, so we use math instead
  bytes[0] = Math.floor(timestamp / 0x10000000000) & 0xff;
  bytes[1] = Math.floor(timestamp / 0x100000000) & 0xff;
  bytes[2] = Math.floor(timestamp / 0x1000000) & 0xff;
  bytes[3] = Math.floor(timestamp / 0x10000) & 0xff;
  bytes[4] = Math.floor(timestamp / 0x100) & 0xff;
  bytes[5] = timestamp & 0xff;

  // Set version 7 (4 bits)
  bytes[6] = (bytes[6] & 0x0f) | 0x70;

  // Set variant (2 bits)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [
    bytes.subarray(0, 4).toString('hex'),
    bytes.subarray(4, 6).toString('hex'),
    bytes.subarray(6, 8).toString('hex'),
    bytes.subarray(8, 10).toString('hex'),
    bytes.subarray(10, 16).toString('hex'),
  ].join('-');
};
