import type { SceneNode } from '../types';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

export const rad = (deg: number) => (deg * Math.PI) / 180;
export const rotate = (p: Pt, deg: number): Pt => {
  const r = rad(deg), c = Math.cos(r), s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

export const center = (n: Rect): Pt => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

/** Caixa delimitadora alinhada aos eixos de um retângulo possivelmente girado. */
export function aabb(n: Pick<SceneNode, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Rect {
  if (!n.rotation) return { x: n.x, y: n.y, w: n.w, h: n.h };
  const c = center(n);
  const pts = [
    { x: -n.w / 2, y: -n.h / 2 }, { x: n.w / 2, y: -n.h / 2 },
    { x: n.w / 2, y: n.h / 2 }, { x: -n.w / 2, y: n.h / 2 },
  ].map((p) => { const r = rotate(p, n.rotation); return { x: c.x + r.x, y: c.y + r.y }; });
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function unionRect(rs: Rect[]): Rect | null {
  if (!rs.length) return null;
  const x1 = Math.min(...rs.map((r) => r.x)), y1 = Math.min(...rs.map((r) => r.y));
  const x2 = Math.max(...rs.map((r) => r.x + r.w)), y2 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export const rectsIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Direção do puxador: -1 (esquerda/topo), 0 (meio), 1 (direita/base). */
export interface Handle { hx: -1 | 0 | 1; hy: -1 | 0 | 1 }
export const HANDLES: Handle[] = [
  { hx: -1, hy: -1 }, { hx: 0, hy: -1 }, { hx: 1, hy: -1 },
  { hx: -1, hy: 0 }, { hx: 1, hy: 0 },
  { hx: -1, hy: 1 }, { hx: 0, hy: 1 }, { hx: 1, hy: 1 },
];

/**
 * Redimensiona um retângulo (possivelmente girado) arrastando um puxador.
 * (dx, dy) é o deslocamento do ponteiro no mundo. O ponto oposto ao puxador permanece fixo.
 */
export function resizeRect(
  start: Pick<SceneNode, 'x' | 'y' | 'w' | 'h' | 'rotation'>,
  handle: Handle,
  dx: number,
  dy: number,
  opts: { keepAspect?: boolean; fromCenter?: boolean; min?: number } = {},
): Rect {
  const min = opts.min ?? 4;
  const d = rotate({ x: dx, y: dy }, -start.rotation); // delta em coordenadas locais
  const mul = opts.fromCenter ? 2 : 1;
  let w = handle.hx === 0 ? start.w : start.w + handle.hx * d.x * mul;
  let h = handle.hy === 0 ? start.h : start.h + handle.hy * d.y * mul;

  if (opts.keepAspect) {
    const ar = start.w / start.h;
    if (handle.hx !== 0 && handle.hy !== 0) {
      // canto: domina o eixo que mais mudou proporcionalmente
      const sw = w / start.w, sh = h / start.h;
      if (Math.abs(sw - 1) >= Math.abs(sh - 1)) h = w / ar; else w = h * ar;
    } else if (handle.hx !== 0) h = w / ar;
    else w = h * ar;
  }
  w = Math.max(min, w);
  h = Math.max(min, h);

  const c0 = center(start);
  if (opts.fromCenter) return { x: c0.x - w / 2, y: c0.y - h / 2, w, h };

  const a0 = { x: -handle.hx * start.w / 2, y: -handle.hy * start.h / 2 };
  const anchorWorld = { x: c0.x + rotate(a0, start.rotation).x, y: c0.y + rotate(a0, start.rotation).y };
  const a1 = { x: -handle.hx * w / 2, y: -handle.hy * h / 2 };
  const r1 = rotate(a1, start.rotation);
  const c1 = { x: anchorWorld.x - r1.x, y: anchorWorld.y - r1.y };
  return { x: c1.x - w / 2, y: c1.y - h / 2, w, h };
}

export const normDeg = (d: number) => ((d % 360) + 540) % 360 - 180;

/* ───────────── Encaixe (snap) e guias ───────────── */
export interface Guide { axis: 'x' | 'y'; pos: number; from: number; to: number }

/**
 * Procura o menor deslocamento que alinha as bordas/centro de `moving` com as de `others`.
 */
export function computeSnap(
  moving: Rect,
  others: Rect[],
  threshold: number,
  extraLinesX: number[] = [],
  extraLinesY: number[] = [],
): { dx: number; dy: number; guides: Guide[] } {
  const mx = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const my = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  let bestX: { d: number; line: number } | null = null;
  let bestY: { d: number; line: number } | null = null;

  const linesX = [...extraLinesX], linesY = [...extraLinesY];
  for (const o of others) {
    linesX.push(o.x, o.x + o.w / 2, o.x + o.w);
    linesY.push(o.y, o.y + o.h / 2, o.y + o.h);
  }
  for (const line of linesX) for (const m of mx) {
    const d = line - m;
    if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, line };
  }
  for (const line of linesY) for (const m of my) {
    const d = line - m;
    if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, line };
  }
  const dx = bestX?.d ?? 0, dy = bestY?.d ?? 0;
  const snapped = { x: moving.x + dx, y: moving.y + dy, w: moving.w, h: moving.h };
  const guides: Guide[] = [];
  const spanY = (line: number) => {
    const rs = [snapped, ...others].filter((o) => [o.x, o.x + o.w / 2, o.x + o.w].some((v) => Math.abs(v - line) < 0.5));
    const u = unionRect(rs)!;
    return { from: u.y, to: u.y + u.h };
  };
  const spanX = (line: number) => {
    const rs = [snapped, ...others].filter((o) => [o.y, o.y + o.h / 2, o.y + o.h].some((v) => Math.abs(v - line) < 0.5));
    const u = unionRect(rs)!;
    return { from: u.x, to: u.x + u.w };
  };
  if (bestX) guides.push({ axis: 'x', pos: bestX.line, ...spanY(bestX.line) });
  if (bestY) guides.push({ axis: 'y', pos: bestY.line, ...spanX(bestY.line) });
  return { dx, dy, guides };
}
