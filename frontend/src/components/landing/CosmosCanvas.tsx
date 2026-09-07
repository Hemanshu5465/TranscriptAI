import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

/**
 * The warm-cosmos hero backdrop: a slowly-turning spiral "galaxy" of glowing
 * points with a morphing particle orb floating in the upper centre. The orb
 * leans, ripples and scatters toward the pointer and eases back to a calm
 * breathing rotation when the cursor is still or away.
 *
 * Pure 2D canvas (3D points projected by hand) — no WebGL dependency. It's a
 * `pointer-events-none` background layer, so it never intercepts a click; the
 * RAF loop and listeners are torn down on unmount. If anything throws it simply
 * renders nothing over the section's dark background.
 */

type P = {
  ox: number;
  oy: number;
  oz: number;
  c: 0 | 1 | 2; // sprite index: cream / amber / teal
  s: number;
};

const TINTS = ["rgba(245,236,223,", "rgba(242,150,100,", "rgba(120,178,190,"] as const;

function makeSprite(rgbaPrefix: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, rgbaPrefix + "1)");
  g.addColorStop(0.35, rgbaPrefix + "0.55)");
  g.addColorStop(1, rgbaPrefix + "0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return c;
}

export function CosmosCanvas() {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    let cleanup = () => {};

    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const sprites = TINTS.map((t) => makeSprite(t));
      const small = window.matchMedia("(max-width: 768px)").matches;
      const GALAXY_N = small ? 2400 : 6200;
      const ORB_N = small ? 1300 : 3000;
      const ARMS = 3;

      const pickTint = (): 0 | 1 | 2 => {
        const r = Math.random();
        return r < 0.56 ? 0 : r < 0.85 ? 1 : 2;
      };

      // ---- galaxy: logarithmic spiral arms + a few bright field stars ----
      const galaxy: P[] = [];
      for (let i = 0; i < GALAXY_N; i++) {
        const t = Math.pow(Math.random(), 0.55);
        const arm = (i % ARMS) * ((Math.PI * 2) / ARMS);
        // tighter to the arm centre near the core, looser at the rim
        const jitter = Math.pow(Math.random(), 1.7) * (Math.random() < 0.5 ? 1 : -1);
        const spread = (1 - t) * 0.16 + 0.05;
        const a = arm + t * 6.6 + jitter * (0.5 + t * 0.9);
        const rad = t * 2.0 + 0.06;
        galaxy.push({
          ox: Math.cos(a) * rad + (Math.random() - 0.5) * spread,
          oy: (Math.random() - 0.5) * (0.1 * (1 - t) + 0.015),
          oz: Math.sin(a) * rad + (Math.random() - 0.5) * spread,
          c: t < 0.18 && Math.random() < 0.6 ? 1 : pickTint(),
          s: Math.random() * 0.9 + 0.28 + (t < 0.15 ? 0.4 : 0),
        });
      }
      for (let i = 0; i < (small ? 90 : 220); i++) {
        galaxy.push({
          ox: (Math.random() - 0.5) * 5,
          oy: (Math.random() - 0.5) * 3,
          oz: (Math.random() - 0.5) * 5,
          c: Math.random() < 0.5 ? 0 : 1,
          s: Math.random() * 1.5 + 0.6,
        });
      }

      // ---- orb: fibonacci sphere ----
      const orb: P[] = [];
      for (let i = 0; i < ORB_N; i++) {
        const k = i + 0.5;
        const phi = Math.acos(1 - (2 * k) / ORB_N);
        const theta = Math.PI * (1 + Math.sqrt(5)) * k;
        orb.push({
          ox: Math.sin(phi) * Math.cos(theta),
          oy: Math.sin(phi) * Math.sin(theta),
          oz: Math.cos(phi),
          c: Math.random() < 0.72 ? 1 : 0,
          s: Math.random() * 0.7 + 0.4,
        });
      }

      let W = 0;
      let H = 0;
      let DPR = 1;
      const resize = () => {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth || canvas.offsetWidth;
        H = canvas.clientHeight || canvas.offsetHeight;
        canvas.width = Math.max(1, Math.round(W * DPR));
        canvas.height = Math.max(1, Math.round(H * DPR));
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      const mouse = { x: 0.5, y: 0.42, tx: 0.5, ty: 0.42, active: 0, last: 0 };
      const onMove = (e: MouseEvent) => {
        const r = canvas.getBoundingClientRect();
        mouse.tx = (e.clientX - r.left) / Math.max(1, r.width);
        mouse.ty = (e.clientY - r.top) / Math.max(1, r.height);
        mouse.last = performance.now();
      };
      window.addEventListener("mousemove", onMove, { passive: true });

      const ORB_CX = 0.5;
      const ORB_CY = 0.27;
      const BASE_TILT = 1.02; // ~58°: view the galaxy disc at an angle, not edge-on
      let gRot = 0;
      let prev = performance.now();

      const frame = (now: number) => {
        const dt = Math.min(34, now - prev);
        prev = now;
        gRot += dt * 0.00004;

        mouse.x += (mouse.tx - mouse.x) * 0.06;
        mouse.y += (mouse.ty - mouse.y) * 0.06;
        const idle = now - mouse.last > 650;
        mouse.active += ((idle ? 0 : 1) - mouse.active) * 0.05;

        const pdx = (mouse.x - ORB_CX) * 2;
        const pdy = (mouse.y - ORB_CY) * 2;
        const near = Math.max(0, 1 - Math.hypot(pdx, pdy) / 1.15);
        const warp = near * mouse.active;

        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter";

        // ---- galaxy (centred on the orb, so the orb reads as the core) ----
        const cx = W * 0.5;
        const cy = H * ORB_CY;
        const scaleG = Math.max(W, H) * 0.5;
        const cR = Math.cos(gRot);
        const sR = Math.sin(gRot);
        const tX = BASE_TILT + (mouse.y - 0.5) * 0.18;
        const tY = (mouse.x - 0.5) * 0.3;
        const ctX = Math.cos(tX);
        const stX = Math.sin(tX);
        const ctY = Math.cos(tY);
        const stY = Math.sin(tY);

        for (let i = 0; i < galaxy.length; i++) {
          const p = galaxy[i];
          let x = p.ox * cR - p.oz * sR;
          let z = p.ox * sR + p.oz * cR;
          let y = p.oy;
          const y1 = y * ctX - z * stX;
          z = y * stX + z * ctX;
          y = y1;
          const x1 = x * ctY - z * stY;
          z = x * stY + z * ctY;
          x = x1;

          const persp = 3.2 / (3.2 + z);
          if (persp <= 0) continue;
          const sx = cx + x * scaleG * persp;
          const sy = cy + y * scaleG * persp;
          if (sx < -24 || sx > W + 24 || sy < -24 || sy > H + 24) continue;
          const size = p.s * persp * 1.5 + 0.3;
          ctx.globalAlpha = Math.min(0.8, persp * 0.44);
          ctx.drawImage(sprites[p.c], sx - size, sy - size, size * 2, size * 2);
        }

        // ---- orb ----
        const ocx = W * ORB_CX;
        const ocy = H * ORB_CY;
        const oR = Math.min(W, H) * (0.155 + 0.012 * Math.sin(now * 0.0012));
        const rY = now * 0.00018 + (mouse.x - 0.5) * 0.5 * mouse.active;
        const rX = (mouse.y - 0.5) * 0.4 * mouse.active + Math.sin(now * 0.0003) * 0.14;
        const cY2 = Math.cos(rY);
        const sY2 = Math.sin(rY);
        const cX2 = Math.cos(rX);
        const sX2 = Math.sin(rX);

        for (let i = 0; i < orb.length; i++) {
          const p = orb[i];
          let x = p.ox;
          let y = p.oy;
          let z = p.oz;
          const y1 = y * cX2 - z * sX2;
          let z1 = y * sX2 + z * cX2;
          y = y1;
          const x1 = x * cY2 - z1 * sY2;
          z = x * sY2 + z1 * cY2;
          x = x1;

          const wob =
            1 +
            Math.sin(p.ox * 3 + now * 0.001) * 0.04 +
            warp * 0.2 * Math.sin(p.ox * 4 + p.oy * 4 + now * 0.004);
          x *= wob;
          y *= wob;
          z *= wob;
          x += pdx * warp * 0.3;
          y += pdy * warp * 0.3;

          const persp = 2.4 / (2.4 + z);
          if (persp <= 0) continue;
          const sx = ocx + x * oR * persp;
          const sy = ocy + y * oR * persp;
          const size = Math.max(0.5, p.s * persp * 1.7);
          ctx.globalAlpha = Math.max(0, persp - 0.35) * 0.9;
          ctx.drawImage(sprites[p.c], sx - size, sy - size, size * 2, size * 2);
        }

        // orb core bloom
        ctx.globalAlpha = 1;
        const bloom = ctx.createRadialGradient(ocx, ocy, 0, ocx, ocy, oR * 1.7);
        bloom.addColorStop(0, "rgba(245,178,120,0.22)");
        bloom.addColorStop(1, "rgba(245,178,120,0)");
        ctx.fillStyle = bloom;
        ctx.fillRect(ocx - oR * 2, ocy - oR * 2, oR * 4, oR * 4);

        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("mousemove", onMove);
      };
    } catch {
      /* canvas unsupported / context lost — the dark section bg stands in */
    }

    return () => cleanup();
  }, [reduced]);

  if (reduced) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 30%, rgba(245,150,90,0.16), transparent 60%), radial-gradient(60% 50% at 50% 40%, rgba(245,180,120,0.14), transparent 70%)",
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
