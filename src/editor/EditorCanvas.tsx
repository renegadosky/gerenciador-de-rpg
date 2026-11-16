import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { useEditor } from '../stores/editor';
import { useRules } from '../stores/rules';
import { computeVariables, nodeFormulaVars } from './compute';
import { ELEMENT_BY_TYPE } from './defaults';
import {
  aabb, computeSnap, Handle, HANDLES, normDeg, Rect, rectsIntersect, resizeRect, unionRect,
} from './geometry';
import { addImageFromFile, setImageFile } from './imageActions';
import { NodeView, RenderCtx } from './NodeView';
import * as ops from './sceneOps';
import { runtime } from './runtime';
import { clampZoom, fitRect, niceStep, pageRect, toWorld, zoomAt } from './viewport';
import { keyOf } from '../engine/formula';
import { rollDice } from '../engine/dice';
import { fileToScaledDataUrl } from '../lib/image';
import { errMsg, toast } from '../stores/toast';
import type { NodeType, Value, Variable } from '../types';

const SNAP_PX = 6;
const INTERACTIVE = 'input,button,select,textarea,[role=switch]';

export function EditorCanvas() {
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingImage = useRef<string | null>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [marquee, setMarquee] = useState<Rect | null>(null); // em coordenadas de tela (relativas ao stage)
  const [creating, setCreating] = useState<Rect | null>(null); // em coordenadas do mundo
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const scene = useEditor((s) => s.scene);
  const play = useEditor((s) => s.play);
  const vp = useEditor((s) => s.viewport);
  const selection = useEditor((s) => s.selection);
  const mode = useEditor((s) => s.mode);
  const tool = useEditor((s) => s.tool);
  const settings = useEditor((s) => s.settings);
  const guides = useEditor((s) => s.guides);
  const editingTextId = useEditor((s) => s.editingTextId);
  const sheetId = useEditor((s) => s.sheet?.id);
  const variables = useRules((s) => s.variables);

  /* ───────── valores calculados ───────── */
  // fórmulas escritas diretamente nos campos; só recalcula quando alguma delas muda
  const formulaSig = Object.values(scene.nodes).filter((n) => n.data.formula).map((n) => `${n.id}:${n.data.formula}:${n.data.bind ?? ''}`).join('|');
  const nodeVars = useMemo(() => nodeFormulaVars(Object.values(scene.nodes)), [formulaSig]);
  const computed = useMemo(
    () => computeVariables([...variables, ...nodeVars], mode === 'play' ? play.vars : {}),
    [variables, nodeVars, play.vars, mode],
  );
  const varsById = useMemo(() => Object.fromEntries(variables.map((v) => [v.id, v])) as Record<string, Variable>, [variables]);

  const ctx: RenderCtx = useMemo(() => ({
    mode, vars: varsById, computed, play,
    lookup: (name: string): Value | undefined => computed.byName.get(keyOf(name)),
    setPlayVar: (id, v) => useEditor.getState().setPlayVar(id, v),
    setPlayNode: (id, v) => useEditor.getState().setPlayNode(id, v),
    editingTextId,
    onTextCommit: (id, text) => {
      const st = useEditor.getState();
      st.commit((s) => ops.updateData(s, id, { text }));
      st.setEditingText(null);
    },
    setPlayImage: (id, file) => {
      fileToScaledDataUrl(file, 900).then((r) => useEditor.getState().setPlayNode(id, r.dataUrl)).catch((e) => toast.error(errMsg(e)));
    },
    roll: (label, expr, storeInVar) => {
      const names = variables.map((v) => v.name).filter(Boolean);
      const r = rollDice(expr, names, (n) => computed.byName.get(keyOf(n)));
      useEditor.getState().addRoll({ label, text: r.text, total: r.total, ok: r.ok, error: r.error });
      if (r.ok && storeInVar) useEditor.getState().setPlayVar(storeInVar, r.total);
    },
  }), [mode, varsById, computed, play, editingTextId, variables]);

  /* ───────── tamanho da área ───────── */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
      runtime.stage = { w: r.width, h: r.height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const st = useEditor.getState();
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    const content = unionRect(st.scene.order.map((id) => ops.nodeRect(st.scene.nodes[id])));
    const target = st.scene.page.visible ? unionRect([pageRect(st.scene.page), ...(content ? [content] : [])])! : content ?? pageRect(st.scene.page);
    st.setViewport(fitRect(target, r.width, r.height, st.mode === 'play' ? 32 : 72));
  }, []);

  // enquadra ao abrir uma ficha e ao alternar entre editar/jogar
  const fitKey = `${sheetId}:${mode}`;
  const fitted = useRef('');
  useEffect(() => {
    if (!sheetId || size.w < 50 || fitted.current === fitKey) return;
    fitted.current = fitKey;
    fit();
  }, [fitKey, sheetId, size.w, fit]);

  useEffect(() => {
    const onFit = () => fit();
    window.addEventListener('rpg:fit', onFit);
    return () => window.removeEventListener('rpg:fit', onFit);
  }, [fit]);

  /* ───────── roda do mouse: zoom (Ctrl/pinça) ou movimento ───────── */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('textarea,select')) return;
      e.preventDefault();
      const st = useEditor.getState();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.01));
        st.setViewport(zoomAt(st.viewport, st.viewport.zoom * f, e.clientX - r.left, e.clientY - r.top));
      } else {
        const k = e.deltaMode === 1 ? 16 : 1;
        st.setViewport({ x: st.viewport.x - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k, y: st.viewport.y - (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* ───────── barra de espaço = mão ───────── */
  useEffect(() => {
    const typing = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('input,textarea,select,[contenteditable=true]');
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !typing(e.target)) { e.preventDefault(); runtime.space = true; setSpace(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { runtime.space = false; setSpace(false); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  /* ───────── utilitários de gesto ───────── */
  const worldOf = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return toWorld(useEditor.getState().viewport, clientX - r.left, clientY - r.top);
  };

  function gesture(e: React.PointerEvent, h: { move: (ev: PointerEvent) => void; up: (ev: PointerEvent, moved: boolean) => void; cancel?: () => void }) {
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
      moved = true;
      h.move(ev);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
    const onUp = (ev: PointerEvent) => { cleanup(); h.up(ev, moved); };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { cleanup(); h.cancel?.(); } };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
  }

  function startPan(e: React.PointerEvent) {
    e.preventDefault();
    const st = useEditor.getState();
    const { x, y } = st.viewport;
    const sx = e.clientX, sy = e.clientY;
    setPanning(true);
    gesture(e, {
      move: (ev) => useEditor.getState().setViewport({ x: x + ev.clientX - sx, y: y + ev.clientY - sy }),
      up: () => setPanning(false),
      cancel: () => setPanning(false),
    });
  }

  function startMove(e: React.PointerEvent, ids: string[]) {
    const st0 = useEditor.getState();
    const scene0 = st0.scene;
    const movable = ops.topLevelOnly(scene0, ids).filter((id) => !ops.isEffectivelyLocked(scene0, id));
    if (!movable.length) return;
    const start = worldOf(e.clientX, e.clientY);
    const startRect = ops.selectionRect(scene0, movable)!;
    const own = new Set(movable.flatMap((id) => [id, ...ops.descendants(scene0, id)]));
    const others = ops.paintOrder(scene0)
      .filter((id) => !own.has(id) && !ops.isEffectivelyHidden(scene0, id))
      .map((id) => aabb(scene0.nodes[id]));
    const pg = scene0.page;
    const lx = pg.visible ? [pg.x, pg.x + pg.w / 2, pg.x + pg.w] : [];
    const ly = pg.visible ? [pg.y, pg.y + pg.h / 2, pg.y + pg.h] : [];

    let dupScene: ReturnType<typeof ops.duplicateNodes> | null = null;
    st0.beginGesture();
    if (e.altKey) {
      dupScene = ops.duplicateNodes(scene0, movable, { x: 0, y: 0 });
      useEditor.setState({ selection: dupScene.newIds });
    }
    const targetIds = dupScene ? dupScene.newIds : movable;

    gesture(e, {
      move: (ev) => {
        const st = useEditor.getState();
        const w = worldOf(ev.clientX, ev.clientY);
        let dx = w.x - start.x, dy = w.y - start.y;
        // Shift trava o movimento em um eixo
        const lock: 'x' | 'y' | null = ev.shiftKey ? (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y') : null;
        if (lock === 'x') dy = 0;
        if (lock === 'y') dx = 0;
        let guidesOut: ReturnType<typeof computeSnap>['guides'] = [];
        if (st.settings.snap && !ev.ctrlKey && !ev.metaKey) {
          const moving = { x: startRect.x + dx, y: startRect.y + dy, w: startRect.w, h: startRect.h };
          const sn = computeSnap(moving, others, SNAP_PX / st.viewport.zoom, lx, ly);
          let sdx = sn.dx, sdy = sn.dy;
          if (st.settings.grid) {
            const g = st.settings.gridSize;
            if (!sn.guides.some((q) => q.axis === 'x')) sdx = Math.round(moving.x / g) * g - moving.x;
            if (!sn.guides.some((q) => q.axis === 'y')) sdy = Math.round(moving.y / g) * g - moving.y;
          }
          if (lock !== 'x') dy += sdy; // eixo travado não sofre encaixe
          if (lock !== 'y') dx += sdx;
          guidesOut = st.settings.guides ? sn.guides : [];
        }
        st.liveUpdate((base) => ops.moveNodes(dupScene ? dupScene.scene : base, targetIds, dx, dy));
        st.setGuides(guidesOut);
      },
      up: (_ev, moved) => {
        const st = useEditor.getState();
        st.endGesture();
        if (!moved && dupScene) st.select(movable); // Alt+clique sem arrastar não duplica
      },
      cancel: () => { useEditor.getState().cancelGesture(); if (dupScene) useEditor.setState({ selection: movable }); },
    });
  }

  function startResize(e: React.PointerEvent, handle: Handle) {
    e.stopPropagation();
    e.preventDefault();
    const st0 = useEditor.getState();
    const scene0 = st0.scene;
    const ids = ops.topLevelOnly(scene0, st0.selection).filter((id) => !ops.isEffectivelyLocked(scene0, id));
    if (!ids.length) return;
    const start = worldOf(e.clientX, e.clientY);
    st0.beginGesture();

    const single = ids.length === 1 && scene0.nodes[ids[0]].type !== 'group' ? scene0.nodes[ids[0]] : null;
    if (single) {
      gesture(e, {
        move: (ev) => {
          const w = worldOf(ev.clientX, ev.clientY);
          const r = resizeRect(single, handle, w.x - start.x, w.y - start.y, {
            keepAspect: ev.shiftKey || single.aspectLocked, fromCenter: ev.altKey,
          });
          useEditor.getState().liveUpdate((base) => ops.setRect(base, single.id, r));
        },
        up: () => useEditor.getState().endGesture(),
        cancel: () => useEditor.getState().cancelGesture(),
      });
      return;
    }
    const box = ops.selectionRect(scene0, ids)!;
    gesture(e, {
      move: (ev) => {
        const w = worldOf(ev.clientX, ev.clientY);
        const r = resizeRect({ ...box, rotation: 0 }, handle, w.x - start.x, w.y - start.y, { keepAspect: ev.shiftKey, fromCenter: ev.altKey, min: 8 });
        const sx = r.w / box.w, sy = r.h / box.h;
        const anchor = { x: handle.hx === -1 ? box.x + box.w : box.x, y: handle.hy === -1 ? box.y + box.h : box.y };
        const off = ev.altKey ? { dx: r.x - (anchor.x + (box.x - anchor.x) * sx), dy: r.y - (anchor.y + (box.y - anchor.y) * sy) } : { dx: 0, dy: 0 };
        useEditor.getState().liveUpdate((base) => ops.scaleNodes(base, ids, anchor, sx, sy, off));
      },
      up: () => useEditor.getState().endGesture(),
      cancel: () => useEditor.getState().cancelGesture(),
    });
  }

  function startRotate(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    const st0 = useEditor.getState();
    const n = st0.scene.nodes[id];
    if (!n) return;
    const c = { x: n.x + n.w / 2, y: n.y + n.h / 2 };
    const a0 = Math.atan2(worldOf(e.clientX, e.clientY).y - c.y, worldOf(e.clientX, e.clientY).x - c.x);
    st0.beginGesture();
    gesture(e, {
      move: (ev) => {
        const w = worldOf(ev.clientX, ev.clientY);
        const a = Math.atan2(w.y - c.y, w.x - c.x);
        let rot = normDeg(n.rotation + ((a - a0) * 180) / Math.PI);
        if (ev.shiftKey) rot = Math.round(rot / 15) * 15;
        useEditor.getState().liveUpdate((base) => ops.updateNode(base, id, { rotation: Math.round(rot * 10) / 10 }));
      },
      up: () => useEditor.getState().endGesture(),
      cancel: () => useEditor.getState().cancelGesture(),
    });
  }

  function startMarquee(e: React.PointerEvent, additive: boolean) {
    const r = stageRef.current!.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const base = additive ? useEditor.getState().selection : [];
    gesture(e, {
      move: (ev) => {
        const x = ev.clientX - r.left, y = ev.clientY - r.top;
        const m = { x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
        setMarquee(m);
        const st = useEditor.getState();
        const a = toWorld(st.viewport, m.x, m.y), b = toWorld(st.viewport, m.x + m.w, m.y + m.h);
        const wr = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
        const hit = new Set<string>();
        for (const id of ops.paintOrder(st.scene)) {
          if (ops.isEffectivelyLocked(st.scene, id) || ops.isEffectivelyHidden(st.scene, id)) continue;
          if (rectsIntersect(wr, aabb(st.scene.nodes[id]))) hit.add(ops.topAncestor(st.scene, id));
        }
        st.select([...new Set([...base, ...hit])]);
      },
      up: () => setMarquee(null),
      cancel: () => setMarquee(null),
    });
  }

  function startCreate(e: React.PointerEvent) {
    const type = useEditor.getState().tool as Exclude<NodeType, 'group'>;
    const def = ELEMENT_BY_TYPE[type];
    if (!def) return;
    const st0 = useEditor.getState();
    const snapV = (v: number) => (st0.settings.grid && st0.settings.snap ? Math.round(v / st0.settings.gridSize) * st0.settings.gridSize : Math.round(v));
    const a = worldOf(e.clientX, e.clientY);
    const start = { x: snapV(a.x), y: snapV(a.y) };
    let rect: Rect | null = null;
    gesture(e, {
      move: (ev) => {
        const b = worldOf(ev.clientX, ev.clientY);
        let w = snapV(b.x) - start.x, h = snapV(b.y) - start.y;
        if (ev.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
        rect = { x: Math.min(start.x, start.x + w), y: Math.min(start.y, start.y + h), w: Math.abs(w), h: Math.abs(h) };
        setCreating(rect);
      },
      up: (_ev, moved) => {
        setCreating(null);
        const st = useEditor.getState();
        const big = moved && rect && rect.w >= 8 && rect.h >= 8;
        const id = st.addElement(type, big ? { x: rect!.x, y: rect!.y } : start, big ? { w: rect!.w, h: rect!.h } : undefined);
        if (type === 'text') st.setEditingText(id);
        if (type === 'image') { pendingImage.current = id; fileRef.current?.click(); }
      },
      cancel: () => setCreating(null),
    });
  }

  /* ───────── eventos do stage ───────── */
  const onPointerDown = (e: React.PointerEvent) => {
    const st = useEditor.getState();
    if ((e.target as HTMLElement).closest('[data-handle]')) return;
    const wantsPan = e.button === 1 || (e.button === 0 && (runtime.space || st.tool === 'hand'));
    if (wantsPan) return startPan(e);
    if (e.button !== 0) return;

    if (st.mode === 'play') {
      if (!(e.target as HTMLElement).closest(INTERACTIVE)) startPan(e);
      return;
    }
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (st.editingTextId) return;
    if (st.tool !== 'select') return startCreate(e);

    // procura o elemento mais acima que não esteja travado nem oculto
    let hit: string | undefined;
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      const id = (el as HTMLElement).dataset?.nodeId;
      if (id && st.scene.nodes[id] && !ops.isEffectivelyLocked(st.scene, id) && !ops.isEffectivelyHidden(st.scene, id)) { hit = id; break; }
    }
    if (!hit) {
      if (!e.shiftKey) st.select([]);
      return startMarquee(e, e.shiftKey);
    }
    const target = ops.topAncestor(st.scene, hit);
    const sel = st.selection;
    if (e.shiftKey) {
      st.toggleSelect(target);
      if (sel.includes(target)) return; // apenas removeu da seleção
    } else if (!sel.includes(target)) {
      st.select([target]);
    }
    startMove(e, useEditor.getState().selection);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const st = useEditor.getState();
    if (st.mode !== 'edit' || st.tool !== 'select') return;
    let hit: string | undefined;
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      const id = (el as HTMLElement).dataset?.nodeId;
      if (id && st.scene.nodes[id] && !ops.isEffectivelyLocked(st.scene, id)) { hit = id; break; }
    }
    if (!hit) return;
    const chain: string[] = [];
    for (let cur: string | null = hit; cur; cur = st.scene.nodes[cur]?.parentId ?? null) chain.push(cur);
    // entra no grupo: seleciona o filho que contém o ponto
    const gi = chain.findIndex((id) => st.selection.includes(id) && st.scene.nodes[id].type === 'group');
    if (gi > 0) return st.select([chain[gi - 1]]);
    if (chain.length > 1 && !st.selection.includes(hit)) return st.select([chain[chain.length - 2]]);
    const n = st.scene.nodes[hit];
    if (n.type === 'text') { st.select([hit]); st.setEditingText(hit); }
    if (n.type === 'image') { pendingImage.current = hit; fileRef.current?.click(); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length || useEditor.getState().mode !== 'edit') return;
    const w = worldOf(e.clientX, e.clientY);
    files.forEach((f, i) => void addImageFromFile(f, { x: w.x + i * 24, y: w.y + i * 24 }));
  };

  /* ───────── desenho ───────── */
  const k = 1 / vp.zoom;
  const leaves = useMemo(() => ops.paintOrder(scene), [scene]);
  const effOpacity = (id: string) => {
    let o = 1;
    for (let n = scene.nodes[id]; n; n = n.parentId ? scene.nodes[n.parentId] : (undefined as never)) o *= n.opacity;
    return o;
  };

  const gridSize = settings.gridSize * Math.ceil(6 / (settings.gridSize * vp.zoom));
  const stageStyle: CSSProperties = {
    cursor: panning ? 'grabbing' : space || tool === 'hand' ? 'grab' : mode === 'edit' && tool !== 'select' ? 'crosshair' : 'default',
    backgroundImage: settings.grid && mode === 'edit' ? 'radial-gradient(circle, rgba(255,255,255,.14) 1px, transparent 1.2px)' : undefined,
    backgroundSize: `${gridSize * vp.zoom}px ${gridSize * vp.zoom}px`,
    backgroundPosition: `${vp.x}px ${vp.y}px`,
  };

  return (
    <div
      ref={stageRef}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-g-900"
      style={stageStyle}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`, transformOrigin: '0 0' }}>
        {scene.page.visible && (
          <div
            data-page
            style={{ position: 'absolute', left: scene.page.x, top: scene.page.y, width: scene.page.w, height: scene.page.h, background: scene.page.bg, boxShadow: `0 0 0 ${k}px rgba(255,255,255,.08), 0 10px 40px rgba(0,0,0,.45)` }}
          />
        )}
        {leaves.map((id) => {
          const n = scene.nodes[id];
          if (ops.isEffectivelyHidden(scene, id)) return null;
          return <NodeView key={id} node={n} ctx={ctx} opacity={effOpacity(id)} />;
        })}

        {mode === 'edit' && (
          <SelectionOverlay k={k} onResize={startResize} onRotate={startRotate} />
        )}

        {guides.map((g, i) => (
          <div key={i} style={{
            position: 'absolute', background: '#ff4fa3', pointerEvents: 'none',
            ...(g.axis === 'x' ? { left: g.pos - k / 2, top: g.from, width: k, height: g.to - g.from } : { top: g.pos - k / 2, left: g.from, height: k, width: g.to - g.from }),
          }} />
        ))}

        {creating && (
          <div style={{ position: 'absolute', left: creating.x, top: creating.y, width: creating.w, height: creating.h, border: `${k}px dashed var(--accent-hex)`, background: 'rgb(var(--accent) / .1)', pointerEvents: 'none' }} />
        )}
      </div>

      {marquee && (
        <div style={{ position: 'absolute', left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, border: '1px solid var(--accent-hex)', background: 'rgb(var(--accent) / .12)', pointerEvents: 'none' }} />
      )}
      {dragOver && <div className="pointer-events-none absolute inset-2 rounded-lg border-2 border-dashed border-accent bg-accent-soft" />}

      {settings.rulers && mode === 'edit' && <Rulers w={size.w} h={size.h} />}

      <ZoomControls />
      {mode === 'play' && <RollToast />}

      <input
        ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const id = pendingImage.current;
          pendingImage.current = null;
          e.target.value = '';
          if (f && id) void setImageFile(id, f);
        }}
      />
    </div>
  );
}

/* ─────────────────────────── seleção ─────────────────────────── */
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
const cursorFor = (h: Handle, rot: number) => {
  const ang = ((Math.atan2(h.hy, h.hx) * 180) / Math.PI + rot + 720) % 180;
  return CURSORS[Math.round(ang / 45) % 4];
};

function SelectionOverlay({ k, onResize, onRotate }: {
  k: number;
  onResize: (e: React.PointerEvent, h: Handle) => void;
  onRotate: (e: React.PointerEvent, id: string) => void;
}) {
  const scene = useEditor((s) => s.scene);
  const selection = useEditor((s) => s.selection);
  const editing = useEditor((s) => s.editingTextId);
  const nodes = selection.map((id) => scene.nodes[id]).filter(Boolean);
  if (!nodes.length) return null;

  const outline = (n: (typeof nodes)[number], dashed = false): CSSProperties => ({
    position: 'absolute', left: n.x, top: n.y, width: n.w, height: n.h,
    transform: n.rotation ? `rotate(${n.rotation}deg)` : undefined, pointerEvents: 'none',
    outline: `${1.5 * k}px ${dashed ? 'dashed' : 'solid'} var(--accent-hex)`, outlineOffset: 0,
  });

  const unlocked = nodes.filter((n) => !ops.isEffectivelyLocked(scene, n.id));
  const single = nodes.length === 1 && nodes[0].type !== 'group' ? nodes[0] : null;
  const rect = single ? { x: single.x, y: single.y, w: single.w, h: single.h } : ops.selectionRect(scene, selection)!;
  const rot = single?.rotation ?? 0;
  const canTransform = unlocked.length === nodes.length && !editing;

  const hs = 9 * k;
  const handleStyle = (h: Handle): CSSProperties => ({
    position: 'absolute', width: hs, height: hs, background: '#fff', border: `${1.5 * k}px solid var(--accent-hex)`, borderRadius: 2 * k,
    left: h.hx === -1 ? 0 : h.hx === 0 ? '50%' : '100%', top: h.hy === -1 ? 0 : h.hy === 0 ? '50%' : '100%',
    transform: 'translate(-50%, -50%)', cursor: cursorFor(h, rot), pointerEvents: 'auto', touchAction: 'none',
  });

  return (
    <>
      {/* contorno individual de cada selecionado (grupos: tracejado) */}
      {nodes.map((n) => (n.type === 'group'
        ? <div key={n.id} style={outline(n, true)} />
        : selection.length > 1 || ops.isEffectivelyLocked(scene, n.id) ? <div key={n.id} style={outline(n, ops.isEffectivelyLocked(scene, n.id))} /> : null))}

      {canTransform && (
        <div style={{
          position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h,
          transform: rot ? `rotate(${rot}deg)` : undefined, pointerEvents: 'none',
          outline: single ? `${1.5 * k}px solid var(--accent-hex)` : `${1 * k}px solid rgb(var(--accent) / .7)`,
        }}>
          {HANDLES.map((h) => (
            <div key={`${h.hx}${h.hy}`} data-handle style={handleStyle(h)} onPointerDown={(e) => onResize(e, h)} />
          ))}
          {single && (
            <>
              <div style={{ position: 'absolute', left: '50%', top: -22 * k, width: k, height: 22 * k, background: 'var(--accent-hex)', pointerEvents: 'none' }} />
              <div
                data-handle title="Girar (Shift = 15°)"
                onPointerDown={(e) => onRotate(e, single.id)}
                style={{ position: 'absolute', left: '50%', top: -30 * k, width: 11 * k, height: 11 * k, transform: 'translate(-50%, -50%)', borderRadius: '50%', background: '#fff', border: `${1.5 * k}px solid var(--accent-hex)`, cursor: 'grab', pointerEvents: 'auto', touchAction: 'none' }}
              />
            </>
          )}
          <div style={{
            position: 'absolute', left: '50%', top: `calc(100% + ${14 * k}px)`, transform: `translateX(-50%) ${rot ? `rotate(${-rot}deg)` : ''}`,
            fontSize: 11 * k, lineHeight: 1.2, whiteSpace: 'nowrap', background: 'var(--accent-hex)', color: '#fff', padding: `${2 * k}px ${6 * k}px`, borderRadius: 4 * k, pointerEvents: 'none', fontFamily: 'Inter, sans-serif',
          }}>
            {Math.round(rect.w)} × {Math.round(rect.h)}{rot ? ` · ${Math.round(rot)}°` : ''}
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────── réguas ─────────────────────────── */
const RULER = 20;
function Rulers({ w, h }: { w: number; h: number }) {
  const vp = useEditor((s) => s.viewport);
  const step = niceStep(vp.zoom, 80);
  const minor = step / 5;
  const showMinor = minor * vp.zoom >= 7;

  const ticks = (len: number, offset: number) => {
    const a = -offset / vp.zoom, b = (len - offset) / vp.zoom;
    const out: { pos: number; major: boolean; label: string }[] = [];
    const s = showMinor ? minor : step;
    for (let v = Math.floor(a / s) * s; v <= b; v += s) {
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      out.push({ pos: v * vp.zoom + offset, major, label: major ? String(Math.round(v * 100) / 100) : '' });
      if (out.length > 600) break;
    }
    return out;
  };
  const tx = ticks(w, vp.x), ty = ticks(h, vp.y);
  const col = 'rgb(var(--g-400))';
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <svg width={w} height={RULER} style={{ position: 'absolute', left: 0, top: 0, background: 'rgb(var(--g-850))', borderBottom: '1px solid rgb(var(--g-700))' }}>
        {tx.map((t, i) => (
          <g key={i}>
            <line x1={t.pos} x2={t.pos} y1={t.major ? 8 : 14} y2={RULER} stroke={col} strokeWidth={1} />
            {t.label && <text x={t.pos + 3} y={9} fontSize={9} fill="rgb(var(--g-400))" fontFamily="Inter, sans-serif">{t.label}</text>}
          </g>
        ))}
      </svg>
      <svg width={RULER} height={h} style={{ position: 'absolute', left: 0, top: 0, background: 'rgb(var(--g-850))', borderRight: '1px solid rgb(var(--g-700))' }}>
        {ty.map((t, i) => (
          <g key={i}>
            <line y1={t.pos} y2={t.pos} x1={t.major ? 8 : 14} x2={RULER} stroke={col} strokeWidth={1} />
            {t.label && <text transform={`translate(9 ${t.pos - 3}) rotate(-90)`} fontSize={9} fill="rgb(var(--g-400))" fontFamily="Inter, sans-serif">{t.label}</text>}
          </g>
        ))}
      </svg>
      <div style={{ position: 'absolute', left: 0, top: 0, width: RULER, height: RULER, background: 'rgb(var(--g-850))', borderRight: '1px solid rgb(var(--g-700))', borderBottom: '1px solid rgb(var(--g-700))' }} />
    </div>
  );
}

function ZoomControls() {
  const vp = useEditor((s) => s.viewport);
  const zoomBy = (f: number) => {
    const st = useEditor.getState();
    st.setViewport(zoomAt(st.viewport, clampZoom(st.viewport.zoom * f), runtime.stage.w / 2, runtime.stage.h / 2));
  };
  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg border border-g-700 bg-g-850/95 p-0.5 shadow-lg backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
      <button className="icon-btn" title="Reduzir (Ctrl −)" onClick={() => zoomBy(1 / 1.25)}><Icon name="minus" size={14} /></button>
      <button className="h-7 min-w-[52px] rounded-md px-1 text-xs tabular-nums text-g-200 hover:bg-g-750" title="Zoom 100% (Ctrl 0)"
        onClick={() => { const st = useEditor.getState(); st.setViewport(zoomAt(st.viewport, 1, runtime.stage.w / 2, runtime.stage.h / 2)); }}>
        {Math.round(vp.zoom * 100)}%
      </button>
      <button className="icon-btn" title="Aumentar (Ctrl +)" onClick={() => zoomBy(1.25)}><Icon name="plus" size={14} /></button>
      <button className="icon-btn" title="Enquadrar tudo (Ctrl 1)" onClick={() => window.dispatchEvent(new Event('rpg:fit'))}><Icon name="search" size={14} /></button>
    </div>
  );
}

/** Resultado da última rolagem, em destaque por alguns segundos. */
function RollToast() {
  const last = useEditor((s) => s.rolls[0]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  if (!last || now - last.at > 6000) return null;
  return (
    <div key={last.id} className="anim-in pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-accent/50 bg-g-850/95 px-5 py-3 text-center shadow-2xl backdrop-blur">
      <div className="text-xs text-g-400">{last.label}</div>
      {last.ok ? (
        <>
          <div className="font-display text-3xl font-bold text-accent">{last.total}</div>
          <div className="mt-0.5 font-mono text-xs text-g-300">{last.text}</div>
        </>
      ) : <div className="max-w-xs text-sm text-red-300">{last.error}</div>}
    </div>
  );
}
