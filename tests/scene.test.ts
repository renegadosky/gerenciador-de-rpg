import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode } from '../src/editor/defaults.ts';
import { aabb, resizeRect, computeSnap, center } from '../src/editor/geometry.ts';
import * as ops from '../src/editor/sceneOps.ts';

const mk = (x: number, y: number, w = 100, h = 50, type: any = 'box') => ({ ...createNode(type, { x, y }, { w, h }) });
function build(...nodes: ReturnType<typeof mk>[]) {
  let s = ops.emptyScene();
  for (const n of nodes) s = ops.addNode(s, n);
  return s;
}
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('aabb de retângulo girado 90° troca largura e altura', () => {
  const r = aabb({ x: 0, y: 0, w: 100, h: 20, rotation: 90 });
  close(r.w, 20); close(r.h, 100);
  close(r.x + r.w / 2, 50); close(r.y + r.h / 2, 10); // mesmo centro
});

test('resize: canto inferior direito mantém canto superior esquerdo fixo', () => {
  const r = resizeRect({ x: 10, y: 20, w: 100, h: 50, rotation: 0 }, { hx: 1, hy: 1 }, 30, 10);
  assert.deepEqual(r, { x: 10, y: 20, w: 130, h: 60 });
});
test('resize: puxador esquerdo mantém borda direita fixa', () => {
  const r = resizeRect({ x: 10, y: 20, w: 100, h: 50, rotation: 0 }, { hx: -1, hy: 0 }, -40, 0);
  assert.deepEqual(r, { x: -30, y: 20, w: 140, h: 50 });
});
test('resize com rotação mantém o ponto âncora fixo no mundo', () => {
  const start = { x: 100, y: 100, w: 80, h: 40, rotation: 30 };
  const anchorBefore = (() => {
    const c = center(start); const a = { x: -40, y: -20 }; // âncora do puxador (1,1) = canto sup-esq local
    const r = Math.PI / 6;
    return { x: c.x + a.x * Math.cos(r) - a.y * Math.sin(r), y: c.y + a.x * Math.sin(r) + a.y * Math.cos(r) };
  })();
  const out = resizeRect(start, { hx: 1, hy: 1 }, 25, 15);
  const c = center(out); const a = { x: -out.w / 2, y: -out.h / 2 };
  const r = Math.PI / 6;
  const anchorAfter = { x: c.x + a.x * Math.cos(r) - a.y * Math.sin(r), y: c.y + a.x * Math.sin(r) + a.y * Math.cos(r) };
  close(anchorBefore.x, anchorAfter.x); close(anchorBefore.y, anchorAfter.y);
});
test('resize respeita proporção e tamanho mínimo', () => {
  const r = resizeRect({ x: 0, y: 0, w: 100, h: 50, rotation: 0 }, { hx: 1, hy: 1 }, 100, 0, { keepAspect: true });
  close(r.w / r.h, 2);
  const m = resizeRect({ x: 0, y: 0, w: 100, h: 50, rotation: 0 }, { hx: 1, hy: 0 }, -500, 0);
  assert.equal(m.w, 4);
});

test('snap encaixa em bordas e centros de outros elementos', () => {
  const { dx, dy, guides } = computeSnap({ x: 103, y: 0, w: 50, h: 50 }, [{ x: 200, y: 0, w: 50, h: 50 }, { x: 0, y: 100, w: 100, h: 20 }], 6);
  assert.equal(dx, -3); // borda esquerda 103 → 100? alinha com borda direita (100) do segundo
  assert.ok(guides.length >= 1);
  assert.equal(dy, 0);
});

test('mover, remover e duplicar', () => {
  const a = mk(0, 0), b = mk(200, 0);
  let s = build(a, b);
  s = ops.moveNodes(s, [a.id], 10, 5);
  assert.equal(s.nodes[a.id].x, 10);
  const { scene, newIds } = ops.duplicateNodes(s, [a.id]);
  assert.equal(scene.order.length, 3);
  assert.equal(scene.nodes[newIds[0]].x, 26);
  assert.notEqual(newIds[0], a.id);
  const r = ops.removeNodes(scene, [a.id]);
  assert.equal(r.order.length, 2);
  assert.equal(r.nodes[a.id], undefined);
});

test('agrupar mantém ordem, calcula caixa e desagrupar restaura', () => {
  const a = mk(0, 0), b = mk(200, 100), c = mk(500, 500);
  let s = build(a, b, c);
  const { scene, groupId } = ops.groupNodes(s, [a.id, b.id]);
  assert.ok(groupId);
  s = scene;
  assert.deepEqual(s.order, [groupId, c.id]);
  assert.deepEqual([s.nodes[groupId!].x, s.nodes[groupId!].y, s.nodes[groupId!].w, s.nodes[groupId!].h], [0, 0, 300, 150]);
  assert.equal(s.nodes[a.id].parentId, groupId);

  // mover o grupo move os filhos
  s = ops.moveNodes(s, [groupId!], 50, 50);
  assert.equal(s.nodes[a.id].x, 50);
  assert.equal(s.nodes[groupId!].x, 50);

  const u = ops.ungroup(s, [groupId!]);
  assert.deepEqual(u.scene.order, [a.id, b.id, c.id]);
  assert.equal(u.scene.nodes[a.id].parentId, null);
  assert.equal(u.scene.nodes[groupId!], undefined);
});

