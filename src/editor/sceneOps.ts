import { uid } from '../lib/ids';
import type { Scene, SceneNode } from '../types';
import { aabb, Rect, unionRect } from './geometry';

/* Todas as funções aqui são puras: recebem uma cena e devolvem outra (compartilhando o que não mudou). */

export const emptyScene = (): Scene => ({
  nodes: {},
  order: [],
  page: { x: 0, y: 0, w: 1200, h: 800, bg: '#1d1d22', visible: true },
});

/* ───────────── consultas ───────────── */
export const siblingsOf = (s: Scene, id: string): string[] => {
  const n = s.nodes[id];
  if (!n) return [];
  return n.parentId ? s.nodes[n.parentId]?.children ?? [] : s.order;
};

export function descendants(s: Scene, id: string): string[] {
  const n = s.nodes[id];
  if (!n?.children) return [];
  return n.children.flatMap((c) => [c, ...descendants(s, c)]);
}

/** Folhas (não-grupos) de um conjunto de ids. */
export function leavesOf(s: Scene, ids: string[]): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    const n = s.nodes[id];
    if (!n) return;
    if (n.type === 'group') n.children?.forEach(walk); else out.push(id);
  };
  ids.forEach(walk);
  return out;
}

export function topAncestor(s: Scene, id: string): string {
  let cur = s.nodes[id];
  while (cur?.parentId) cur = s.nodes[cur.parentId];
  return cur?.id ?? id;
}

/** Remove da lista ids cujo ancestral também está na lista. */
export function topLevelOnly(s: Scene, ids: string[]): string[] {
  const set = new Set(ids);
  return ids.filter((id) => {
    let p = s.nodes[id]?.parentId;
    while (p) { if (set.has(p)) return false; p = s.nodes[p]?.parentId ?? null; }
    return !!s.nodes[id];
  });
}

export const nodeRect = (n: SceneNode): Rect => aabb(n);

export function selectionRect(s: Scene, ids: string[]): Rect | null {
  return unionRect(ids.map((id) => s.nodes[id]).filter(Boolean).map(nodeRect));
}

/** Ids de todos os elementos desenháveis, de trás para frente (ordem de pintura). */
export function paintOrder(s: Scene): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    const n = s.nodes[id];
    if (!n) return;
    if (n.type === 'group') n.children?.forEach(walk); else out.push(id);
  };
  s.order.forEach(walk);
  return out;
}

export const isEffectivelyLocked = (s: Scene, id: string): boolean => {
  let n = s.nodes[id];
  while (n) { if (n.locked) return true; n = n.parentId ? s.nodes[n.parentId] : (undefined as any); }
  return false;
};
export const isEffectivelyHidden = (s: Scene, id: string): boolean => {
  let n = s.nodes[id];
  while (n) { if (n.hidden) return true; n = n.parentId ? s.nodes[n.parentId] : (undefined as any); }
  return false;
};

/* ───────────── mutações básicas ───────────── */
function withNodes(s: Scene, patch: Record<string, SceneNode>): Scene {
  return { ...s, nodes: { ...s.nodes, ...patch } };
}

export function addNode(s: Scene, node: SceneNode): Scene {
  const next = withNodes(s, { [node.id]: node });
  return { ...next, order: [...s.order, node.id] };
}

/** Recalcula a caixa de um grupo (e dos ancestrais) a partir dos filhos. */
export function refreshGroups(s: Scene, fromId: string | null): Scene {
  let cur = fromId;
  let scene = s;
  while (cur) {
    const g = scene.nodes[cur];
    if (!g || g.type !== 'group') break;
    const rs = (g.children ?? []).map((c) => scene.nodes[c]).filter(Boolean).map(nodeRect);
    const u = unionRect(rs);
    if (u) scene = withNodes(scene, { [g.id]: { ...g, x: u.x, y: u.y, w: u.w, h: u.h } });
    cur = g.parentId;
  }
  return scene;
}

