import { ReactNode, useMemo, useRef } from 'react';
import { ColorField, CommitInput, NumberField } from '../components/ui';
import { FormulaEditor } from '../components/FormulaEditor';
import { Icon, USER_ICONS } from '../components/Icon';
import { computeVariables, nodeFormulaVars, nodeVarId } from './compute';
import { nameProblem } from '../engine/formula';
import { useEditor } from '../stores/editor';
import { newVariable, useRules } from '../stores/rules';
import type { NodeStyle, SceneNode, Variable } from '../types';
import { setImageFile } from './imageActions';
import * as ops from './sceneOps';

const FONTS = ['Inter', 'Merriweather', 'Cinzel', 'Bebas Neue', 'Oswald', 'Caveat', 'JetBrains Mono', 'Georgia', 'Arial', 'Courier New'];

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="border-b border-g-700 pb-2">
    <div className="section-title">{title}</div>
    {children}
  </div>
);
const Row = ({ label, children }: { label?: string; children: ReactNode }) => (
  <div className="row">{label !== undefined && <span className="label">{label}</span>}<div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div></div>
);
const Seg = ({ value, options, onChange }: { value: string | undefined; options: { v: string; icon?: string; text?: string; title?: string }[]; onChange: (v: string) => void }) => (
  <div className="flex rounded-md border border-g-700 p-0.5">
    {options.map((o) => (
      <button key={o.v} title={o.title} data-active={value === o.v} className="icon-btn !h-6 !w-auto min-w-6 px-1.5 text-xs" onClick={() => onChange(o.v)}>
        {o.icon ? <Icon name={o.icon} size={13} /> : o.text}
      </button>
    ))}
  </div>
);

export function PropertiesPanel() {
  const selection = useEditor((s) => s.selection);
  const scene = useEditor((s) => s.scene);
  const nodes = selection.map((id) => scene.nodes[id]).filter(Boolean) as SceneNode[];
  return (
    <aside className="flex w-[264px] shrink-0 flex-col overflow-y-auto border-l border-g-700 bg-g-850">
      {nodes.length === 0 ? <PageProps /> : nodes.length === 1 ? <SingleProps node={nodes[0]} /> : <MultiProps nodes={nodes} />}
    </aside>
  );
}

/* ───────────── página (nada selecionado) ───────────── */
function PageProps() {
  const page = useEditor((s) => s.scene.page);
  const settings = useEditor((s) => s.settings);
  const setSettings = useEditor((s) => s.setSettings);
  const commit = useEditor((s) => s.commit);
  const set = (p: Partial<typeof page>) => commit((s) => ({ ...s, page: { ...s.page, ...p } }), 'page');
  return (
    <>
      <Section title="Página">
        <p className="px-3 pb-1 text-xs text-g-500">Moldura de referência. Os elementos podem ficar dentro ou fora dela.</p>
        <Row label="Largura"><NumberField value={page.w} min={1} onChange={(w) => set({ w })} suffix="px" /></Row>
        <Row label="Altura"><NumberField value={page.h} min={1} onChange={(h) => set({ h })} suffix="px" /></Row>
        <Row label="Fundo"><ColorField value={page.bg} onChange={(bg) => set({ bg })} /></Row>
        <Row label="Exibir"><input type="checkbox" checked={page.visible} onChange={(e) => set({ visible: e.target.checked })} /></Row>
      </Section>
      <Section title="Área de trabalho">
        <Row label="Grade"><input type="checkbox" checked={settings.grid} onChange={(e) => setSettings({ grid: e.target.checked })} /></Row>
        <Row label="Tamanho"><NumberField value={settings.gridSize} min={2} max={200} onChange={(gridSize) => setSettings({ gridSize })} suffix="px" /></Row>
        <Row label="Encaixe"><input type="checkbox" checked={settings.snap} onChange={(e) => setSettings({ snap: e.target.checked })} /></Row>
        <Row label="Guias"><input type="checkbox" checked={settings.guides} onChange={(e) => setSettings({ guides: e.target.checked })} /></Row>
        <Row label="Réguas"><input type="checkbox" checked={settings.rulers} onChange={(e) => setSettings({ rulers: e.target.checked })} /></Row>
      </Section>
      <div className="p-3 text-xs leading-5 text-g-500">
        Selecione um elemento para editar suas propriedades. Segure <b>Espaço</b> e arraste para mover a tela; <b>Ctrl + roda</b> dá zoom; <b>Alt + arrastar</b> duplica; <b>Shift</b> mantém proporção ou trava o eixo.
      </div>
    </>
  );
}

