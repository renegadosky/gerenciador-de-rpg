import type { FieldDef, LibraryRecord, LibraryType } from '../types';

/** Registros que apontam para `recordId` por algum campo de vínculo. */
export function backlinks(records: LibraryRecord[], types: LibraryType[], recordId: string) {
  const out: { record: LibraryRecord; field: FieldDef }[] = [];
  for (const r of records) {
    const t = types.find((x) => x.id === r.typeId);
    if (!t) continue;
    for (const f of t.fields) if (f.kind === 'link' && Array.isArray(r.data[f.id]) && (r.data[f.id] as string[]).includes(recordId)) out.push({ record: r, field: f });
  }
  return out;
}