export function updateNode(s: Scene, id: string, patch: Partial<SceneNode>): Scene {
  const n = s.nodes[id];
  if (!n) return s;
  const next = withNodes(s, { [id]: { ...n, ...patch } });
  return refreshGroups(next, n.parentId);
}
export const updateStyle = (s: Scene, id: string, style: Partial<SceneNode['style']>) =>
  s.nodes[id] ? updateNode(s, id, { style: { ...s.nodes[id].style, ...style } }) : s;
export const updateData = (s: Scene, id: string, data: Partial<SceneNode['data']>) =>
  s.nodes[id] ? updateNode(s, id, { data: { ...s.nodes[id].data, ...data } }) : s;

export function removeNodes(s: Scene, ids: string[]): Scene {
  const kill = new Set<string>();
  for (const id of topLevelOnly(s, ids)) { kill.add(id); descendants(s, id).forEach((d) => kill.add(d)); }
  if (!kill.size) return s;
  const nodes: Record<string, SceneNode> = {};
  const touchedParents = new Set<string>();
  for (const [id, n] of Object.entries(s.nodes)) {
    if (kill.has(id)) { if (n.parentId && !kill.has(n.parentId)) touchedParents.add(n.parentId); continue; }
    nodes[id] = n.children ? { ...n, children: n.children.filter((c) => !kill.has(c)) } : n;
  }
  let scene: Scene = { ...s, nodes, order: s.order.filter((id) => !kill.has(id)) };
  // grupos que ficaram vazios também somem
  for (const pid of touchedParents) {
    const g = scene.nodes[pid];
    if (g && g.type === 'group' && !g.children?.length) scene = removeNodes(scene, [pid]);
    else scene = refreshGroups(scene, pid);
  }
  return scene;
}

/** Move (em coordenadas do mundo) os elementos informados e seus descendentes. */
export function moveNodes(s: Scene, ids: string[], dx: number, dy: number): Scene {
  if (!dx && !dy) return s;
  const top = topLevelOnly(s, ids);
  const patch: Record<string, SceneNode> = {};
  const parents = new Set<string>();
  for (const id of top) {
    for (const t of [id, ...descendants(s, id)]) {
      const n = s.nodes[t];
      patch[t] = { ...n, x: n.x + dx, y: n.y + dy };
    }
    const p = s.nodes[id].parentId;
    if (p) parents.add(p);
  }
  let scene = withNodes(s, patch);
  parents.forEach((p) => (scene = refreshGroups(scene, p)));
  return scene;
}

/** Define x/y/w/h de um elemento; em grupos, move/escala os filhos. */
export function setRect(s: Scene, id: string, r: Partial<Rect>): Scene {
  const n = s.nodes[id];
  if (!n) return s;
  if (n.type !== 'group') {
    const next = { ...n, ...r };
    next.w = Math.max(1, next.w);
    next.h = Math.max(1, next.h);
    return refreshGroups(withNodes(s, { [id]: next }), n.parentId);
  }
  const nx = r.x ?? n.x, ny = r.y ?? n.y;
  const sx = r.w !== undefined ? Math.max(1, r.w) / (n.w || 1) : 1;
  const sy = r.h !== undefined ? Math.max(1, r.h) / (n.h || 1) : 1;
  return scaleNodes(s, [id], { x: n.x, y: n.y }, sx, sy, { dx: nx - n.x, dy: ny - n.y });
}

/** Escala elementos em relação a uma âncora (usado no redimensionamento de seleções e grupos). */
export function scaleNodes(
  s: Scene, ids: string[], anchor: { x: number; y: number }, sx: number, sy: number,
  offset: { dx: number; dy: number } = { dx: 0, dy: 0 },
): Scene {
  const top = topLevelOnly(s, ids);
  const patch: Record<string, SceneNode> = {};
  const parents = new Set<string>();
  for (const id of top) {
    for (const t of leavesOf(s, [id])) {
      const n = s.nodes[t];
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      const ncx = anchor.x + (cx - anchor.x) * sx + offset.dx;
      const ncy = anchor.y + (cy - anchor.y) * sy + offset.dy;
      const w = Math.max(1, n.w * Math.abs(sx)), h = Math.max(1, n.h * Math.abs(sy));
      patch[t] = { ...n, x: ncx - w / 2, y: ncy - h / 2, w, h };
    }
    const p = s.nodes[id].parentId;
    if (p) parents.add(p);
  }
  let scene = withNodes(s, patch);
  // recalcula todos os grupos afetados (de dentro para fora)
  const groups = top.flatMap((id) => [id, ...descendants(s, id)]).filter((id) => s.nodes[id].type === 'group').reverse();
  for (const g of groups) scene = refreshGroups(scene, g);
  parents.forEach((p) => (scene = refreshGroups(scene, p)));
  return scene;
}

