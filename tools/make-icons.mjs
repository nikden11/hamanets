// Генерує PNG-іконки застосунку без зовнішніх залежностей: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const TOP = hex('#2fbf80'), BOT = hex('#178a5a');
const SEGS = [ // кути в градусах від 12 години за годинниковою стрілкою
  [0, 140, hex('#ffffff')], [146, 236, hex('#ffd25a')], [242, 300, hex('#ff6b6b')], [306, 354, hex('#9fe7c6')],
];

function sample(u, v) { // u,v у [0,1]
  const bg = TOP.map((t, i) => t + (BOT[i] - t) * v);
  const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy);
  if (r < 0.205 || r > 0.335) return bg;
  let a = (Math.atan2(dx, -dy) * 180) / Math.PI; if (a < 0) a += 360;
  const seg = SEGS.find(([s, e]) => a >= s && a <= e);
  return seg ? seg[2] : bg;
}

for (const size of [180, 192, 512]) {
  const S = 4; // суперсемплінг для згладжування
  const buf = png(size, (x, y) => {
    const acc = [0, 0, 0];
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      const c = sample((x + (i + 0.5) / S) / size, (y + (j + 0.5) / S) / size);
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    return acc.map((v) => Math.round(v / (S * S)));
  });
  writeFileSync(new URL(`../icons/icon-${size}.png`, import.meta.url), buf);
}
console.log('icons ok');