/* ───────────── alinhamento ───────────── */
function AlignRow() {
  const a = useEditor((s) => s.alignSelection);
  const d = useEditor((s) => s.distributeSelection);
  const n = useEditor((s) => s.selection.length);
  const B = ({ icon, title, onClick, disabled }: { icon: string; title: string; onClick: () => void; disabled?: boolean }) =>
    <button className="icon-btn" title={title} onClick={onClick} disabled={disabled}><Icon name={icon} size={15} /></button>;
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 pt-1">
      <B icon="align-start-v" title="Alinhar à esquerda" onClick={() => a('left')} />
      <B icon="align-center-v" title="Centralizar na horizontal" onClick={() => a('hcenter')} />
      <B icon="align-end-v" title="Alinhar à direita" onClick={() => a('right')} />
      <span className="mx-1 h-4 w-px bg-g-700" />
      <B icon="align-start-h" title="Alinhar ao topo" onClick={() => a('top')} />
      <B icon="align-center-h" title="Centralizar na vertical" onClick={() => a('vcenter')} />
      <B icon="align-end-h" title="Alinhar à base" onClick={() => a('bottom')} />
      <span className="mx-1 h-4 w-px bg-g-700" />
      <B icon="space-h" title="Distribuir na horizontal" onClick={() => d('x')} disabled={n < 3} />
      <B icon="space-v" title="Distribuir na vertical" onClick={() => d('y')} disabled={n < 3} />
    </div>
  );
}

function GapRow() {
  const d = useEditor((s) => s.distributeSelection);
  const ref = useRef(16);
  return (
    <Row label="Espaço">
      <NumberField value={ref.current} onChange={(v) => { ref.current = v; }} suffix="px" width={80} />
      <button className="btn !px-2 !py-1 text-xs" onClick={() => d('x', ref.current)} title="Lado a lado com este espaçamento">↔</button>
      <button className="btn !px-2 !py-1 text-xs" onClick={() => d('y', ref.current)} title="Empilhado com este espaçamento">↕</button>
    </Row>
  );
}

/* ───────────── posição e tamanho ───────────── */
function Geometry({ nodes }: { nodes: SceneNode[] }) {
  const scene = useEditor((s) => s.scene);
  const commit = useEditor((s) => s.commit);
  const ids = nodes.map((n) => n.id);
  const single = nodes.length === 1 ? nodes[0] : null;
  const r = single ? { x: single.x, y: single.y, w: single.w, h: single.h } : ops.selectionRect(scene, ids)!;
  const locked = nodes.some((n) => ops.isEffectivelyLocked(scene, n.id));
  const apply = (p: Partial<{ x: number; y: number; w: number; h: number }>) => {
    if (locked) return;
    commit((s) => {
      if (single) {
        let q = { ...p };
        if (single.aspectLocked && single.type !== 'group') {
          if (p.w !== undefined) q.h = Math.max(1, (p.w * single.h) / single.w);
          if (p.h !== undefined) q.w = Math.max(1, (p.h * single.w) / single.h);
        }
        return ops.setRect(s, single.id, q);
      }
      let out = s;
      if (p.x !== undefined || p.y !== undefined) out = ops.moveNodes(out, ids, (p.x ?? r.x) - r.x, (p.y ?? r.y) - r.y);
      if (p.w !== undefined || p.h !== undefined) out = ops.scaleNodes(out, ids, { x: p.x ?? r.x, y: p.y ?? r.y }, p.w ? p.w / r.w : 1, p.h ? p.h / r.h : 1);
      return out;
    }, 'geom');
  };
  return (
    <Section title="Posição e tamanho">
      <AlignRow />
      <div className="grid grid-cols-2 gap-1.5 px-3 pt-2">
        <NumberField label="X" value={r.x} onChange={(x) => apply({ x })} />
        <NumberField label="Y" value={r.y} onChange={(y) => apply({ y })} />
        <NumberField label="L" value={r.w} min={1} onChange={(w) => apply({ w })} />
        <NumberField label="A" value={r.h} min={1} onChange={(h) => apply({ h })} />
        {single && single.type !== 'group' && (
          <>
            <NumberField label="∠" value={single.rotation} suffix="°" step={1} onChange={(rotation) => !locked && commit((s) => ops.updateNode(s, single.id, { rotation: ((rotation % 360) + 540) % 360 - 180 }), 'rot')} />
            <button className="btn justify-start !px-2 text-xs" data-active={single.aspectLocked}
              onClick={() => commit((s) => ops.updateNode(s, single.id, { aspectLocked: !single.aspectLocked }))} title="Manter proporção ao redimensionar">
              <Icon name={single.aspectLocked ? 'lock' : 'unlock'} size={12} /> Proporção
            </button>
          </>
        )}
      </div>
      {nodes.length > 2 && <GapRow />}
      {locked && <p className="px-3 pt-1 text-xs text-amber-400/80">Elemento travado: destrave para mover ou redimensionar.</p>}
    </Section>
  );
}