/* ───────────── agrupar ───────────── */
export function groupNodes(s: Scene, ids: string[]): { scene: Scene; groupId: string | null } {
  const top = topLevelOnly(s, ids).filter((id) => !isEffectivelyLocked(s, id));
  if (top.length < 2) return { scene: s, groupId: null };
  const parentId = s.nodes[top[0]].parentId;
  const same = top.filter((id) => s.nodes[id].parentId === parentId);
  if (same.length < 2) return { scene: s, groupId: null };

  const siblings = parentId ? s.nodes[parentId].children! : s.order;
  const sorted = [...same].sort((a, b) => siblings.indexOf(a) - siblings.indexOf(b));
  const insertAt = siblings.indexOf(sorted[sorted.length - 1]) - (sorted.length - 1);
  const gid = uid();
  const rect = selectionRect(s, sorted)!;
  const group: SceneNode = {
    id: gid, type: 'group', name: 'Grupo', x: rect.x, y: rect.y, w: rect.w, h: rect.h, rotation: 0,
    opacity: 1, locked: false, hidden: false, parentId, children: sorted, style: {}, data: {},
  };
  const nodes = { ...s.nodes, [gid]: group };
  for (const id of sorted) nodes[id] = { ...nodes[id], parentId: gid };
  const remaining = siblings.filter((id) => !sorted.includes(id));
  remaining.splice(insertAt, 0, gid);
  if (parentId) nodes[parentId] = { ...nodes[parentId], children: remaining };
  return { scene: { ...s, nodes, order: parentId ? s.order : remaining }, groupId: gid };
}

export function ungroup(s: Scene, groupIds: string[]): { scene: Scene; freed: string[] } {
  let scene = s;
  const freed: string[] = [];
  for (const gid of groupIds) {
    const g = scene.nodes[gid];
    if (!g || g.type !== 'group' || !g.children) continue;
    const kids = g.children;
    const siblings = g.parentId ? scene.nodes[g.parentId].children! : scene.order;
    const at = siblings.indexOf(gid);
    const nextSibs = [...siblings.slice(0, at), ...kids, ...siblings.slice(at + 1)];
    const nodes = { ...scene.nodes };
    delete nodes[gid];
    for (const k of kids) nodes[k] = { ...nodes[k], parentId: g.parentId };
    if (g.parentId) nodes[g.parentId] = { ...nodes[g.parentId], children: nextSibs };
    scene = { ...scene, nodes, order: g.parentId ? scene.order : nextSibs };
    freed.push(...kids);
  }
  return { scene, freed };
}

