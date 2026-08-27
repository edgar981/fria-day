// Genera los iconos PWA (PNG) sin dependencias nativas: dibuja píxeles y los
// codifica con zlib. Diseño: fondo ámbar full-bleed (maskable) + jarra de
// cerveza con espuma. Uso: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// ---- CRC32 (tabla) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // scanlines con filtro 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- helpers de color ----
const AMBER = [217, 119, 6];
const AMBER_DEEP = [180, 83, 9];
const FOAM = [254, 243, 199];
const BEER = [245, 176, 24];
const WHITE = [255, 255, 255];

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const S = size;
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    // alpha over
    const ia = a / 255;
    buf[i] = Math.round(r * ia + buf[i] * (1 - ia));
    buf[i + 1] = Math.round(g * ia + buf[i + 1] * (1 - ia));
    buf[i + 2] = Math.round(b * ia + buf[i + 2] * (1 - ia));
    buf[i + 3] = 255;
  };

  // Fondo: degradado diagonal ámbar (full-bleed → maskable)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const t = (x + y) / (2 * S);
      const c = [
        Math.round(AMBER[0] * (1 - t) + AMBER_DEEP[0] * t),
        Math.round(AMBER[1] * (1 - t) + AMBER_DEEP[1] * t),
        Math.round(AMBER[2] * (1 - t) + AMBER_DEEP[2] * t),
      ];
      const i = (y * S + x) * 4;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
    }
  }

  // Geometría de la jarra (coordenadas normalizadas a S)
  const u = (v) => Math.round(v * S);
  const bodyL = u(0.30), bodyR = u(0.66);
  const bodyT = u(0.30), bodyB = u(0.76);
  const foamT = u(0.20);
  const radius = u(0.05);

  const inRoundRect = (x, y, l, r, t, b, rad) => {
    if (x < l || x > r || y < t || y > b) return false;
    // esquinas redondeadas
    const cx = x < l + rad ? l + rad : x > r - rad ? r - rad : x;
    const cy = y < t + rad ? t + rad : y > b - rad ? b - rad : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad || (x >= l + rad && x <= r - rad) || (y >= t + rad && y <= b - rad);
  };

  // Asa (anillo a la derecha)
  const handleCx = u(0.74), handleCy = u(0.53);
  const rOut = u(0.13), rIn = u(0.075);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d2 = (x - handleCx) ** 2 + (y - handleCy) ** 2;
      if (d2 <= rOut * rOut && d2 >= rIn * rIn && x >= bodyR - u(0.02)) set(x, y, FOAM);
    }
  }

  // Cuerpo (cerveza) + borde espuma
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (inRoundRect(x, y, bodyL, bodyR, bodyT, bodyB, radius)) {
        const edge =
          x < bodyL + u(0.02) || x > bodyR - u(0.02) || y > bodyB - u(0.02);
        set(x, y, edge ? FOAM : BEER);
      }
    }
  }

  // Espuma arriba (tres lóbulos + banda)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (x >= bodyL - u(0.02) && x <= bodyR + u(0.02) && y >= foamT && y <= bodyT + u(0.02)) {
        set(x, y, FOAM);
      }
    }
  }
  const lobe = (cx, cy, r) => {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, x % 2 === 0 && y < cy ? WHITE : FOAM);
  };
  lobe(u(0.36), foamT, u(0.055));
  lobe(u(0.48), u(0.17), u(0.065));
  lobe(u(0.60), foamT, u(0.055));

  // Brillo vertical en la cerveza
  for (let y = bodyT + u(0.03); y < bodyB - u(0.03); y++) {
    set(u(0.36), y, WHITE, 90);
    set(u(0.365), y, WHITE, 60);
  }

  return encodePNG(S, S, buf);
}

for (const size of [192, 512, 180, 32]) {
  const png = draw(size);
  const name = size === 180 ? "apple-touch-icon.png" : size === 32 ? "favicon-32.png" : `icon-${size}.png`;
  writeFileSync(join(OUT, name), png);
  console.log("wrote", name, png.length, "bytes");
}