function MultiProps({ nodes }: { nodes: SceneNode[] }) {
  const commit = useEditor((s) => s.commit);
  const ids = nodes.map((n) => n.id);
  const op = nodes.every((n) => n.opacity === nodes[0].opacity) ? nodes[0].opacity : 1;
  return (
    <>
      <div className="px-3 pt-3 text-sm font-semibold">{nodes.length} elementos selecionados</div>
      <Geometry nodes={nodes} />
      <Section title="Aparência">
        <Row label="Opacid."><NumberField value={Math.round(op * 100)} min={0} max={100} suffix="%" onChange={(v) => commit((s) => ids.reduce((a, id) => ops.updateNode(a, id, { opacity: v / 100 }), s), 'op')} /></Row>
      </Section>
    </>
  );
}

/* ───────────── elemento único ───────────── */
function SingleProps({ node }: { node: SceneNode }) {
  const commit = useEditor((s) => s.commit);
  const reorder = useEditor((s) => s.reorderSelection);
  const upd = (p: Partial<SceneNode>, key?: string) => commit((s) => ops.updateNode(s, node.id, p), key);
  const style = (p: Partial<NodeStyle>, key?: string) => commit((s) => ops.updateStyle(s, node.id, p), key ?? 'st' + Object.keys(p)[0]);
  const data = (p: Record<string, unknown>, key?: string) => commit((s) => ops.updateData(s, node.id, p), key ?? 'd' + Object.keys(p)[0]);
  const t = node.type;
  const s = node.style, d = node.data;
  const hasFill = ['box', 'shape', 'number', 'input', 'select', 'progress', 'indicator', 'button', 'table'].includes(t);
  const hasStroke = ['box', 'shape', 'number', 'input', 'select', 'progress', 'indicator', 'button', 'table', 'image'].includes(t);
  const hasRadius = ['box', 'shape', 'number', 'input', 'select', 'progress', 'button', 'table', 'image'].includes(t);
  const hasText = ['text', 'number', 'input', 'select', 'button', 'list', 'table'].includes(t);

  return (
    <>
      <div className="flex items-center gap-2 px-3 pt-3">
        <Icon name={t === 'group' ? 'group' : 'square'} size={14} className="text-g-400" />
        <CommitInput value={node.name} onCommit={(v) => v.trim() && upd({ name: v.trim() })} className="field !font-semibold" aria-label="Nome do elemento" />
      </div>
      <div className="flex items-center gap-0.5 px-2 pt-1.5">
        <button className="icon-btn" title="Trazer para frente (Ctrl+Shift+])" onClick={() => reorder('front')}><Icon name="front" size={15} /></button>
        <button className="icon-btn" title="Enviar para trás (Ctrl+Shift+[)" onClick={() => reorder('back')}><Icon name="backmost" size={15} /></button>
        <button className="icon-btn" data-active={node.locked} title="Travar (Ctrl+Shift+L)" onClick={() => upd({ locked: !node.locked })}><Icon name={node.locked ? 'lock' : 'unlock'} size={15} /></button>
        <button className="icon-btn" title="Ocultar" onClick={() => upd({ hidden: !node.hidden })}><Icon name={node.hidden ? 'eye-off' : 'eye'} size={15} /></button>
        <button className="icon-btn" title="Duplicar (Ctrl+D)" onClick={() => useEditor.getState().duplicateSelection()}><Icon name="copy" size={15} /></button>
        <button className="icon-btn hover:!text-red-400" title="Excluir (Del)" onClick={() => useEditor.getState().deleteSelection()}><Icon name="trash" size={15} /></button>
      </div>

      <Geometry nodes={[node]} />

      {t !== 'group' && (
        <Section title="Aparência">
          <Row label="Opacid."><NumberField value={Math.round(node.opacity * 100)} min={0} max={100} suffix="%" onChange={(v) => upd({ opacity: v / 100 }, 'op')} /></Row>
          {hasFill && <Row label="Preench."><ColorField value={s.fill} allowEmpty onChange={(v) => style({ fill: v })} /></Row>}
          {hasStroke && <Row label="Borda"><ColorField value={s.stroke} allowEmpty onChange={(v) => style({ stroke: v })} /><NumberField value={s.strokeWidth ?? 0} min={0} step={1} width={56} onChange={(v) => style({ strokeWidth: v })} /></Row>}
          {hasRadius && <Row label="Raio"><NumberField value={s.radius ?? 0} min={0} onChange={(v) => style({ radius: v })} suffix="px" /></Row>}
          <Row label="Sombra"><input type="checkbox" checked={!!s.shadow} onChange={(e) => style({ shadow: e.target.checked })} /></Row>
        </Section>
      )}

      {t === 'text' && (
        <Section title="Conteúdo">
          <div className="px-3">
            <textarea className="field min-h-[64px] resize-y" value={d.text ?? ''} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => data({ text: e.target.value }, 'text')} />
            <p className="mt-1 text-xs text-g-500">Use {'{Nome}'} para mostrar o valor de uma variável, ex.: Defesa: {'{Defesa}'}.</p>
          </div>
        </Section>
      )}
      {hasText && <TextStyle node={node} style={style} />}

      {t === 'image' && (
        <Section title="Imagem">
          <Row>
            <label className="btn cursor-pointer">
              <Icon name="upload" size={13} /> {d.src ? 'Trocar imagem' : 'Escolher imagem'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void setImageFile(node.id, f); }} />
            </label>
            {d.src && <button className="btn btn-danger" onClick={() => data({ src: '' })}>Remover</button>}
          </Row>
          <Row label="Jogador"><label className="flex items-center gap-2 text-xs text-g-300"><input type="checkbox" checked={!!d.playerEditable} onChange={(e) => data({ playerEditable: e.target.checked })} /> pode trocar esta imagem (retrato)</label></Row>
          <Row label="Forma">
            <Seg value={(s.radius ?? 0) >= 999 ? 'c' : 'r'} onChange={(v) => commit((sc) => ops.updateStyle(sc, node.id, { radius: v === 'c' ? 9999 : 0 }))}
              options={[{ v: 'r', text: 'Retangular' }, { v: 'c', text: 'Circular' }]} />
          </Row>
          <Row label="Ajuste">
            <select className="field" value={d.fit ?? 'cover'} onChange={(e) => data({ fit: e.target.value })}>
              <option value="cover">Preencher (cortar)</option><option value="contain">Conter (inteira)</option><option value="fill">Esticar</option><option value="none">Tamanho original</option>
            </select>
          </Row>
        </Section>
      )}

      {t === 'shape' && (
        <Section title="Forma">
          <Row label="Tipo">
            <select className="field" value={d.shape ?? 'rect'} onChange={(e) => data({ shape: e.target.value })}>
              <option value="rect">Retângulo</option><option value="ellipse">Elipse</option><option value="triangle">Triângulo</option><option value="diamond">Losango</option><option value="line">Linha</option>
            </select>
          </Row>
        </Section>
      )}

      {t === 'icon' && (
        <Section title="Ícone">
          <div className="grid grid-cols-6 gap-1 px-3">
            {USER_ICONS.map((n) => (
              <button key={n} data-active={d.icon === n} className="icon-btn !h-8 !w-8" onClick={() => data({ icon: n })} title={n}><Icon name={n} size={17} /></button>
            ))}
          </div>
          <Row label="Cor"><ColorField value={s.color} onChange={(v) => style({ color: v })} /></Row>
          <Row label="Traço"><NumberField value={s.strokeWidth ?? 2} min={0.5} max={4} step={0.25} onChange={(v) => style({ strokeWidth: v })} /></Row>
        </Section>
      )}

      {t === 'list' && (
        <Section title="Itens">
          <div className="px-3">
            <textarea className="field min-h-[80px] resize-y" value={(d.items ?? []).join('\n')} onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => data({ items: e.target.value.split('\n') }, 'items')} />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-g-300"><input type="checkbox" checked={!!d.ordered} onChange={(e) => data({ ordered: e.target.checked })} /> Numerada</label>
            <label className="mt-1 flex items-center gap-2 text-xs text-g-300"><input type="checkbox" checked={d.editableInPlay !== false} onChange={(e) => data({ editableInPlay: e.target.checked })} /> Editável no modo jogo</label>
          </div>
        </Section>
      )}

      {t === 'table' && <TableProps node={node} />}

      {(t === 'number' || t === 'input' || t === 'select') && <FieldProps node={node} />}
      {t === 'progress' && <ProgressProps node={node} />}
      {t === 'indicator' && <IndicatorProps node={node} />}
      {t === 'button' && <ButtonProps node={node} />}
      <div className="h-6" />
    </>
  );
}

