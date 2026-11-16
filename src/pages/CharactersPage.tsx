import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepo } from '../components/AuthProvider';
import { Icon } from '../components/Icon';
import { CommitInput, ConfirmModal, ErrorState, Modal, Spinner } from '../components/ui';
import { downloadJson, readJsonFile, safeFileName } from '../lib/files';
import { parseCharacterBundle } from '../data';
import { errMsg, toast } from '../stores/toast';
import type { CharacterMeta, SheetMeta } from '../types';
import { useProject } from './ProjectLoader';

export default function CharactersPage() {
  const repo = useRepo();
  const { project } = useProject();
  const player = project.kind === 'imported';
  const [chars, setChars] = useState<CharacterMeta[] | null>(null);
  const [sheets, setSheets] = useState<SheetMeta[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CharacterMeta | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([repo.listCharacters(project.id), repo.listSheets(project.id)]);
      setChars(c); setSheets(s); setError('');
    } catch (e) { setError(errMsg(e)); }
  }, [repo, project.id]);
  useEffect(() => { void load(); }, [load]);

  const sheetName = (id: string) => sheets.find((s) => s.id === id)?.name ?? '—';

  const exportChar = async (c: CharacterMeta) => {
    try {
      const b = await repo.exportCharacter(c.id);
      downloadJson(`personagem-${safeFileName(c.name)}.rpg.json`, b);
      toast.success('Arquivo do personagem baixado. Envie ao mestre.');
    } catch (e) { toast.error(errMsg(e)); }
  };
  const importChar = async (f: File) => {
    try {
      const c = await repo.importCharacter(parseCharacterBundle(await readJsonFile(f)));
      toast.success(`Personagem “${c.name}” importado.`);
      void load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">{player ? 'Meus personagens' : 'Personagens'}</h1>
          <p className="text-sm text-g-400">
            {player ? 'Preencha seu personagem a partir da ficha enviada pelo mestre. O layout não pode ser alterado — só os seus valores.'
              : 'Cada personagem é uma cópia preenchida de um modelo. Crie os seus (NPCs, testes) ou importe os arquivos enviados pelos jogadores.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!player && <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} /> Importar de jogador</button>}
          <button className="btn btn-primary" onClick={() => setCreating(true)} disabled={!sheets.length}><Icon name="plus" size={14} /> Novo personagem</button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importChar(f); }} />

      {error ? <ErrorState title="Erro ao listar personagens" message={error} action={<button className="btn" onClick={() => void load()}>Tentar de novo</button>} />
        : !chars ? <div className="py-12 text-center"><Spinner size={22} /></div>
        : chars.length === 0 ? (
          <div className="rounded-xl border border-dashed border-g-600 p-12 text-center text-sm text-g-400">
            {!sheets.length ? 'Ainda não há nenhum modelo de ficha neste projeto. Crie um em “Modelos de ficha”.' : 'Nenhum personagem ainda. Crie o primeiro a partir de um modelo.'}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-g-700">
            {chars.map((c) => (
              <div key={c.id} className="group flex items-center gap-3 border-b border-g-700 bg-g-850 px-4 py-3 last:border-b-0 hover:bg-g-800">
                <Icon name="smile" className="text-accent" />
                {renaming === c.id ? (
                  <CommitInput autoFocus value={c.name} onBlur={() => setRenaming(null)}
                    onCommit={async (v) => { if (v.trim()) { try { await repo.renameCharacter(c.id, v.trim()); void load(); } catch (e) { toast.error(errMsg(e)); } } setRenaming(null); }} />
                ) : (
                  <Link to={`/p/${project.id}/play/${c.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-xs text-g-500">{sheetName(c.sheetId)} · atualizado em {new Date(c.updatedAt).toLocaleString('pt-BR')}</div>
                  </Link>
                )}
                <button className="icon-btn" title="Baixar arquivo do personagem" onClick={() => void exportChar(c)}><Icon name="upload" size={14} className="rotate-180" /></button>
                <button className="icon-btn opacity-0 group-hover:opacity-100" title="Renomear" onClick={() => setRenaming(c.id)}><Icon name="pencil" size={14} /></button>
                <button className="icon-btn opacity-0 hover:!text-red-400 group-hover:opacity-100" title="Excluir" onClick={() => setDeleting(c)}><Icon name="trash" size={14} /></button>
              </div>
            ))}
          </div>
        )}

      {creating && <NewCharacter sheets={sheets} onClose={() => setCreating(false)} onCreate={async (sheetId, name) => {
        try { const c = await repo.createCharacter(project.id, sheetId, name); location.hash = `#/p/${project.id}/play/${c.id}`; } catch (e) { toast.error(errMsg(e)); }
      }} />}
      {deleting && (
        <ConfirmModal title="Excluir personagem" message={`“${deleting.name}” será apagado permanentemente (baixe o arquivo antes se quiser guardar uma cópia).`} onClose={() => setDeleting(null)}
          onConfirm={async () => { try { await repo.deleteCharacter(deleting.id); void load(); } catch (e) { toast.error(errMsg(e)); } }} />
      )}
    </div>
  );
}

function NewCharacter({ sheets, onClose, onCreate }: { sheets: SheetMeta[]; onClose: () => void; onCreate: (sheetId: string, name: string) => void }) {
  const [sheetId, setSheetId] = useState(sheets[0]?.id ?? '');
  const [name, setName] = useState('');
  return (
    <Modal title="Novo personagem" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (sheetId && name.trim()) onCreate(sheetId, name.trim()); }}>
        <label className="block"><span className="mb-1 block text-xs text-g-400">Nome do personagem</span>
          <input className="field" autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Diego" /></label>
        {sheets.length > 1 && (
          <label className="block"><span className="mb-1 block text-xs text-g-400">Modelo de ficha</span>
            <select className="field" value={sheetId} onChange={(e) => setSheetId(e.target.value)}>{sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        )}
        <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!name.trim()}>Criar e abrir</button></div>
      </form>
    </Modal>
  );
}
