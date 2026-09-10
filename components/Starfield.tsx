"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  s: number;
  tw: number;
}

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    let raf = 0;

    const resize = () => {
      const hero = canvas.parentElement;
      if (!hero) return;
      canvas.width = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
    };

    const init = () => {
      resize();
      stars = [];
      const n = Math.min(220, Math.floor(canvas.width / 6));
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.4 + 0.3,
          s: Math.random() * 0.4 + 0.05,
          tw: Math.random() * Math.PI * 2,
        });
      }
    };

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const st of stars) {
        st.y += st.s;
        st.tw += 0.02;
        if (st.y > canvas.height) {
          st.y = 0;
          st.x = Math.random() * canvas.width;
        }
        const a = 0.35 + Math.abs(Math.sin(st.tw)) * 0.65;
        ctx.globalAlpha = a;
        ctx.fillStyle = "#F5F7FA";
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    init();
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", init);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", init);
    };
  }, []);

  return <canvas id="starfield" ref={ref} />;
}
