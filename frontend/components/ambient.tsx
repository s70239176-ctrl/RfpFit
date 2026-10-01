"use client";

import { useEffect, useRef } from "react";

interface Orb {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  hue: string;
}

/**
 * Ambient light behind the hero: three soft orbs and sparse drifting points on a 2D canvas.
 * Decorative only. Pauses when off-screen or the tab is hidden, and draws one still frame
 * when the user prefers reduced motion.
 */
export function Ambient() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;

    const orbs: Orb[] = [
      { x: 0.2, y: 0.1, r: 0.55, vx: 0.00006, vy: 0.00004, hue: "255,90,31" },
      { x: 0.85, y: 0.3, r: 0.45, vx: -0.00005, vy: 0.00005, hue: "255,107,0" },
      { x: 0.55, y: 0.95, r: 0.5, vx: 0.00004, vy: -0.00004, hue: "255,90,31" },
    ];
    const dots = Array.from({ length: 36 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: 0.4 + Math.random() * 1.2,
      v: 0.00002 + Math.random() * 0.00004,
    }));

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(dt: number) {
      ctx!.clearRect(0, 0, w, h);
      for (const o of orbs) {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (o.x < 0 || o.x > 1) o.vx *= -1;
        if (o.y < 0 || o.y > 1) o.vy *= -1;
        const radius = o.r * Math.max(w, h);
        const g = ctx!.createRadialGradient(o.x * w, o.y * h, 0, o.x * w, o.y * h, radius);
        g.addColorStop(0, `rgba(${o.hue},0.16)`);
        g.addColorStop(1, `rgba(${o.hue},0)`);
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, w, h);
      }
      ctx!.fillStyle = "rgba(255,255,255,0.35)";
      for (const d of dots) {
        d.y -= d.v * dt;
        if (d.y < 0) d.y = 1;
        ctx!.beginPath();
        ctx!.arc(d.x * w, d.y * h, d.s, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    let last = performance.now();
    function loop(now: number) {
      const dt = Math.min(now - last, 64);
      last = now;
      if (visible && !document.hidden) frame(dt);
      raf = requestAnimationFrame(loop);
    }

    resize();
    frame(0);
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) frame(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
