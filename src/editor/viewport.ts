import type { PageSettings } from '../types';
import type { Rect } from './geometry';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export interface VP { zoom: number; x: number; y: number }

/** Zoom mantendo o ponto (cx, cy) da tela fixo sobre o mesmo ponto do mundo. */
export function zoomAt(vp: VP, newZoom: number, cx: number, cy: number): VP {
  const z = clampZoom(newZoom);
  const wx = (cx - vp.x) / vp.zoom, wy = (cy - vp.y) / vp.zoom;
  return { zoom: z, x: cx - wx * z, y: cy - wy * z };
}

/** Enquadra um retângulo do mundo na área visível. */
export function fitRect(r: Rect, viewW: number, viewH: number, pad = 64, maxZoom = 2): VP {
  const zoom = clampZoom(Math.min((viewW - pad * 2) / Math.max(1, r.w), (viewH - pad * 2) / Math.max(1, r.h), maxZoom));
  return { zoom, x: (viewW - r.w * zoom) / 2 - r.x * zoom, y: (viewH - r.h * zoom) / 2 - r.y * zoom };
}

export const pageRect = (p: PageSettings): Rect => ({ x: p.x, y: p.y, w: p.w, h: p.h });

export const toWorld = (vp: VP, sx: number, sy: number) => ({ x: (sx - vp.x) / vp.zoom, y: (sy - vp.y) / vp.zoom });

/** Passo "bonito" para régua/grade: múltiplo de 1, 2 ou 5 × 10^n com pelo menos `minPx` na tela. */
export function niceStep(zoom: number, minPx = 60): number {
  const raw = minPx / zoom;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}
