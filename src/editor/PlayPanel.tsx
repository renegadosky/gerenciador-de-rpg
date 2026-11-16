import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { CommitInput, NumberField } from '../components/ui';
import { rollDice } from '../engine/dice';
import { keyOf } from '../engine/formula';
import { useEditor } from '../stores/editor';
import { useRules } from '../stores/rules';
import { computeVariables } from './compute';

/** Painel do modo Jogar: rolador de dados + todas as variáveis com seus valores atuais. */
export function PlayPanel({ projectId, player = false }: { projectId: string; player?: boolean }) {
  const variables = useRules((s) => s.variables);
  const play = useEditor((s) => s.play);
  const rolls = useEditor((s) => s.rolls);
  const setPlayVar = useEditor((s) => s.setPlayVar);
  const resetPlay = useEditor((s) => s.resetPlay);
  const computed = useMemo(() => computeVariables(variables, play.vars), [variables, play.vars]);
  const [expr, setExpr] = useState('1d20');
  const groups = useMemo(() => {
    const m = new Map<string, typeof variables>();
    variables.filter((v) => v.name.trim()).forEach((v) => m.set(v.group || 'Variáveis', [...(m.get(v.group || 'Variáveis') ?? []), v]));
    return [...m.entries()];
  }, [variables]);

  const roll = () => {
    const r = rollDice(expr, variables.map((v) => v.name).filter(Boolean), (n) => computed.byName.get(keyOf(n)));
    useEditor.getState().addRoll({ label: expr, text: r.text, total: r.total, ok: r.ok, error: r.error });
  };

  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto rounded-xl border border-g-700 bg-g-850">
      <div className="section-title">Rolar dados</div>
      <div className="flex gap-1.5 px-3">
        <input className="field font-mono" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="2d6 + Força"
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') roll(); }} aria-label="Expressão de rolagem" />
        <button className="btn btn-primary" onClick={roll}><Icon name="dices" size={14} /> Rolar</button>
      </div>
      <div className="flex flex-wrap gap-1 px-3 pt-1.5">
        {['1d20', '1d12', '1d10', '1d8', '1d6', '1d4', '1d100'].map((d) => (
          <button key={d} className="rounded border border-g-700 px-1.5 py-0.5 font-mono text-xs text-g-300 hover:border-accent hover:text-accent" onClick={() => setExpr(d)}>{d}</button>
        ))}
      </div>
      {rolls.length > 0 && (
        <div className="mx-3 mt-2 max-h-40 overflow-y-auto rounded-md border border-g-700 bg-g-900/50">
          {rolls.map((r) => (
            <div key={r.id} className="border-b border-g-700/60 px-2 py-1.5 last:border-b-0" title={r.text}>
              {r.ok ? (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs text-g-400">{r.label}</span>
                  <span className="font-display text-base font-bold text-accent">{r.total}</span>
                </div>
              ) : <span className="text-xs text-red-300">{r.error}</span>}
              {r.ok && <div className="truncate font-mono text-2xs text-g-500">{r.text}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between px-3 pt-3">
        <div className="text-sm font-semibold">Valores</div>
        <button className="btn !px-2 !py-1 text-xs" onClick={() => confirm('Voltar todos os valores aos iniciais?') && resetPlay()}><Icon name="reset" size={12} /> Zerar</button>
      </div>
      {groups.length === 0 && (
        <p className="p-3 text-xs text-g-500">
          Nenhuma variável criada.{!player && <> Crie atributos e fórmulas em <Link className="text-accent underline" to={`/p/${projectId}/rules`}>Regras</Link> e vincule-os aos campos da ficha.</>}
        </p>
      )}
      {groups.map(([g, vs]) => (
        <div key={g}>
          <div className="section-title">{g}</div>
          {vs.map((v) => {
            const isF = computed.isFormula.has(v.id);
            const val = computed.byId[v.id];
            const err = computed.errorById[v.id];
            return (
              <div key={v.id} className="row" title={err ?? v.description}>
                <span className="w-24 shrink-0 truncate text-sm text-g-200">{v.name}</span>
                <div className="min-w-0 flex-1">
                  {err ? <span className="text-xs text-red-300">erro na fórmula</span>
                    : isF ? <span className="rounded bg-g-800 px-2 py-0.5 text-sm tabular-nums">{String(val)}</span>
                    : v.type === 'number' ? <NumberField value={Number(val) || 0} onChange={(n) => setPlayVar(v.id, n)} />
                    : v.type === 'boolean' ? <input type="checkbox" checked={val === true} onChange={(e) => setPlayVar(v.id, e.target.checked)} />
                    : <CommitInput value={String(val ?? '')} onCommit={(t) => setPlayVar(v.id, t)} />}
                </div>
                {isF && <Icon name="sigma" size={12} className="text-g-500" />}
              </div>
            );
          })}
        </div>
      ))}
      <div className="h-4" />
    </aside>
  );
}
