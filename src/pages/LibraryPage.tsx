import { useEffect, useMemo, useState } from 'react';
import { useRepo } from '../components/AuthProvider';
import { Icon, USER_ICONS } from '../components/Icon';
import { CommitInput, ConfirmModal, ErrorState, Modal, NumberField, SaveBadge, Spinner } from '../components/ui';
import { backlinks } from '../lib/libraryLinks';
import { fileToScaledDataUrl } from '../lib/image';
import { newField, useLibrary } from '../stores/library';
import { errMsg, toast } from '../stores/toast';
import type { FieldDef, FieldKind, LibraryRecord, LibraryType } from '../types';
import { useProject } from './ProjectLoader';

const KIND_LABEL: Record<FieldKind, string> = {
  text: 'Texto curto', longtext: 'Texto longo', number: 'Número', select: 'Lista de opções',
  boolean: 'Sim / não', image: 'Imagem', link: 'Vínculo com outros registros',
};

export default function LibraryPage() {
  const repo = useRepo();
  const { project } = useProject();
  const { types, records, loading, loadError, status, saveError, projectId } = useLibrary();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [recId, setRecId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [schemaFor, setSchemaFor] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<LibraryType | null>(null);

  useEffect(() => {
    void useLibrary.getState().load(repo, project.id);
    return () => {
      void useLibrary.getState().flush().catch(() => {}).finally(() => {
        if (useLibrary.getState().projectId === project.id) useLibrary.getState().reset();
      });
    };
  }, [repo, project.id]);

  // seleção inicial / quando o tipo selecionado deixa de existir
  useEffect(() => {
    if (types.length && !types.some((t) => t.id === typeId)) setTypeId(types[0].id);
    if (!types.length) setTypeId(null);
  }, [types, typeId]);
  useEffect(() => { if (recId && !records.some((r) => r.id === recId)) setRecId(null); }, [records, recId]);

  const type = types.find((t) => t.id === typeId) ?? null;
  const rec = records.find((r) => r.id === recId) ?? null;
  const list = useMemo(
    () => records.filter((r) => r.typeId === typeId && (!query || r.name.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name)),
    [records, typeId, query],
  );
  const counts = useMemo(() => { const m: Record<string, number> = {}; records.forEach((r) => (m[r.typeId] = (m[r.typeId] ?? 0) + 1)); return m; }, [records]);

  const goTo = (r: LibraryRecord) => { setQuery(''); setTypeId(r.typeId); setRecId(r.id); };

  if (loadError) return <ErrorState title="Não foi possível carregar a biblioteca" message={loadError} />;
  if (loading || projectId !== project.id) return <div className="flex h-full items-center justify-center"><Spinner size={22} /></div>;

  const st = useLibrary.getState;
  return (
    <div className="flex h-full">
      {/* categorias */}
      <section className="flex w-[230px] shrink-0 flex-col border-r border-g-700 bg-g-850">
        <div className="flex items-center justify-between px-3 pb-1 pt-3">
          <div className="section-title !p-0">Categorias</div>
          <SaveBadge status={status} error={saveError} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5">
          {types.map((t) => (
            <button key={t.id} onClick={() => { setTypeId(t.id); setRecId(null); setQuery(''); }}
              className={`group mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${t.id === typeId ? 'bg-accent-soft text-g-100 shadow-[inset_2px_0_0_rgb(var(--accent))]' : 'text-g-300 hover:bg-g-800'}`}>
              <Icon name={t.icon} size={14} className={t.id === typeId ? 'text-accent' : 'text-g-400'} />
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <span className="text-xs tabular-nums text-g-500">{counts[t.id] ?? ''}</span>
            </button>
          ))}
          {!types.length && <p className="p-3 text-xs leading-5 text-g-500">Nenhuma categoria. Crie a primeira: você decide o que existe no seu universo.</p>}
        </div>
        <div className="border-t border-g-700 p-2">
          <button className="btn w-full" onClick={() => { const t = st().addType('Nova categoria'); setTypeId(t.id); setRecId(null); setSchemaFor(t.id); }}><Icon name="plus" size={14} /> Nova categoria</button>
        </div>
      </section>

      {/* registros */}
      <section className="flex w-[290px] shrink-0 flex-col border-r border-g-700 bg-g-900/40">
        {type ? (
          <>
            <div className="border-b border-g-700 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Icon name={type.icon} size={16} className="text-accent" />
                <div className="min-w-0 flex-1 truncate font-display text-base font-bold">{type.name}</div>
                <button className="icon-btn" title="Editar categoria e campos" onClick={() => setSchemaFor(type.id)}><Icon name="settings" size={15} /></button>
              </div>
              <div className="flex gap-2">
                <input className="field" placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <button className="btn btn-primary !px-2" title="Novo registro" onClick={() => { const r = st().addRecord(type.id); setRecId(r.id); setQuery(''); }}><Icon name="plus" size={14} /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {list.map((r) => {
                const img = firstImage(type, r);
                return (
                  <button key={r.id} onClick={() => setRecId(r.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left ${r.id === recId ? 'bg-accent-soft' : 'hover:bg-g-800'}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-g-700 bg-g-800 bg-cover bg-center text-g-500" style={img ? { backgroundImage: `url(${img})` } : undefined}>
                      {!img && <Icon name={type.icon} size={15} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{r.name || <i className="text-g-500">sem nome</i>}</span>
                  </button>
                );
              })}
              {!list.length && (
                <p className="p-4 text-center text-xs leading-5 text-g-500">
                  {query ? 'Nada encontrado.' : <>Nenhum registro em <b>{type.name}</b>.<br />Clique em <b>+</b> para criar.</>}
                </p>
              )}
            </div>
          </>
        ) : <p className="p-4 text-sm text-g-500">Selecione ou crie uma categoria.</p>}
      </section>

      {/* editor do registro */}
      <section className="min-w-0 flex-1 overflow-y-auto">
        {type && rec ? <RecordEditor key={rec.id} type={type} rec={rec} goTo={goTo} /> : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-g-500">Selecione um registro para editar,<br />ou crie um novo.</div>
        )}
      </section>

      {schemaFor && types.some((t) => t.id === schemaFor) && (
        <SchemaModal typeId={schemaFor} onClose={() => setSchemaFor(null)} onDelete={() => { setDeletingType(types.find((t) => t.id === schemaFor) ?? null); setSchemaFor(null); }} />
      )}
      {deletingType && (
        <ConfirmModal title="Excluir categoria" confirmLabel="Excluir categoria"
          message={`“${deletingType.name}” e ${counts[deletingType.id] ?? 0} registro(s) serão apagados permanentemente.`}
          onClose={() => setDeletingType(null)} onConfirm={() => { st().removeType(deletingType.id); toast.success('Categoria excluída.'); }} />
      )}
    </div>
  );
}

const firstImage = (t: LibraryType, r: LibraryRecord): string | null => {
  const f = t.fields.find((x) => x.kind === 'image' && typeof r.data[x.id] === 'string' && r.data[x.id]);
  return f ? (r.data[f.id] as string) : null;
};

/* ───────────── registro ───────────── */
function RecordEditor({ type, rec, goTo }: { type: LibraryType; rec: LibraryRecord; goTo: (r: LibraryRecord) => void }) {
  const types = useLibrary((s) => s.types);
  const records = useLibrary((s) => s.records);
  const [confirm, setConfirm] = useState(false);
  const back = backlinks(records, types, rec.id);
  const set = (fieldId: string, v: unknown) => useLibrary.getState().setField(rec.id, fieldId, v);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-8">
      <div className="flex items-start gap-3">
        <CommitInput className="min-w-0 flex-1 border-b border-transparent bg-transparent pb-1 font-display text-2xl font-bold hover:border-g-600 focus:border-accent focus:outline-none"
          value={rec.name} placeholder="Nome do registro" aria-label="Nome" onCommit={(v) => useLibrary.getState().patchRecord(rec.id, { name: v.trim() || 'Sem nome' })} />
        <button className="btn btn-danger" onClick={() => setConfirm(true)}><Icon name="trash" size={13} /> Excluir</button>
      </div>
      {!type.fields.length && <p className="rounded-lg border border-dashed border-g-600 p-4 text-sm text-g-400">Esta categoria ainda não tem campos. Use a engrenagem ao lado do nome da categoria para definir quais campos seus registros terão.</p>}
      {type.fields.map((f) => (
        <div key={f.id}>
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-g-400">{f.name}</div>
          <FieldInput f={f} value={rec.data[f.id]} onChange={(v) => set(f.id, v)} goTo={goTo} selfId={rec.id} />
        </div>
      ))}
      {back.length > 0 && (
        <div className="rounded-xl border border-g-700 bg-g-850 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-g-400">Mencionado em</div>
          <div className="flex flex-wrap gap-1.5">
            {back.map(({ record, field }) => (
              <button key={record.id + field.id} className="chip" onClick={() => goTo(record)} title={`campo “${field.name}”`}>
                {record.name} <span className="text-g-500">· {types.find((t) => t.id === record.typeId)?.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {confirm && <ConfirmModal title="Excluir registro" message={`“${rec.name}” será apagado permanentemente, e os vínculos para ele serão removidos.`} onClose={() => setConfirm(false)} onConfirm={() => useLibrary.getState().removeRecord(rec.id)} />}
    </div>
  );
}

function FieldInput({ f, value, onChange, goTo, selfId }: { f: FieldDef; value: unknown; onChange: (v: unknown) => void; goTo: (r: LibraryRecord) => void; selfId: string }) {
  switch (f.kind) {
    case 'text': return <CommitInput value={typeof value === 'string' ? value : ''} onCommit={onChange} />;
    case 'longtext': return <textarea className="field min-h-[110px] resize-y leading-6" value={typeof value === 'string' ? value : ''} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => onChange(e.target.value)} />;
    case 'number': return <div className="max-w-[200px]"><NumberField value={typeof value === 'number' ? value : ''} onChange={onChange} /></div>;
    case 'boolean': return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> Sim</label>;
    case 'select':
      return (
        <select className="field max-w-xs" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(f.options ?? []).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'image': return <ImageInput value={typeof value === 'string' ? value : ''} onChange={onChange} />;
    case 'link': return <LinkInput f={f} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} goTo={goTo} selfId={selfId} />;
  }
}

function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-g-700 bg-g-800 bg-cover bg-center" style={value ? { backgroundImage: `url(${value})` } : undefined}>
        {!value && <div className="flex h-full items-center justify-center text-g-600"><Icon name="image" size={26} /></div>}
      </div>
      <div className="flex flex-col gap-2">
        <label className="btn cursor-pointer"><Icon name="upload" size={13} /> {value ? 'Trocar' : 'Escolher imagem'}
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0]; e.target.value = '';
            if (!file) return;
            try { onChange((await fileToScaledDataUrl(file, 900)).dataUrl); } catch (err) { toast.error(errMsg(err)); }
          }} /></label>
        {value && <button className="btn btn-ghost" onClick={() => onChange('')}>Remover</button>}
      </div>
    </div>
  );
}

function LinkInput({ f, value, onChange, goTo, selfId }: { f: FieldDef; value: string[]; onChange: (v: string[]) => void; goTo: (r: LibraryRecord) => void; selfId: string }) {
  const types = useLibrary((s) => s.types);
  const records = useLibrary((s) => s.records);
  const linked = value.map((id) => records.find((r) => r.id === id)).filter(Boolean) as LibraryRecord[];
  const options = records.filter((r) => r.id !== selfId && !value.includes(r.id) && (!f.linkType || r.typeId === f.linkType));
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {linked.map((r) => (
          <span key={r.id} className="chip">
            <button className="hover:text-accent" onClick={() => goTo(r)} title="Abrir">{r.name}</button>
            <span className="text-g-500">· {types.find((t) => t.id === r.typeId)?.name}</span>
            <button className="text-g-500 hover:text-red-400" aria-label={`Remover vínculo com ${r.name}`} onClick={() => onChange(value.filter((x) => x !== r.id))}><Icon name="x" size={11} /></button>
          </span>
        ))}
        {!linked.length && <span className="text-sm text-g-500">Nenhum vínculo.</span>}
      </div>
      <select className="field max-w-xs" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} disabled={!options.length}>
        <option value="">{options.length ? '+ Vincular registro…' : 'Nenhum registro disponível'}</option>
        {types.filter((t) => options.some((o) => o.typeId === t.id)).map((t) => (
          <optgroup key={t.id} label={t.name}>{options.filter((o) => o.typeId === t.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
        ))}
      </select>
    </div>
  );
}

/* ───────────── editor de categoria e campos ───────────── */
function SchemaModal({ typeId, onClose, onDelete }: { typeId: string; onClose: () => void; onDelete: () => void }) {
  const types = useLibrary((s) => s.types);
  const t = types.find((x) => x.id === typeId)!;
  const setFields = (fn: (f: FieldDef[]) => FieldDef[]) => useLibrary.getState().patchType(typeId, { fields: fn(t.fields) });
  const patchField = (id: string, p: Partial<FieldDef>) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const move = (i: number, d: number) => setFields((fs) => { const a = [...fs]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  return (
    <Modal title="Categoria e campos" onClose={onClose} width={620}>
      <div className="space-y-4">
        <div className="flex items-end gap-3">
          <label className="min-w-0 flex-1"><span className="mb-1 block text-xs text-g-400">Nome da categoria</span>
            <CommitInput value={t.name} onCommit={(v) => v.trim() && useLibrary.getState().patchType(typeId, { name: v.trim() })} /></label>
        </div>
        <div>
          <span className="mb-1 block text-xs text-g-400">Ícone</span>
          <div className="flex flex-wrap gap-1">
            {[...USER_ICONS, 'book'].map((n) => <button key={n} data-active={t.icon === n} className="icon-btn !h-8 !w-8" onClick={() => useLibrary.getState().patchType(typeId, { icon: n })}><Icon name={n} size={16} /></button>)}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="text-xs text-g-400">Campos dos registros ({t.fields.length})</span>
            <button className="btn !py-1" onClick={() => setFields((fs) => [...fs, newField()])}><Icon name="plus" size={13} /> Campo</button></div>
          <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
            {t.fields.map((f, i) => (
              <div key={f.id} className="rounded-lg border border-g-700 bg-g-900/60 p-2">
                <div className="flex items-center gap-2">
                  <CommitInput value={f.name} onCommit={(v) => v.trim() && patchField(f.id, { name: v.trim() })} aria-label="Nome do campo" />
                  <select className="field !w-52 shrink-0" value={f.kind} onChange={(e) => patchField(f.id, { kind: e.target.value as FieldKind })}>
                    {(Object.keys(KIND_LABEL) as FieldKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                  <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="Subir"><Icon name="down" size={14} className="rotate-180" /></button>
                  <button className="icon-btn" disabled={i === t.fields.length - 1} onClick={() => move(i, 1)} title="Descer"><Icon name="down" size={14} /></button>
                  <button className="icon-btn hover:!text-red-400" onClick={() => setFields((fs) => fs.filter((x) => x.id !== f.id))} title="Remover campo (os valores dele nos registros são perdidos)"><Icon name="trash" size={14} /></button>
                </div>
                {f.kind === 'select' && (
                  <label className="mt-2 block"><span className="mb-1 block text-xs text-g-400">Opções (uma por linha)</span>
                    <textarea className="field min-h-[60px]" value={(f.options ?? []).join('\n')} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => patchField(f.id, { options: e.target.value.split('\n') })} /></label>
                )}
                {f.kind === 'link' && (
                  <label className="mt-2 block"><span className="mb-1 block text-xs text-g-400">Pode vincular a</span>
                    <select className="field" value={f.linkType ?? ''} onChange={(e) => patchField(f.id, { linkType: e.target.value })}>
                      <option value="">Qualquer registro</option>
                      {types.filter((x) => x.id !== typeId || true).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select></label>
                )}
              </div>
            ))}
            {!t.fields.length && <p className="text-sm text-g-500">Sem campos. Adicione os que fizerem sentido para esta categoria.</p>}
          </div>
        </div>
        <div className="flex justify-between pt-1">
          <button className="btn btn-danger" onClick={onDelete}><Icon name="trash" size={13} /> Excluir categoria</button>
          <button className="btn btn-primary" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </Modal>
  );
}
