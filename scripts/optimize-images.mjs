import { readdir, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Use a local sharp install, or point SHARP_MODULE_PATH to a supplied runtime module.
// This is a maintenance command; normal installs/builds use the committed derivatives.
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE_PATH || 'sharp');
const source = new URL('../public/images/', import.meta.url);
const output = new URL('optimized/', source);
await mkdir(output, { recursive: true });
const names = (await readdir(source)).filter((name) => name.endsWith('.png')).sort();
let originalBytes = 0;
let optimizedBytes = 0;
for (const name of names) {
  const input = new URL(name, source);
  originalBytes += (await stat(input)).size;
  for (const size of [96, 192, 480, 960]) {
    const destination = new URL(`${name.slice(0, -4)}-${size}.webp`, output);
    await sharp(fileURLToPath(input))
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 95, effort: 5 })
      .toFile(fileURLToPath(destination));
    const metadata = await sharp(fileURLToPath(destination)).metadata();
    if (!metadata.hasAlpha || metadata.width > size || metadata.height > size)
      throw new Error(`${name}: invalid ${size}px derivative`);
    optimizedBytes += (await stat(destination)).size;
  }
}
console.log(
  `${names.length} originals retained (${originalBytes} bytes); ${names.length * 4} WebP derivatives (${optimizedBytes} bytes), alpha verified.`,
);
