import { useMemo, useState } from 'react';
import { FormulaEditor } from '../components/FormulaEditor';
import { Icon } from '../components/Icon';
import { CommitInput, NumberField } from '../components/ui';
import { collectVars, keyOf, nameProblem, parse, renameInFormula } from '../engine/formula';
import { computeVariables, coerce } from '../editor/compute';
import { formatValue } from '../lib/format';
import { newVariable, useRules } from '../stores/rules';
import type { Variable, VarType } from '../types';

export default function RulesPage() {
  const variables = useRules((s) => s.variables);
  const update = useRules((s) => s.update);
  const [selId, setSelId] = useState<string | null>(variables[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const computed = useMemo(() => computeVariables(variables), [variables]);

  const groups = useMemo(() => {
    const m = new Map<string, Variable[]>();
    variables.filter((v) => !query || v.name.toLowerCase().includes(query.toLowerCase()) || v.group.toLowerCase().includes(query.toLowerCase()))
      .forEach((v) => m.set(v.group, [...(m.get(v.group) ?? []), v]));
    return [...m.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  }, [variables, query]);

  const sel = variables.find((v) => v.id === selId) ?? null;
  const add = () => {
    const v = newVariable({ name: uniqueName('Nova variável', variables), group: sel?.group ?? '' });
    update((vs) => [...vs, v]);
    setSelId(v.id);
  };
  const remove = (id: string) => {
    const v = variables.find((x) => x.id === id);
    if (!v) return;
    const users = variables.filter((o) => o.id !== id && o.formula && collectVars(safeParse(o.formula, variables.map((q) => q.name))).has(v.name));
    const extra = users.length ? `\n\nAtenção: usada nas fórmulas de ${users.map((u) => u.name).join(', ')}. Elas passarão a dar erro.` : '';
    if (!confirm(`Excluir a variável “${v.name || 'sem nome'}”?${extra}\n\nCampos vinculados a ela perdem o vínculo.`)) return;
    update((vs) => vs.filter((x) => x.id !== id));
    setSelId(variables.find((x) => x.id !== id)?.id ?? null);
  };

  return (
    <div className="flex h-full">
      <section className="flex w-[300px] shrink-0 flex-col border-r border-g-700 bg-g-850">
        <div className="flex items-center gap-2 border-b border-g-700 p-3">
          <input className="field" placeholder="Buscar variável ou grupo…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn btn-primary !px-2" onClick={add} title="Nova variável"><Icon name="plus" size={14} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
          {variables.length === 0 && (
            <p className="p-4 text-sm leading-5 text-g-400">Nenhuma variável. Aqui você define o que existe no seu sistema: atributos, recursos, perícias, valores calculados… Nada vem pronto.<br /><br />Clique em <b>+</b> para criar a primeira.</p>
          )}
          {groups.map(([g, vs]) => (
            <div key={g}>
              <div className="section-title">{g || 'Sem grupo'}</div>
              {vs.map((v) => (
                <button key={v.id} onClick={() => setSelId(v.id)} title={computed.errorById[v.id]}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${selId === v.id ? 'bg-accent-soft text-g-100' : 'text-g-300 hover:bg-g-800'}`}>
                  <Icon name={v.formula.trim() ? 'sigma' : v.type === 'number' ? 'hash' : v.type === 'boolean' ? 'circle-dot' : 'type'} size={13} className={computed.errorById[v.id] ? 'text-red-400' : 'text-g-400'} />
                  <span className="min-w-0 flex-1 truncate">{v.name || <i className="text-g-500">sem nome</i>}</span>
                  <span className={`tabular-nums ${computed.errorById[v.id] ? 'text-red-400' : 'text-g-400'}`}>{computed.errorById[v.id] ? 'erro' : formatValue(computed.byId[v.id])}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="min-w-0 flex-1 overflow-y-auto">
        {sel ? <VariableForm key={sel.id} v={sel} onDelete={() => remove(sel.id)} /> : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-g-500">Selecione uma variável para editar,<br />ou crie uma nova.</div>
        )}
      </section>
    </div>
  );
}

const safeParse = (f: string, names: string[] = []) => { try { return parse(f, names); } catch { return { kind: 'num', value: 0, pos: 0, end: 0 } as ReturnType<typeof parse>; } };
function uniqueName(base: string, vs: Variable[]) {
  let n = base, i = 2;
  while (vs.some((v) => keyOf(v.name) === keyOf(n))) n = `${base} ${i++}`;
  return n;
}

function VariableForm({ v, onDelete }: { v: Variable; onDelete: () => void }) {
  const variables = useRules((s) => s.variables);
  const update = useRules((s) => s.update);
  const computed = useMemo(() => computeVariables(variables), [variables]);
  const others = variables.filter((x) => x.id !== v.id);
  const patch = (p: Partial<Variable>) => update((vs) => vs.map((x) => (x.id === v.id ? { ...x, ...p } : x)));
  const [nameError, setNameError] = useState('');
  const groups = [...new Set(variables.map((x) => x.group).filter(Boolean))];
  const hasFormula = v.formula.trim() !== '';
  const usedBy = others.filter((o) => o.formula && collectVars(safeParse(o.formula, variables.map((q) => q.name))).has(v.name) || o.formula && [...collectVars(safeParse(o.formula, variables.map((q) => q.name)))].some((n) => keyOf(n) === keyOf(v.name)));

  const rename = (name: string) => {
    const n = name.trim();
    const problem = nameProblem(n, others.map((o) => o.name));
    if (problem) return setNameError(problem);
    setNameError('');
    if (n === v.name) return;
    // mantém as fórmulas que referenciam o nome antigo funcionando
    update((vs) => vs.map((x) => (x.id === v.id ? { ...x, name: n } : { ...x, formula: x.formula ? renameInFormula(x.formula, v.name, n, vs.map((q) => q.name)) : x.formula })));
  };
  const setType = (type: VarType) => patch({ type, initial: coerce(v.initial, type) });
  const err = computed.errorById[v.id];

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CommitInput className="w-full border-b border-transparent bg-transparent pb-1 text-2xl font-semibold hover:border-g-600 focus:border-accent focus:outline-none" value={v.name} placeholder="Nome da variável" onCommit={rename} aria-label="Nome" />
          {nameError && <div className="mt-1 text-sm text-red-300" role="alert">{nameError}</div>}
        </div>
        <button className="btn btn-danger" onClick={onDelete}><Icon name="trash" size={13} /> Excluir</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label><span className="mb-1 block text-xs text-g-400">Tipo de dado</span>
          <select className="field" value={v.type} onChange={(e) => setType(e.target.value as VarType)}>
            <option value="number">Número</option><option value="text">Texto</option><option value="boolean">Verdadeiro / falso</option>
          </select></label>
        <label><span className="mb-1 block text-xs text-g-400">Grupo (livre — você define)</span>
          <input className="field" list="rpg-groups" value={v.group} onChange={(e) => patch({ group: e.target.value })} placeholder="Ex.: Atributos, Recursos…" />
          <datalist id="rpg-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></label>
      </div>

      <label className="block"><span className="mb-1 block text-xs text-g-400">Descrição</span>
        <textarea className="field min-h-[56px]" value={v.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Para que serve? (opcional)" /></label>

      <div className="rounded-xl border border-g-700 bg-g-850 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">{hasFormula ? 'Valor calculado' : 'Valor inicial'}</div>
          <div className={`rounded-md px-2.5 py-1 text-sm tabular-nums ${err ? 'bg-red-500/15 text-red-300' : 'bg-g-700 text-g-100'}`}>
            {err ? 'erro' : `= ${formatValue(computed.byId[v.id])}`}
          </div>
        </div>
        {!hasFormula && (
          <div className="mb-4 max-w-xs">
            {v.type === 'number' ? <NumberField value={Number(v.initial) || 0} onChange={(n) => patch({ initial: n })} />
              : v.type === 'boolean' ? <label className="flex items-center gap-2"><input type="checkbox" checked={v.initial === true} onChange={(e) => patch({ initial: e.target.checked })} /> Verdadeiro</label>
              : <CommitInput value={String(v.initial)} onCommit={(t) => patch({ initial: t })} />}
          </div>
        )}
        <div className="mb-1 text-xs text-g-400">Fórmula {hasFormula ? '(substitui o valor inicial)' : '(opcional — deixe vazio para usar o valor inicial)'}</div>
        <FormulaEditor value={v.formula} onChange={(f) => patch({ formula: f })} names={variables.map((x) => x.name).filter(Boolean)} selfName={v.name} error={err} />
      </div>

      {usedBy.length > 0 && (
        <div className="text-sm text-g-400">Usada nas fórmulas de: {usedBy.map((u) => <span key={u.id} className="mr-1.5 rounded bg-g-800 px-1.5 py-0.5 text-g-200">{u.name}</span>)}</div>
      )}
      <p className="text-xs text-g-500">
        Dica: renomear uma variável atualiza automaticamente as fórmulas que a usam. Para ver o efeito das fórmulas com valores diferentes, altere os valores iniciais ou use o modo Jogar numa ficha.
      </p>
    </div>
  );
}
