import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
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
for (const name of names) {
  const bytes = readFileSync(new URL(`../public/images/${name}.png`, import.meta.url));
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
    throw new Error(`${name}: not PNG`);
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (width < 512 || height < 512 || bytes[24] !== 8 || bytes[25] !== 6 || bytes[28] !== 0)
    throw new Error(`${name}: expected large non-interlaced RGBA PNG`);
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(bytes.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  // The first pixel has no left or previous pixel for any PNG filter mode.
  if (inflateSync(Buffer.concat(chunks))[4] !== 0)
    throw new Error(`${name}: top-left pixel must be transparent`);
  console.log(`${name}: ${width}×${height}, RGBA, transparent corner`);
}
