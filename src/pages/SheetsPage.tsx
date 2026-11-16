import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepo } from '../components/AuthProvider';
import { Icon } from '../components/Icon';
import { CommitInput, ConfirmModal, ErrorState, Spinner } from '../components/ui';
import { downloadJson, safeFileName } from '../lib/files';
import { errMsg, toast } from '../stores/toast';
import type { SheetMeta } from '../types';
import { useProject } from './ProjectLoader';

export default function SheetsPage() {
  const repo = useRepo();
  const { project } = useProject();
  const [sheets, setSheets] = useState<SheetMeta[] | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<SheetMeta | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSheets(await repo.listSheets(project.id)); setError(''); } catch (e) { setError(errMsg(e)); }
  }, [repo, project.id]);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    try {
      const n = (sheets?.length ?? 0) + 1;
      const s = await repo.createSheet(project.id, `Modelo ${n}`);
      location.hash = `#/p/${project.id}/sheets/${s.id}`;
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Modelos de ficha</h1>
          <p className="text-sm text-g-400">Aqui você <b>desenha o modelo</b>: layout livre, campos ligados às variáveis das Regras. Depois exporte e envie aos jogadores — cada um preenche o próprio personagem sem alterar o modelo.</p>
        </div>
        <button className="btn btn-primary" onClick={() => void create()}><Icon name="plus" size={14} /> Novo modelo</button>
      </div>
      {error ? <ErrorState title="Erro ao listar fichas" message={error} action={<button className="btn" onClick={() => void load()}>Tentar de novo</button>} />
        : !sheets ? <div className="py-12 text-center"><Spinner size={22} /></div>
        : sheets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-g-600 p-12 text-center text-sm text-g-400">Nenhum modelo ainda. Crie um para abrir o editor visual.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-g-700">
            {sheets.map((s) => (
              <div key={s.id} className="group flex items-center gap-3 border-b border-g-700 bg-g-850 px-4 py-3 last:border-b-0 hover:bg-g-800">
                <Icon name="shapes" className="text-g-400" />
                {renaming === s.id ? (
                  <CommitInput autoFocus value={s.name} onCommit={async (v) => { if (v.trim()) { try { await repo.renameSheet(s.id, v.trim()); void load(); } catch (e) { toast.error(errMsg(e)); } } setRenaming(null); }} onBlur={() => setRenaming(null)} />
                ) : (
                  <Link to={`/p/${project.id}/sheets/${s.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="text-xs text-g-500">Atualizada em {new Date(s.updatedAt).toLocaleString('pt-BR')}</div>
                  </Link>
                )}
                <button className="btn !py-1 text-xs" title="Baixar o modelo para enviar aos jogadores" onClick={async () => {
                  try { downloadJson(`modelo-${safeFileName(project.name)}-${safeFileName(s.name)}.rpg.json`, await repo.exportTemplate(project.id, s.id)); toast.success('Modelo baixado. Envie o arquivo aos jogadores: eles o importam na tela inicial.'); } catch (e) { toast.error(errMsg(e)); }
                }}><Icon name="upload" size={13} className="rotate-180" /> Enviar aos jogadores</button>
                <button className="icon-btn opacity-0 group-hover:opacity-100" title="Renomear" onClick={() => setRenaming(s.id)}><Icon name="pencil" size={14} /></button>
                <button className="icon-btn opacity-0 hover:!text-red-400 group-hover:opacity-100" title="Excluir" onClick={() => setDeleting(s)}><Icon name="trash" size={14} /></button>
              </div>
            ))}
          </div>
        )}
      {deleting && (
        <ConfirmModal title="Excluir modelo" message={`O modelo “${deleting.name}” será apagado permanentemente.`} onClose={() => setDeleting(null)}
          onConfirm={async () => { try { await repo.deleteSheet(deleting.id); void load(); } catch (e) { toast.error(errMsg(e)); } }} />
      )}
    </div>
  );
}
