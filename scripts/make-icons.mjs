import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, pixel) {
  const row = size * 4 + 1;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size);
      const i = y * row + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function colourAt(u, v) {
  const x = u - 0.5, y = v - 0.5;
  if (Math.hypot(x, y) < 0.14) return [255, 200, 40];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    if (Math.hypot(x - Math.cos(a) * 0.25, y - Math.sin(a) * 0.25) < 0.12) return [255, 245, 235];
  }
  return [255 - Math.round(v * 40), 110 + Math.round(v * 30), 70 + Math.round(v * 50)];
}
function sampler(size) {
  return (u, v) => {
    const n = 3;
    let R = 0, G = 0, B = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const c = colourAt(u + (i + 0.5) / (n * size), v + (j + 0.5) / (n * size));
        R += c[0]; G += c[1]; B += c[2];
      }
    }
    return [Math.round(R / 9), Math.round(G / 9), Math.round(B / 9)];
  };
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', png(192, sampler(192)));
writeFileSync('public/icon-512.png', png(512, sampler(512)));
console.log('Icons created in the public folder');