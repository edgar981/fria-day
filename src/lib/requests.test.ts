import { describe, it, expect } from "vitest";
import { rejectionOnCooldown, relationState, REQUEST_COOLDOWN_MS } from "./requests";

const now = new Date("2026-09-13T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

describe("rejectionOnCooldown (Pasada PA · §2)", () => {
  it("null respondedAt no está en enfriamiento", () => {
    expect(rejectionOnCooldown(null, now)).toBe(false);
  });
  it("un rechazo de hace 14 días sigue en enfriamiento", () => {
    expect(rejectionOnCooldown(daysAgo(14), now)).toBe(true);
  });
  it("un rechazo de hace 16 días ya no", () => {
    expect(rejectionOnCooldown(daysAgo(16), now)).toBe(false);
  });
  it("el corte es exactamente 15 días", () => {
    expect(rejectionOnCooldown(new Date(now.getTime() - REQUEST_COOLDOWN_MS + 1000), now)).toBe(true);
    expect(rejectionOnCooldown(new Date(now.getTime() - REQUEST_COOLDOWN_MS - 1000), now)).toBe(false);
  });
});

describe("relationState (Pasada PA)", () => {
  const base = { isSelf: false, inCircle: false, request: null, now };

  it("uno mismo", () => {
    expect(relationState({ ...base, isSelf: true })).toBe("self");
  });
  it("en el círculo → sin acción (cualquier vía)", () => {
    expect(relationState({ ...base, inCircle: true })).toBe("circle");
    // en el círculo gana aunque haya una solicitud vieja
    expect(relationState({ ...base, inCircle: true, request: { status: "pending", respondedAt: null } })).toBe("circle");
  });
  it("sin solicitud → se puede agregar", () => {
    expect(relationState(base)).toBe("addable");
  });
  it("solicitud pendiente → enviada", () => {
    expect(relationState({ ...base, request: { status: "pending", respondedAt: null } })).toBe("sent");
  });
  it("rechazo reciente → sigue viendo enviada (silencioso)", () => {
    expect(relationState({ ...base, request: { status: "rejected", respondedAt: daysAgo(3) } })).toBe("sent");
  });
  it("rechazo pasados 15 días → vuelve a poder agregar", () => {
    expect(relationState({ ...base, request: { status: "rejected", respondedAt: daysAgo(20) } })).toBe("addable");
  });
});