/* ───────────── camadas ───────────── */
export type OrderMove = 'front' | 'back' | 'forward' | 'backward';
export function reorder(s: Scene, ids: string[], move: OrderMove): Scene {
  const top = topLevelOnly(s, ids);
  if (!top.length) return s;
  // opera por grupo de irmãos
  const byParent = new Map<string | null, string[]>();
  top.forEach((id) => {
    const p = s.nodes[id].parentId;
    byParent.set(p, [...(byParent.get(p) ?? []), id]);
  });
  let scene = s;
  for (const [parent, group] of byParent) {
    const list = [...(parent ? scene.nodes[parent].children! : scene.order)];
    const sel = list.filter((id) => group.includes(id));
    const rest = list.filter((id) => !group.includes(id));
    let out: string[];
    if (move === 'front') out = [...rest, ...sel];
    else if (move === 'back') out = [...sel, ...rest];
    else {
      out = [...list];
      if (move === 'forward') {
        for (let i = out.length - 2; i >= 0; i--) if (group.includes(out[i]) && !group.includes(out[i + 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]];
      } else {
        for (let i = 1; i < out.length; i++) if (group.includes(out[i]) && !group.includes(out[i - 1])) [out[i], out[i - 1]] = [out[i - 1], out[i]];
      }
    }
    scene = parent
      ? { ...scene, nodes: { ...scene.nodes, [parent]: { ...scene.nodes[parent], children: out } } }
      : { ...scene, order: out };
  }
  return scene;
}

/** Move `id` para uma posição específica entre os irmãos de `targetId` (arrastar na lista de camadas). */
export function moveBefore(s: Scene, id: string, targetId: string, after = false): Scene {
  if (id === targetId || descendants(s, id).includes(targetId)) return s;
  const n = s.nodes[id], t = s.nodes[targetId];
  if (!n || !t) return s;
  let scene = removeFromParent(s, id);
  const parentId = t.parentId;
  const list = [...(parentId ? scene.nodes[parentId].children! : scene.order)];
  const at = list.indexOf(targetId) + (after ? 1 : 0);
  list.splice(at, 0, id);
  const nodes = { ...scene.nodes, [id]: { ...scene.nodes[id], parentId } };
  if (parentId) nodes[parentId] = { ...nodes[parentId], children: list };
  scene = { ...scene, nodes, order: parentId ? scene.order : list };
  return refreshGroups(refreshGroups(scene, parentId), n.parentId);
}

function removeFromParent(s: Scene, id: string): Scene {
  const n = s.nodes[id];
  if (n.parentId) {
    const p = s.nodes[n.parentId];
    return { ...s, nodes: { ...s.nodes, [p.id]: { ...p, children: p.children!.filter((c) => c !== id) } } };
  }
  return { ...s, order: s.order.filter((o) => o !== id) };
}

/* ───────────── copiar / colar / duplicar ───────────── */
export interface Clipboard { nodes: SceneNode[]; rootIds: string[] }

export function extractClipboard(s: Scene, ids: string[]): Clipboard {
  const roots = topLevelOnly(s, ids);
  const all = new Set<string>();
  roots.forEach((r) => { all.add(r); descendants(s, r).forEach((d) => all.add(d)); });
  return { rootIds: roots, nodes: [...all].map((id) => s.nodes[id]) };
}

export function pasteClipboard(s: Scene, clip: Clipboard, offset = { x: 16, y: 16 }): { scene: Scene; newIds: string[] } {
  const map = new Map<string, string>();
  clip.nodes.forEach((n) => map.set(n.id, uid()));
  const nodes = { ...s.nodes };
  for (const n of clip.nodes) {
    const id = map.get(n.id)!;
    nodes[id] = {
      ...n, id,
      x: n.x + offset.x, y: n.y + offset.y,
      parentId: n.parentId && map.has(n.parentId) ? map.get(n.parentId)! : null,
      children: n.children?.map((c) => map.get(c)!).filter(Boolean),
      style: { ...n.style }, data: JSON.parse(JSON.stringify(n.data)),
      locked: false,
    };
  }
  const newIds = clip.rootIds.map((r) => map.get(r)!);
  return { scene: { ...s, nodes, order: [...s.order, ...newIds] }, newIds };
}

export const duplicateNodes = (s: Scene, ids: string[], offset = { x: 16, y: 16 }) =>
  pasteClipboard(s, extractClipboard(s, ids), offset);

/* ───────────── alinhar / distribuir ───────────── */
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export function alignNodes(s: Scene, ids: string[], mode: AlignMode): Scene {
  const top = topLevelOnly(s, ids).filter((id) => !isEffectivelyLocked(s, id));
  if (!top.length) return s;
  // com um só elemento, alinha à página; com vários, ao conjunto
  const ref: Rect = top.length === 1 ? s.page : selectionRect(s, top)!;
  let scene = s;
  for (const id of top) {
    const r = nodeRect(scene.nodes[id]);
    let dx = 0, dy = 0;
    if (mode === 'left') dx = ref.x - r.x;
    if (mode === 'right') dx = ref.x + ref.w - (r.x + r.w);
    if (mode === 'hcenter') dx = ref.x + ref.w / 2 - (r.x + r.w / 2);
    if (mode === 'top') dy = ref.y - r.y;
    if (mode === 'bottom') dy = ref.y + ref.h - (r.y + r.h);
    if (mode === 'vcenter') dy = ref.y + ref.h / 2 - (r.y + r.h / 2);
    scene = moveNodes(scene, [id], dx, dy);
  }
  return scene;
}

/** Distribui com espaçamento igual entre os elementos (precisa de 3+). Com `gap`, usa espaçamento fixo. */
export function distributeNodes(s: Scene, ids: string[], axis: 'x' | 'y', gap?: number): Scene {
  const top = topLevelOnly(s, ids).filter((id) => !isEffectivelyLocked(s, id));
  if (top.length < 2) return s;
  const pos = axis === 'x' ? 'x' : 'y', size = axis === 'x' ? 'w' : 'h';
  const items = top.map((id) => ({ id, r: nodeRect(s.nodes[id]) })).sort((a, b) => a.r[pos] - b.r[pos]);
  let g = gap;
  if (g === undefined) {
    if (items.length < 3) return s;
    const first = items[0].r, last = items[items.length - 1].r;
    const total = last[pos] + last[size] - first[pos];
    const sizes = items.reduce((acc, i) => acc + i.r[size], 0);
    g = (total - sizes) / (items.length - 1);
  }
  let scene = s;
  let cursor = items[0].r[pos] + items[0].r[size] + g;
  for (let i = 1; i < items.length; i++) {
    const cur = nodeRect(scene.nodes[items[i].id]);
    const delta = cursor - cur[pos];
    scene = moveNodes(scene, [items[i].id], axis === 'x' ? delta : 0, axis === 'y' ? delta : 0);
    cursor += cur[size] + g;
  }
  return scene;
}

/* ───────────── trava / visibilidade ───────────── */
export function setFlag(s: Scene, ids: string[], flag: 'locked' | 'hidden', value: boolean): Scene {
  const patch: Record<string, SceneNode> = {};
  ids.forEach((id) => { if (s.nodes[id]) patch[id] = { ...s.nodes[id], [flag]: value }; });
  return withNodes(s, patch);
}

/** Garante integridade de uma cena vinda do disco/servidor (campos faltando, referências quebradas). */
export function normalizeScene(raw: any): Scene {
  const base = emptyScene();
  if (!raw || typeof raw !== 'object' || typeof raw.nodes !== 'object' || !Array.isArray(raw.order)) return base;
  const nodes: Record<string, SceneNode> = {};
  for (const [id, n] of Object.entries<any>(raw.nodes ?? {})) {
    if (!n || typeof n !== 'object' || typeof n.type !== 'string') continue;
    nodes[id] = {
      id, type: n.type, name: String(n.name ?? n.type),
      x: Number(n.x) || 0, y: Number(n.y) || 0, w: Math.max(1, Number(n.w) || 1), h: Math.max(1, Number(n.h) || 1),
      rotation: Number(n.rotation) || 0, opacity: typeof n.opacity === 'number' ? n.opacity : 1,
      locked: !!n.locked, hidden: !!n.hidden, parentId: n.parentId ?? null,
      children: Array.isArray(n.children) ? n.children : undefined,
      aspectLocked: !!n.aspectLocked, style: n.style ?? {}, data: n.data ?? {},
    };
  }
  for (const n of Object.values(nodes)) {
    if (n.children) n.children = n.children.filter((c) => nodes[c] && nodes[c].parentId === n.id);
    if (n.parentId && (!nodes[n.parentId] || !nodes[n.parentId].children?.includes(n.id))) n.parentId = null;
  }
  const order = raw.order.filter((id: string) => nodes[id] && !nodes[id].parentId);
  // órfãos de raiz que não estão em `order`
  for (const n of Object.values(nodes)) if (!n.parentId && !order.includes(n.id)) order.push(n.id);
  return { nodes, order, page: { ...base.page, ...(raw.page ?? {}) } };
}
