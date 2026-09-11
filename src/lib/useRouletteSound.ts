"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "fd-ruleta-sound";

/**
 * Sonido de la ruleta (RU.2 · §2) — Web Audio API SINTETIZADO, sin archivos ni peso:
 * un "tick" corto por casilla durante el giro y un "golpe" grave en el veredicto. Es lo
 * único que le queda al giro en iPhone (no hay háptico en iOS web).
 *
 * Default ENCENDIDO (decisión de Edgar): sin esto nadie descubre el sonido, y la red de
 * seguridad es el switch de silencio de iOS — con el teléfono en silencio, Web Audio queda
 * mudo solo (a verificar en iPhone). El AudioContext se DESBLOQUEA con un gesto (el hold),
 * requisito de iOS. La preferencia se recuerda en localStorage.
 */
export function useRouletteSound() {
  const [on, setOn] = useState(true);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "off") setOn(false);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "on" : "off"); } catch {}
      return next;
    });
  }, []);

  // Debe llamarse DENTRO de un gesto (pointerdown del hold) para que iOS permita audio.
  const unlock = useCallback(() => {
    try {
      if (!ctxRef.current) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) ctxRef.current = new AC();
      }
      if (ctxRef.current?.state === "suspended") ctxRef.current.resume().catch(() => {});
    } catch {}
  }, []);

  const tick = useCallback(() => {
    const ctx = ctxRef.current;
    if (!on || !ctx || ctx.state !== "running") return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = 1150;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.045);
    } catch {}
  }, [on]);

  const thud = useCallback(() => {
    const ctx = ctxRef.current;
    if (!on || !ctx || ctx.state !== "running") return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(210, t);
      osc.frequency.exponentialRampToValueAtTime(66, t + 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.34, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    } catch {}
  }, [on]);

  useEffect(() => () => { ctxRef.current?.close().catch(() => {}); }, []);

  return { on, toggle, unlock, tick, thud };
}
