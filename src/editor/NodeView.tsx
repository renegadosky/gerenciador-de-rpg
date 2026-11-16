import { CSSProperties, memo, useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { formatNumber, hasTemplate, interpolate, toNumberSafe, truthy } from '../lib/format';
import type { PlayState, SceneNode, Value, Variable } from '../types';
import { Computed, nodeVarId } from './compute';

export interface RenderCtx {
  mode: 'edit' | 'play';
  vars: Record<string, Variable>;
  computed: Computed;
  play: PlayState;
  lookup: (name: string) => Value | undefined;
  setPlayVar: (id: string, v: Value) => void;
  setPlayNode: (id: string, v: unknown) => void;
  editingTextId: string | null;
  onTextCommit: (id: string, text: string) => void;
  setPlayImage: (id: string, file: File) => void;
  roll: (label: string, expr: string, storeInVar?: string) => void;
}

const px = (n: number | undefined) => (n === undefined ? undefined : `${n}px`);

/** Valor e permissões de um campo, vinculado ou não a uma variável. */
function fieldState(node: SceneNode, ctx: RenderCtx) {
  const bind: string = node.data.bind || '';
  const v = bind ? ctx.vars[bind] : undefined;
  const play = ctx.mode === 'play';
  if (v) {
    const isFormula = ctx.computed.isFormula.has(v.id);
    const value = ctx.computed.byId[v.id];
    return {
      bound: true, variable: v, value, error: ctx.computed.errorById[v.id],
      editable: play && !isFormula && node.data.editable !== false,
      set: (x: Value) => ctx.setPlayVar(v.id, x),
    };
  }
  if (typeof node.data.formula === 'string' && node.data.formula.trim()) {
    const id = nodeVarId(node.id);
    return {
      bound: false, variable: undefined, value: ctx.computed.byId[id], error: ctx.computed.errorById[id],
      editable: false, set: (_x: Value) => {},
    };
  }
  const stored = ctx.play.nodes[node.id];
  const value = (play && stored !== undefined ? stored : node.data.initial) as Value | undefined;
  return {
    bound: false, variable: undefined, value, error: undefined as string | undefined,
    editable: play && node.data.editable !== false,
    set: (x: Value) => ctx.setPlayNode(node.id, x),
  };
}

export const NodeView = memo(function NodeView({ node, ctx, opacity }: { node: SceneNode; ctx: RenderCtx; opacity: number }) {
  const s = node.style;
  const play = ctx.mode === 'play';
  const base: CSSProperties = {
    position: 'absolute', left: node.x, top: node.y, width: node.w, height: node.h,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    opacity, boxSizing: 'border-box',
    userSelect: play ? undefined : 'none',
    filter: s.shadow ? 'drop-shadow(0 4px 10px rgba(0,0,0,.45))' : undefined,
  };
  const inner: CSSProperties = { width: '100%', height: '100%', pointerEvents: play ? 'auto' : 'none' };
  const border = s.stroke && s.strokeWidth ? `${s.strokeWidth}px solid ${s.stroke}` : undefined;
  const txt: CSSProperties = {
    color: s.color, fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight,
    fontStyle: s.italic ? 'italic' : undefined, textDecoration: s.underline ? 'underline' : undefined,
    textAlign: s.align, lineHeight: s.lineHeight, letterSpacing: px(s.letterSpacing),
  };

  const wrap = (children: React.ReactNode) => (
    <div data-node-id={node.id} data-type={node.type} style={base}>{children}</div>
  );

  switch (node.type) {
    case 'text': {
      const raw: string = node.data.text ?? '';
      if (ctx.editingTextId === node.id && !play) {
        return wrap(
          <TextEditor value={raw} style={{ ...txt, width: '100%', height: '100%' }} onCommit={(t) => ctx.onTextCommit(node.id, t)} />,
        );
      }
      const justify = s.valign === 'middle' ? 'center' : s.valign === 'bottom' ? 'flex-end' : 'flex-start';
      return wrap(
        <div style={{ ...inner, ...txt, display: 'flex', flexDirection: 'column', justifyContent: justify, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflow: 'hidden' }}>
          <div>{interpolate(raw, ctx.lookup)}</div>
        </div>,
      );
    }

    case 'image': {
      const stored = ctx.play.nodes[node.id];
      const src: string = play && typeof stored === 'string' && stored ? stored : node.data.src;
      const canEdit = play && !!node.data.playerEditable;
      const content = src ? (
        <img src={src} alt={node.name} draggable={false}
          style={{ width: '100%', height: '100%', objectFit: node.data.fit ?? 'cover', borderRadius: s.radius, border, display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', border: '1.5px dashed #55555f', borderRadius: s.radius ?? 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a7a86', flexDirection: 'column', gap: 6, fontSize: 12, background: 'rgba(255,255,255,.02)', boxSizing: 'border-box' }}>
          <Icon name="image" size={Math.min(32, node.w / 3, node.h / 3)} />
          {node.h > 70 && <span>{canEdit ? 'Clique para adicionar' : 'Sem imagem'}</span>}
        </div>
      );
      if (!canEdit) return wrap(<div style={inner}>{content}</div>);
      return wrap(
        <label style={{ ...inner, display: 'block', position: 'relative', cursor: 'pointer' }} title="Clique para trocar a imagem">
          {content}
          <span style={{ position: 'absolute', right: 6, bottom: 6, background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: 6, padding: '2px 6px', fontSize: 11, pointerEvents: 'none' }}>trocar</span>
          <input type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) ctx.setPlayImage(node.id, f); }} />
        </label>,
      );
    }

    case 'box':
      return wrap(<div style={{ ...inner, background: s.fill, border, borderRadius: s.radius }} />);

    case 'shape':
      return wrap(<ShapeSvg node={node} />);

    case 'icon':
      return wrap(
        <div style={{ ...inner, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
          <Icon name={node.data.icon || 'star'} size={Math.min(node.w, node.h)} strokeWidth={s.strokeWidth ?? 2} />
        </div>,
      );

    case 'number': {
      const f = fieldState(node, ctx);
      return wrap(<NumberBox node={node} f={f} txt={txt} border={border} inner={inner} />);
    }

    case 'input': {
      const f = fieldState(node, ctx);
      const value = typeof f.value === 'string' ? f.value : f.value === undefined ? '' : String(f.value);
      const common = {
        value, disabled: !f.editable, placeholder: node.data.placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => f.set(e.target.value),
        style: { ...inner, ...txt, background: s.fill, border, borderRadius: s.radius, padding: '0 10px', outline: 'none', resize: 'none' as const, boxSizing: 'border-box' as const },
        onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
      };
      return wrap(node.data.multiline
        ? <textarea {...common} style={{ ...common.style, padding: '8px 10px' }} />
        : <input {...common} type="text" />);
    }

    case 'select': {
      const f = fieldState(node, ctx);
      const opts: string[] = node.data.options ?? [];
      const value = f.value === undefined ? '' : String(f.value);
      return wrap(
        <select
          value={value} disabled={!f.editable}
          onChange={(e) => f.set(e.target.value)}
          style={{ ...inner, ...txt, background: s.fill, border, borderRadius: s.radius, padding: '0 8px', outline: 'none', appearance: 'auto' }}
        >
          <option value="">—</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
          {value && !opts.includes(value) && <option value={value}>{value}</option>}
        </select>,
      );
    }

    case 'progress': {
      const bind: string = node.data.bind || '';
      const v = bind ? ctx.vars[bind] : undefined;
      const ownFormula = !v && typeof node.data.formula === 'string' && node.data.formula.trim();
      const value = v ? toNumberSafe(ctx.computed.byId[v.id]) : ownFormula ? toNumberSafe(ctx.computed.byId[nodeVarId(node.id)]) : toNumberSafe(node.data.initial);
      const maxVar = node.data.maxBind ? ctx.vars[node.data.maxBind] : undefined;
      const max = maxVar ? toNumberSafe(ctx.computed.byId[maxVar.id], 1) : toNumberSafe(node.data.max, 100);
      const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
      return wrap(
        <div style={{ ...inner, background: s.fill, border, borderRadius: s.radius, overflow: 'hidden', position: 'relative', pointerEvents: 'none' }}>
          <div style={{ width: `${pct * 100}%`, height: '100%', background: s.color, transition: 'width .25s ease' }} />
          {node.data.showText !== false && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(9, Math.min(14, node.h - 8)), fontWeight: 600, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)', fontFamily: 'Inter, sans-serif' }}>
              {formatNumber(value)} / {formatNumber(max)}
            </div>
          )}
        </div>,
      );
    }

    case 'indicator': {
      const f = fieldState(node, ctx);
      const on = truthy(f.value);
      const toggle = () => {
        if (!f.editable) return;
        f.set(f.variable && f.variable.type === 'number' ? (on ? 0 : 1) : !on);
      };
      const shape = node.data.shape === 'rect' ? { borderRadius: s.radius ?? 4 } : { borderRadius: '50%' };
      return wrap(
        <div
          onClick={toggle} role={f.editable ? 'switch' : undefined} aria-checked={f.editable ? on : undefined}
          style={{ ...inner, ...shape, background: on ? s.color : s.fill, border, boxSizing: 'border-box', cursor: f.editable ? 'pointer' : 'default', transition: 'background .15s', boxShadow: on ? `0 0 10px ${s.color}80` : undefined }}
        />,
      );
    }

    case 'button': {
      const f = fieldState(node, ctx);
      const action: string = node.data.action || 'none';
      const v = f.variable;
      const isRoll = action === 'roll';
      const blocked = !play || action === 'none' || (isRoll ? !String(node.data.roll ?? '').trim() : !v || ctx.computed.isFormula.has(v.id));
      const click = () => {
        if (isRoll) {
          if (!blocked) ctx.roll(node.data.rollLabel || node.data.text || 'Rolagem', node.data.roll, node.data.rollStore && v && !ctx.computed.isFormula.has(v.id) ? v.id : undefined);
          return;
        }
        if (blocked || !v) return;
        const cur = ctx.computed.byId[v.id];
        const n = toNumberSafe(node.data.actionValue, 1);
        if (action === 'inc') ctx.setPlayVar(v.id, toNumberSafe(cur) + n);
        if (action === 'dec') ctx.setPlayVar(v.id, toNumberSafe(cur) - n);
        if (action === 'set') ctx.setPlayVar(v.id, v.type === 'number' ? n : String(node.data.actionValue ?? ''));
        if (action === 'toggle') ctx.setPlayVar(v.id, v.type === 'number' ? (truthy(cur) ? 0 : 1) : !truthy(cur));
      };
      return wrap(
        <button
          onClick={click} disabled={play && action !== 'none' && blocked}
          style={{ ...inner, ...txt, background: s.fill, border, borderRadius: s.radius, cursor: play && !blocked ? 'pointer' : 'default', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {interpolate(node.data.text ?? '', ctx.lookup)}
        </button>,
      );
    }

    case 'list': {
      const stored = ctx.play.nodes[node.id];
      const items: string[] = play && Array.isArray(stored) ? (stored as string[]) : node.data.items ?? [];
      const Tag = node.data.ordered ? 'ol' : 'ul';
      if (play && node.data.editableInPlay !== false) {
        return wrap(
          <div style={{ ...inner, ...txt, overflow: 'auto', padding: 2 }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ opacity: 0.6, minWidth: 14 }}>{node.data.ordered ? `${i + 1}.` : '•'}</span>
                <input value={it} onKeyDown={(e) => e.stopPropagation()}
                  onChange={(e) => ctx.setPlayNode(node.id, items.map((x, j) => (j === i ? e.target.value : x)))}
                  style={{ ...txt, flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.12)', outline: 'none', minWidth: 0 }} />
                <button title="Remover" onClick={() => ctx.setPlayNode(node.id, items.filter((_, j) => j !== i))} style={{ opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button>
              </div>
            ))}
            <button onClick={() => ctx.setPlayNode(node.id, [...items, ''])} style={{ opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: Math.max(11, (s.fontSize ?? 14) - 2) }}>+ adicionar</button>
          </div>,
        );
      }
      return wrap(
        <Tag style={{ ...inner, ...txt, margin: 0, paddingLeft: 20, overflow: 'hidden', listStyleType: node.data.ordered ? 'decimal' : 'disc' }}>
          {items.map((it, i) => <li key={i}>{interpolate(it, ctx.lookup)}</li>)}
        </Tag>,
      );
    }

    case 'table': {
      const stored = ctx.play.nodes[node.id];
      const rows: string[][] = play && Array.isArray(stored) ? (stored as string[][]) : node.data.rows ?? [[]];
      const header = node.data.header !== false;
      const growable = play && !!node.data.rowsEditable;
      const cols = rows[0]?.length ?? 1;
      return wrap(
        <div style={{ ...inner, border, borderRadius: s.radius, overflow: growable ? 'auto' : 'hidden', background: s.fill }}>
          <table className="rpg-table" style={{ ...txt, width: '100%', height: growable ? undefined : '100%', borderCollapse: 'collapse', tableLayout: 'fixed', ['--tb' as any]: s.stroke || '#3c3c45' }}>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} style={ri === 0 && header ? { background: 'rgba(255,255,255,.06)', fontWeight: 600 } : undefined}>
                  {r.map((c, ci) => (
                    <td key={ci} style={{ overflow: 'hidden', padding: 0 }}>
                      {play && !(ri === 0 && header) ? (
                        <Cell value={c} lookup={ctx.lookup} txt={txt}
                          onChange={(t) => ctx.setPlayNode(node.id, rows.map((rr, i) => (i === ri ? rr.map((x, j) => (j === ci ? t : x)) : rr)))} />
                      ) : <div style={{ padding: '4px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{interpolate(c, ctx.lookup)}</div>}
                    </td>
                  ))}
                  {growable && !(ri === 0 && header) && (
                    <td style={{ width: 22, padding: 0, border: 'none' }}>
                      <button title="Remover linha" onClick={() => ctx.setPlayNode(node.id, rows.filter((_, i) => i !== ri))}
                        style={{ opacity: 0.45, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', width: 22 }}>×</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {growable && (
            <button onClick={() => ctx.setPlayNode(node.id, [...rows, Array.from({ length: cols }, () => '')])}
              style={{ ...txt, width: '100%', padding: '6px 0', opacity: 0.65, background: 'none', border: 'none', borderTop: `1px solid ${s.stroke || '#3c3c45'}`, cursor: 'pointer', color: 'inherit', fontSize: Math.max(11, (s.fontSize ?? 14) - 1) }}>
              + adicionar linha
            </button>
          )}
        </div>,
      );
    }

    default:
      return null;
  }
});

function Cell({ value, onChange, lookup, txt }: { value: string; onChange: (t: string) => void; lookup: RenderCtx['lookup']; txt: CSSProperties }) {
  const [focus, setFocus] = useState(false);
  const template = hasTemplate(value);
  return (
    <input
      value={template && !focus ? interpolate(value, lookup) : value}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.stopPropagation()}
      style={{ ...txt, width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '4px 8px', boxSizing: 'border-box' }}
    />
  );
}

function TextEditor({ value, style, onCommit }: { value: string; style: CSSProperties; onCommit: (t: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <textarea
      ref={ref} defaultValue={value}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { (e.target as HTMLTextAreaElement).value = value; ref.current?.blur(); } }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ ...style, background: 'rgb(var(--accent) / .12)', border: 'none', outline: '1px solid var(--accent-hex)', resize: 'none', padding: 0, overflow: 'hidden', pointerEvents: 'auto' }}
    />
  );
}

function NumberBox({ node, f, txt, border, inner }: {
  node: SceneNode; f: ReturnType<typeof fieldState>; txt: CSSProperties; border: string | undefined; inner: CSSProperties;
}) {
  const s = node.style, d = node.data;
  const [focus, setFocus] = useState(false);
  const [draft, setDraft] = useState('');
  const num = toNumberSafe(f.value);
  const min = d.min === '' || d.min === undefined ? -Infinity : Number(d.min);
  const max = d.max === '' || d.max === undefined ? Infinity : Number(d.max);
  const shown = `${d.prefix ?? ''}${f.value === undefined ? '—' : formatNumber(num, d.decimals)}${d.suffix ?? ''}`;
  const commit = () => {
    setFocus(false);
    const n = parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(n)) f.set(Math.min(max, Math.max(min, n)));
  };
  const step = (dir: number) => f.set(Math.min(max, Math.max(min, num + dir * (Number(d.step) || 1))));
  return (
    <div style={{ ...inner, background: s.fill, border, borderRadius: s.radius, display: 'flex', alignItems: 'stretch', overflow: 'hidden', boxSizing: 'border-box' }} title={f.error}>
      {f.editable && (
        <button tabIndex={-1} onClick={() => step(-1)} style={{ width: Math.min(24, node.w / 4), background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.55, fontSize: 16 }} aria-label="Diminuir">−</button>
      )}
      {focus && f.editable ? (
        <input
          autoFocus value={draft} inputMode="decimal"
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setFocus(false); }}
          style={{ ...txt, flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none' }}
        />
      ) : (
        <div
          onClick={() => { if (f.editable) { setDraft(String(num).replace('.', ',')); setFocus(true); } }}
          style={{ ...txt, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center', padding: '0 6px', cursor: f.editable ? 'text' : 'default', whiteSpace: 'nowrap', overflow: 'hidden', color: f.error ? '#ff8a8a' : s.color }}
        >
          {f.error ? '⚠' : shown}
        </div>
      )}
      {f.editable && (
        <button tabIndex={-1} onClick={() => step(1)} style={{ width: Math.min(24, node.w / 4), background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.55, fontSize: 16 }} aria-label="Aumentar">+</button>
      )}
    </div>
  );
}

function ShapeSvg({ node }: { node: SceneNode }) {
  const { w, h, style: s } = node;
  const sw = s.strokeWidth ?? 0;
  const common = { fill: s.fill || 'none', stroke: s.stroke || 'none', strokeWidth: sw, vectorEffect: 'non-scaling-stroke' as const };
  let el: React.ReactNode;
  switch (node.data.shape) {
    case 'ellipse': el = <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - sw / 2} ry={h / 2 - sw / 2} {...common} />; break;
    case 'triangle': el = <polygon points={`${w / 2},${sw / 2} ${w - sw / 2},${h - sw / 2} ${sw / 2},${h - sw / 2}`} {...common} strokeLinejoin="round" />; break;
    case 'diamond': el = <polygon points={`${w / 2},${sw / 2} ${w - sw / 2},${h / 2} ${w / 2},${h - sw / 2} ${sw / 2},${h / 2}`} {...common} strokeLinejoin="round" />; break;
    case 'line': el = <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={s.stroke || s.fill || '#fff'} strokeWidth={Math.max(1, sw || 2)} strokeLinecap="round" vectorEffect="non-scaling-stroke" />; break;
    default: el = <rect x={sw / 2} y={sw / 2} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} rx={s.radius ?? 0} {...common} />;
  }
  return <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}>{el}</svg>;
}
