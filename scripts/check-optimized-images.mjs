import { readFile } from 'node:fs/promises';

const names = [
  ...Array.from({ length: 10 }, (_, i) => `ghost-${String(i + 1).padStart(2, '0')}`),
  'castle',
  'lighthouse',
  'library',
  'theatre',
  'cellar',
  'greenhouse',
  'clocktower',
  'manor',
  'observatory',
  'watermill',
];
let totalBytes = 0;
for (const name of names) {
  const original = await readFile(new URL(`../public/images/${name}.png`, import.meta.url));
  if (original.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || original[25] !== 6)
    throw new Error(`${name}: original RGBA PNG is missing or invalid`);
  const originalWidth = original.readUInt32BE(16);
  const originalHeight = original.readUInt32BE(20);
  for (const size of [96, 192, 480, 960]) {
    const bytes = await readFile(
      new URL(`../public/images/optimized/${name}-${size}.webp`, import.meta.url),
    );
    if (
      bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WEBP' ||
      bytes.readUInt32LE(4) + 8 !== bytes.length ||
      bytes.toString('ascii', 12, 16) !== 'VP8X'
    )
      throw new Error(`${name}-${size}: invalid extended WebP container`);
    const flags = bytes[20];
    const width = bytes.readUIntLE(24, 3) + 1;
    const height = bytes.readUIntLE(27, 3) + 1;
    const scale = Math.min(1, size / originalWidth, size / originalHeight);
    if (
      !(flags & 0x10) ||
      width !== Math.round(originalWidth * scale) ||
      height !== Math.round(originalHeight * scale)
    )
      throw new Error(`${name}-${size}: missing alpha or incorrect dimensions`);
    totalBytes += bytes.length;
  }
}
console.log(
  `Verified ${names.length * 4} WebP files: originals present, exact dimensions, alpha, ${totalBytes} bytes.`,
);