test('redimensionar um grupo escala os filhos', () => {
  const a = mk(0, 0, 100, 100), b = mk(100, 0, 100, 100);
  let { scene, groupId } = ops.groupNodes(build(a, b), [a.id, b.id]);
  scene = ops.setRect(scene, groupId!, { w: 400 }); // dobra a largura (200 → 400)
  assert.equal(scene.nodes[a.id].w, 200);
  assert.equal(scene.nodes[b.id].x, 200);
  assert.equal(scene.nodes[groupId!].w, 400);
});

test('remover o último filho remove o grupo', () => {
  const a = mk(0, 0), b = mk(200, 0);
  let { scene, groupId } = ops.groupNodes(build(a, b), [a.id, b.id]);
  scene = ops.removeNodes(scene, [a.id, b.id]);
  assert.equal(scene.nodes[groupId!], undefined);
  assert.deepEqual(scene.order, []);
});

test('ordem das camadas', () => {
  const a = mk(0, 0), b = mk(0, 0), c = mk(0, 0);
  let s = build(a, b, c);
  assert.deepEqual(ops.reorder(s, [a.id], 'front').order, [b.id, c.id, a.id]);
  assert.deepEqual(ops.reorder(s, [c.id], 'back').order, [c.id, a.id, b.id]);
  assert.deepEqual(ops.reorder(s, [a.id], 'forward').order, [b.id, a.id, c.id]);
  assert.deepEqual(ops.reorder(s, [c.id], 'backward').order, [a.id, c.id, b.id]);
  assert.deepEqual(ops.reorder(s, [a.id, b.id], 'forward').order, [c.id, a.id, b.id]);
  assert.deepEqual(ops.moveBefore(s, c.id, a.id).order, [c.id, a.id, b.id]);
});

test('alinhar e distribuir', () => {
  const a = mk(0, 0, 50, 50), b = mk(100, 30, 50, 50), c = mk(400, 70, 50, 50);
  let s = build(a, b, c);
  const left = ops.alignNodes(s, [a.id, b.id, c.id], 'left');
  assert.deepEqual([left.nodes[a.id].x, left.nodes[b.id].x, left.nodes[c.id].x], [0, 0, 0]);
  const right = ops.alignNodes(s, [a.id, b.id, c.id], 'right');
  assert.equal(right.nodes[a.id].x, 400);
  const dist = ops.distributeNodes(s, [a.id, b.id, c.id], 'x');
  // espaço total 450 - 150 = 300, 2 intervalos de 150
  assert.equal(dist.nodes[b.id].x, 200);
  const fixed = ops.distributeNodes(s, [a.id, b.id, c.id], 'x', 10);
  assert.equal(fixed.nodes[b.id].x, 60);
  assert.equal(fixed.nodes[c.id].x, 120);
  // único elemento alinha à página
  const one = ops.alignNodes(s, [a.id], 'hcenter');
  assert.equal(one.nodes[a.id].x, 575);
});

test('travados não são alinhados', () => {
  const a = mk(0, 0), b = { ...mk(300, 0), locked: true };
  const s = ops.alignNodes(build(a, b), [a.id, b.id], 'right');
  assert.equal(s.nodes[b.id].x, 300);
});

test('copiar/colar entre cenas preserva grupos com novos ids', () => {
  const a = mk(0, 0), b = mk(200, 0);
  const { scene, groupId } = ops.groupNodes(build(a, b), [a.id, b.id]);
  const clip = ops.extractClipboard(scene, [groupId!]);
  assert.equal(clip.nodes.length, 3);
  const { scene: s2, newIds } = ops.pasteClipboard(ops.emptyScene(), clip, { x: 0, y: 0 });
  assert.equal(Object.keys(s2.nodes).length, 3);
  const g = s2.nodes[newIds[0]];
  assert.equal(g.type, 'group');
  assert.equal(g.children!.length, 2);
  for (const k of g.children!) assert.equal(s2.nodes[k].parentId, g.id);
  assert.ok(!s2.nodes[a.id]);
});

test('normalizeScene corrige dados quebrados', () => {
  const s = ops.normalizeScene({ nodes: { a: { type: 'box', x: 'x', parentId: 'fantasma' }, b: 5 }, order: ['a', 'zzz'] });
  assert.deepEqual(s.order, ['a']);
  assert.equal(s.nodes.a.parentId, null);
  assert.equal(s.nodes.a.x, 0);
  assert.equal(ops.normalizeScene(null).order.length, 0);
});

test('ordem de pintura percorre grupos', () => {
  const a = mk(0, 0), b = mk(0, 0), c = mk(0, 0);
  const { scene, groupId } = ops.groupNodes(build(a, b, c), [a.id, b.id]);
  assert.deepEqual(ops.paintOrder(scene), [a.id, b.id, c.id]);
  assert.equal(ops.topAncestor(scene, a.id), groupId);
});
