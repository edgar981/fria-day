import { describe, it, expect } from "vitest";
import { WHEEL, BRAND_SEED, brandColorFor, inkFor, contrastRatio, snapToWheel, hourColor, resolveCardColor, rgbToHsl, dominantWheel } from "./colors";

const hexToRgb = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));

describe("rueda de doce (SC)", () => {
  it("son doce tonos y ninguno se repite", () => {
    expect(WHEEL).toHaveLength(12);
    expect(new Set(WHEEL.map((p) => p.hex)).size).toBe(12);
  });
  it("las doce parejas pasan 4,5:1", () => {
    for (const p of WHEEL) expect(contrastRatio(p.hex, p.ink)).toBeGreaterThanOrEqual(4.5);
  });
  it("solo un ámbar (nada compite con la marca #F2A016)", () => {
    const amberHue = rgbToHsl(hexToRgb("#F2A016"))[0];
    const near = WHEEL.filter((p) => { const h = rgbToHsl(hexToRgb(p.hex))[0]; const d = Math.abs(h - amberHue); return Math.min(d, 360 - d) < 18; });
    expect(near).toHaveLength(1);
  });
});

describe("nivel 1 · marcas", () => {
  it("las 22 (color, tinta) pasan 4,5:1", () => {
    for (const b of BRAND_SEED) expect(contrastRatio(b.hex, inkFor(b.hex))).toBeGreaterThanOrEqual(4.5);
  });
  it("la Costeñita es SU verde; Águila es el azul; la negra usa su dorado", () => {
    expect(brandColorFor("3 Cordilleras Costeñita")).toBe("#1E7A4B");
    expect(brandColorFor("Águila")).toBe("#3A6FD8");
    expect(brandColorFor("Club Colombia Negra")).toBe("#C8A04A");
  });
  it("una bebida fuera del mapa no tiene color de marca", () => {
    expect(brandColorFor("BBC Septimazo IPA")).toBeNull();
    expect(brandColorFor("Mojito")).toBeNull();
  });
});

describe("inkFor", () => {
  it("devuelve la tinta FIJADA de la rueda", () => {
    expect(inkFor("#3A6FD8")).toBe("#FBFCFF");
    expect(inkFor("#f2a016")).toBe("#3A1E00"); // case-insensitive
  });
  it("calcula por la regla un color desconocido, y pasa 4,5:1", () => {
    const ink = inkFor("#123456");
    expect(contrastRatio("#123456", ink)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("nivel 2 · snapToWheel", () => {
  it("un tono se ajusta al más cercano de la rueda", () => {
    expect(snapToWheel("#E04040")).toBe("#CE2F2F"); // rojo → rojo de la rueda
    expect(snapToWheel("#2E60C0")).toBe("#3A6FD8"); // azul → azul
  });
  it("casi gris → null (baja al nivel 3)", () => {
    expect(snapToWheel("#8A8A88")).toBeNull();
  });
  it("dominantWheel: foto mayormente roja → rojo de la rueda; gris → null", () => {
    const red = Array.from({ length: 200 }, () => [206, 47, 47] as const);
    expect(dominantWheel(red)).toBe("#CE2F2F");
    const gray = Array.from({ length: 200 }, () => [138, 138, 136] as const);
    expect(dominantWheel(gray)).toBeNull();
    // mezcla: mayoría azul con algo de ruido → azul
    const mix = [...Array.from({ length: 150 }, () => [58, 111, 216] as const), ...Array.from({ length: 30 }, () => [206, 47, 47] as const)];
    expect(dominantWheel(mix)).toBe("#3A6FD8");
  });
});

describe("nivel 3 · hora (Bogotá)", () => {
  const at = (bogotaHour: number) => new Date(Date.UTC(2026, 8, 12, (bogotaHour + 5) % 24, 30));
  it("las 5 franjas cubren las 24h", () => {
    expect(hourColor(at(19)).hex).toBe("#F2A016"); // 7pm · día
    expect(hourColor(at(9)).hex).toBe("#F2A016"); // 9am · día
    expect(hourColor(at(21)).hex).toBe("#FF6B35"); // 9pm
    expect(hourColor(at(23)).hex).toBe("#3E8F6B"); // 11pm
    expect(hourColor(at(1)).hex).toBe("#3A6FD8"); // 1am
    expect(hourColor(at(4)).hex).toBe("#7A4DD6"); // 4am
  });
});

describe("la cascada resuelve los tres niveles + respaldo", () => {
  const t = new Date(Date.UTC(2026, 8, 12, 4, 0)); // 11 p.m. Bogotá
  it("nivel 1 gana: color de marca", () => {
    expect(resolveCardColor({ brandColor: "#1E7A4B", photoColor: "#CE2F2F", lastCheckInAt: t, hasRealWindow: true, outingNumber: 3 }).hex).toBe("#1E7A4B");
  });
  it("sin marca → nivel 2: la foto", () => {
    expect(resolveCardColor({ brandColor: null, photoColor: "#CE2F2F", lastCheckInAt: t, hasRealWindow: true, outingNumber: 3 }).hex).toBe("#CE2F2F");
  });
  it("sin marca ni foto → nivel 3: la hora del último check-in", () => {
    expect(resolveCardColor({ brandColor: null, photoColor: null, lastCheckInAt: t, hasRealWindow: true, outingNumber: 3 }).hex).toBe("#3E8F6B");
  });
  it("sin ventana real → respaldo #N mod 5", () => {
    expect(resolveCardColor({ brandColor: null, photoColor: null, lastCheckInAt: t, hasRealWindow: false, outingNumber: 7 }).hex).toBe(WHEEL[7 % 5].hex);
  });
  it("la tinta viene emparejada con el color", () => {
    const r = resolveCardColor({ brandColor: "#3A6FD8", outingNumber: 1 });
    expect(r.ink).toBe("#FBFCFF");
  });
});