function TextStyle({ node, style }: { node: SceneNode; style: (p: Partial<NodeStyle>, key?: string) => void }) {
  const s = node.style;
  const isText = node.type === 'text';
  return (
    <Section title="Texto">
      <Row label="Fonte">
        <select className="field" value={(s.fontFamily ?? 'Inter').split(',')[0].replace(/['"]/g, '')} onChange={(e) => style({ fontFamily: `${e.target.value}, sans-serif` })} style={{ fontFamily: s.fontFamily }}>
          {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
      </Row>
      <Row label="Tamanho"><NumberField value={s.fontSize ?? 16} min={1} onChange={(v) => style({ fontSize: v })} suffix="px" /><NumberField value={s.fontWeight ?? 400} min={100} max={900} step={100} decimals={0} width={64} onChange={(v) => style({ fontWeight: v })} title="Peso" /></Row>
      <Row label="Cor"><ColorField value={s.color} onChange={(v) => style({ color: v })} /></Row>
      <Row label="Estilo">
        <Seg value={s.italic ? 'i' : ''} options={[{ v: 'i', text: 'I', title: 'Itálico' }]} onChange={() => style({ italic: !s.italic })} />
        <Seg value={s.underline ? 'u' : ''} options={[{ v: 'u', text: 'U', title: 'Sublinhado' }]} onChange={() => style({ underline: !s.underline })} />
      </Row>
      <Row label="Alinhar">
        <Seg value={s.align ?? 'left'} onChange={(v) => style({ align: v as NodeStyle['align'] })}
          options={[{ v: 'left', text: '⇤', title: 'Esquerda' }, { v: 'center', text: '↔', title: 'Centro' }, { v: 'right', text: '⇥', title: 'Direita' }, ...(isText ? [{ v: 'justify', text: '≡', title: 'Justificar' }] : [])]} />
        {isText && <Seg value={s.valign ?? 'top'} onChange={(v) => style({ valign: v as NodeStyle['valign'] })} options={[{ v: 'top', text: '⤒', title: 'Topo' }, { v: 'middle', text: '↕', title: 'Meio' }, { v: 'bottom', text: '⤓', title: 'Base' }]} />}
      </Row>
      {(isText || node.type === 'list') && (
        <Row label="Espaço"><NumberField label="↕" value={s.lineHeight ?? 1.3} step={0.1} min={0.5} max={4} onChange={(v) => style({ lineHeight: v })} title="Altura da linha" /><NumberField label="↔" value={s.letterSpacing ?? 0} step={0.5} onChange={(v) => style({ letterSpacing: v })} title="Espaço entre letras" /></Row>
      )}
    </Section>
  );
}

/* ───────────── vínculo com variável ───────────── */
function BindRow({ node, field = 'bind', label = 'Variável', kind }: { node: SceneNode; field?: string; label?: string; kind: Variable['type'] }) {
  const variables = useRules((s) => s.variables);
  const update = useRules((s) => s.update);
  const commit = useEditor((s) => s.commit);
  const value: string = node.data[field] ?? '';
  const set = (id: string) => commit((s) => ops.updateData(s, node.id, { [field]: id }));
  const create = () => {
    const base = node.name.trim() || 'Nova variável';
    let name = base, i = 2;
    while (nameProblem(name, variables.map((v) => v.name))) name = `${base} ${i++}`;
    const v = newVariable({ name, type: kind, initial: kind === 'number' ? Number(node.data.initial) || 0 : kind === 'boolean' ? !!node.data.initial : String(node.data.initial ?? '') });
    update((vs) => [...vs, v]);
    set(v.id);
  };
  return (
    <Row label={label}>
      <select className="field" value={value} onChange={(e) => set(e.target.value)}>
        <option value="">(nenhuma)</option>
        {variables.filter((v) => v.name.trim()).map((v) => <option key={v.id} value={v.id}>{v.group ? `${v.group} · ` : ''}{v.name}{v.formula ? ' (calculada)' : ''}</option>)}
        {value && !variables.some((v) => v.id === value) && <option value={value}>(variável removida)</option>}
      </select>
      <button className="icon-btn" title="Criar variável a partir deste elemento" onClick={create}><Icon name="plus" size={14} /></button>
    </Row>
  );
}

/** Fórmula escrita direto no campo (sem criar variável): ex. 10 + Nível * 2 */
function NodeFormula({ node, label = 'Valor por fórmula (opcional)' }: { node: SceneNode; label?: string }) {
  const variables = useRules((s) => s.variables);
  const commit = useEditor((s) => s.commit);
  const formula: string = node.data.formula ?? '';
  const computed = useMemo(() => computeVariables([...variables, ...nodeFormulaVars([node])]), [variables, node.data.formula, node.id]);
  const err = computed.errorById[nodeVarId(node.id)];
  return (
    <div className="px-3 pt-1">
      <div className="mb-1 text-xs text-g-400">{label}</div>
      <FormulaEditor rows={2} value={formula} names={variables.map((v) => v.name).filter(Boolean)} error={err}
        onChange={(f) => commit((s) => ops.updateData(s, node.id, { formula: f }), 'dformula')} />
      {formula.trim() && !err && <div className="mt-1 text-xs text-g-400">Resultado atual: <b className="text-g-100">{String(computed.byId[nodeVarId(node.id)] ?? '—')}</b>. O jogador não edita este campo.</div>}
    </div>
  );
}

/** Painel da variável vinculada: valor inicial e fórmula associada. */
function BoundVariable({ id }: { id: string }) {
  const variables = useRules((s) => s.variables);
  const update = useRules((s) => s.update);
  const v = variables.find((x) => x.id === id);
  const computed = useMemo(() => computeVariables(variables), [variables]);
  if (!v) return null;
  const patch = (p: Partial<Variable>) => update((vs) => vs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <div className="mx-3 mt-1 rounded-md border border-g-700 bg-g-900/60 p-2">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-g-400"><Icon name="sigma" size={12} /> <b className="text-g-200">{v.name}</b> · valor atual: <span className="text-g-100">{String(computed.byId[v.id] ?? '—')}</span></div>
      {!v.formula.trim() && (
        <Row label="Inicial">
          {v.type === 'boolean'
            ? <input type="checkbox" checked={v.initial === true} onChange={(e) => patch({ initial: e.target.checked })} />
            : v.type === 'number'
              ? <NumberField value={Number(v.initial) || 0} onChange={(n) => patch({ initial: n })} />
              : <CommitInput value={String(v.initial)} onCommit={(t) => patch({ initial: t })} />}
        </Row>
      )}
      <div className="mt-1 text-xs text-g-400">Fórmula associada</div>
      <FormulaEditor rows={2} value={v.formula} onChange={(f) => patch({ formula: f })} names={variables.map((x) => x.name).filter(Boolean)} selfName={v.name} error={computed.errorById[v.id]} showChips={false} />
    </div>
  );
}

function FieldProps({ node }: { node: SceneNode }) {
  const data = (p: Record<string, unknown>) => useEditor.getState().commit((s) => ops.updateData(s, node.id, p), 'd' + Object.keys(p)[0]);
  const d = node.data, t = node.type;
  const bound = !!d.bind;
  return (
    <Section title="Campo">
      <BindRow node={node} kind={t === 'number' ? 'number' : 'text'} />
      {bound && <BoundVariable id={d.bind} />}
      {!bound && t === 'number' && <NodeFormula node={node} />}
      {!bound && !(t === 'number' && String(d.formula ?? '').trim()) && (
        <Row label="Inicial">
          {t === 'number' ? <NumberField value={Number(d.initial) || 0} onChange={(v) => data({ initial: v })} /> : <CommitInput value={String(d.initial ?? '')} onCommit={(v) => data({ initial: v })} />}
        </Row>
      )}
      {t === 'number' && (
        <>
          <Row label="Mín / Máx">
            <NumberField value={d.min === '' || d.min === undefined ? '' : Number(d.min)} onChange={(v) => data({ min: v })} />
            <NumberField value={d.max === '' || d.max === undefined ? '' : Number(d.max)} onChange={(v) => data({ max: v })} />
          </Row>
          <Row label="Passo"><NumberField value={Number(d.step) || 1} min={0.01} onChange={(v) => data({ step: v })} /></Row>
          <Row label="Decimais"><NumberField value={d.decimals === '' || d.decimals === undefined ? '' : Number(d.decimals)} min={0} max={6} decimals={0} onChange={(v) => data({ decimals: v })} />
            <button className="btn !px-2 text-xs" onClick={() => data({ decimals: '' })} title="Automático">auto</button></Row>
          <Row label="Prefixo"><CommitInput value={d.prefix ?? ''} onCommit={(v) => data({ prefix: v })} /></Row>
          <Row label="Sufixo"><CommitInput value={d.suffix ?? ''} onCommit={(v) => data({ suffix: v })} /></Row>
        </>
      )}
      {t === 'input' && (
        <>
          <Row label="Dica"><CommitInput value={d.placeholder ?? ''} onCommit={(v) => data({ placeholder: v })} /></Row>
          <Row label="Várias linhas"><input type="checkbox" checked={!!d.multiline} onChange={(e) => data({ multiline: e.target.checked })} /></Row>
        </>
      )}
      {t === 'select' && (
        <div className="px-3 pt-1">
          <div className="mb-1 text-xs text-g-400">Opções (uma por linha)</div>
          <textarea className="field min-h-[72px]" value={(d.options ?? []).join('\n')} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => data({ options: e.target.value.split('\n') })} />
        </div>
      )}
      <Row label="Editável"><input type="checkbox" checked={d.editable !== false} onChange={(e) => data({ editable: e.target.checked })} /><span className="text-xs text-g-500">no modo jogo</span></Row>
    </Section>
  );
}

function ProgressProps({ node }: { node: SceneNode }) {
  const data = (p: Record<string, unknown>) => useEditor.getState().commit((s) => ops.updateData(s, node.id, p), 'd' + Object.keys(p)[0]);
  const style = (p: Partial<NodeStyle>) => useEditor.getState().commit((s) => ops.updateStyle(s, node.id, p), 'st' + Object.keys(p)[0]);
  const d = node.data;
  return (
    <Section title="Barra">
      <BindRow node={node} kind="number" label="Valor" />
      {d.bind && <BoundVariable id={d.bind} />}
      {!d.bind && <NodeFormula node={node} label="Valor por fórmula (ex.: Vida)" />}
      {!d.bind && !String(d.formula ?? '').trim() && <Row label="Valor"><NumberField value={Number(d.initial) || 0} onChange={(v) => data({ initial: v })} /></Row>}
      <BindRow node={node} field="maxBind" label="Máximo" kind="number" />
      {!d.maxBind && <Row label="Máx."><NumberField value={Number(d.max) || 100} onChange={(v) => data({ max: v })} /></Row>}
      <Row label="Cor barra"><ColorField value={node.style.color} onChange={(v) => style({ color: v })} /></Row>
      <Row label="Texto"><input type="checkbox" checked={d.showText !== false} onChange={(e) => data({ showText: e.target.checked })} /></Row>
    </Section>
  );
}

function IndicatorProps({ node }: { node: SceneNode }) {
  const data = (p: Record<string, unknown>) => useEditor.getState().commit((s) => ops.updateData(s, node.id, p), 'd' + Object.keys(p)[0]);
  const style = (p: Partial<NodeStyle>) => useEditor.getState().commit((s) => ops.updateStyle(s, node.id, p), 'st' + Object.keys(p)[0]);
  const d = node.data;
  return (
    <Section title="Indicador">
      <BindRow node={node} kind="boolean" />
      {d.bind && <BoundVariable id={d.bind} />}
      {!d.bind && <Row label="Ligado"><input type="checkbox" checked={!!d.initial} onChange={(e) => data({ initial: e.target.checked })} /></Row>}
      <Row label="Cor ligado"><ColorField value={node.style.color} onChange={(v) => style({ color: v })} /></Row>
      <Row label="Forma"><Seg value={d.shape ?? 'ellipse'} onChange={(v) => data({ shape: v })} options={[{ v: 'ellipse', text: '●' }, { v: 'rect', text: '■' }]} /></Row>
      <p className="px-3 text-xs text-g-500">Acende quando o valor é verdadeiro ou diferente de zero.</p>
    </Section>
  );
}

function ButtonProps({ node }: { node: SceneNode }) {
  const data = (p: Record<string, unknown>) => useEditor.getState().commit((s) => ops.updateData(s, node.id, p), 'd' + Object.keys(p)[0]);
  const d = node.data;
  return (
    <Section title="Botão">
      <Row label="Rótulo"><CommitInput value={d.text ?? ''} onCommit={(v) => data({ text: v })} /></Row>
      <Row label="Ação">
        <select className="field" value={d.action ?? 'none'} onChange={(e) => data({ action: e.target.value })}>
          <option value="none">Nenhuma</option><option value="inc">Somar à variável</option><option value="dec">Subtrair da variável</option><option value="set">Definir valor</option><option value="toggle">Alternar ligado/desligado</option><option value="roll">Rolar dados</option>
        </select>
      </Row>
      {d.action === 'roll' && (
        <>
          <Row label="Rolagem"><CommitInput value={d.roll ?? ''} placeholder="1d20 + Força" onCommit={(v) => data({ roll: v })} className="field font-mono" /></Row>
          <Row label="Nome"><CommitInput value={d.rollLabel ?? ''} placeholder="Ex.: Ataque" onCommit={(v) => data({ rollLabel: v })} /></Row>
          <Row label="Guardar"><label className="flex items-center gap-2 text-xs text-g-300"><input type="checkbox" checked={!!d.rollStore} onChange={(e) => data({ rollStore: e.target.checked })} /> resultado numa variável</label></Row>
          {d.rollStore && <BindRow node={node} kind="number" />}
          <p className="px-3 text-xs text-g-500">Aceita 2d6, d20, 4d6kh3 (mantém os 3 maiores), 2d20kl1 e variáveis: <span className="font-mono">1d8 + Força + 2</span>.</p>
        </>
      )}
      {d.action && d.action !== 'none' && d.action !== 'roll' && <BindRow node={node} kind="number" />}
      {(d.action === 'inc' || d.action === 'dec' || d.action === 'set') && <Row label="Valor"><CommitInput value={String(d.actionValue ?? 1)} onCommit={(v) => data({ actionValue: v === '' || Number.isNaN(Number(v)) ? v : Number(v) })} /></Row>}
      <p className="px-3 text-xs text-g-500">Funciona no modo Jogar. Variáveis calculadas por fórmula não podem ser alteradas.</p>
    </Section>
  );
}

function TableProps({ node }: { node: SceneNode }) {
  const commit = useEditor((s) => s.commit);
  const rows: string[][] = node.data.rows ?? [[]];
  const cols = rows[0]?.length ?? 0;
  const set = (r: string[][]) => commit((s) => ops.updateData(s, node.id, { rows: r }), 'rows');
  const resize = (nr: number, nc: number) => set(Array.from({ length: Math.max(1, nr) }, (_, i) => Array.from({ length: Math.max(1, nc) }, (_, j) => rows[i]?.[j] ?? '')));
  return (
    <Section title="Tabela">
      <Row label="Linhas"><NumberField value={rows.length} min={1} max={50} decimals={0} onChange={(v) => resize(v, cols)} /></Row>
      <Row label="Colunas"><NumberField value={cols} min={1} max={20} decimals={0} onChange={(v) => resize(rows.length, v)} /></Row>
      <Row label="Jogador"><label className="flex items-center gap-2 text-xs text-g-300"><input type="checkbox" checked={!!node.data.rowsEditable} onChange={(e) => commit((s) => ops.updateData(s, node.id, { rowsEditable: e.target.checked }))} /> pode adicionar/remover linhas</label></Row>
      <Row label="Cabeçalho"><input type="checkbox" checked={node.data.header !== false} onChange={(e) => commit((s) => ops.updateData(s, node.id, { header: e.target.checked }))} /></Row>
      <div className="max-h-48 overflow-auto px-3 pt-1">
        {rows.map((r, i) => (
          <div key={i} className="mb-1 flex gap-1">
            {r.map((c, j) => <CommitInput key={j} className="field !px-1 !py-0.5 text-xs" value={c} onCommit={(v) => set(rows.map((rr, a) => (a === i ? rr.map((x, b) => (b === j ? v : x)) : rr)))} />)}
          </div>
        ))}
      </div>
      <p className="px-3 pt-1 text-xs text-g-500">Células aceitam {'{Variável}'}. No modo Jogar as linhas de dados ficam editáveis.</p>
    </Section>
  );
}
