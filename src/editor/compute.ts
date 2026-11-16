import { computeAll, keyOf, Value } from '../engine/formula';
import type { SceneNode, Variable } from '../types';

export interface Computed {
  /** valor de cada variável (por id); `undefined` quando há erro */
  byId: Record<string, Value | undefined>;
  /** mensagem de erro por id de variável */
  errorById: Record<string, string>;
  /** nome (normalizado) → valor, usado nas interpolações {Nome} */
  byName: Map<string, Value>;
  /** variáveis calculadas por fórmula (somente leitura) */
  isFormula: Set<string>;
}

/**
 * Calcula o valor de todas as variáveis. `overrides` traz os valores "de jogo" das variáveis
 * que não têm fórmula; sem override, vale o valor inicial.
 */
export function computeVariables(variables: Variable[], overrides: Record<string, Value> = {}): Computed {
  const named = variables.filter((v) => v.name.trim());
  const res = computeAll(named.map((v) => ({
    name: v.name,
    value: coerce(overrides[v.id] ?? v.initial, v.type),
    formula: v.formula,
  })));
  const byId: Computed['byId'] = {}, errorById: Computed['errorById'] = {}, byName = new Map<string, Value>();
  const isFormula = new Set<string>();
  for (const v of named) {
    if (v.formula.trim()) isFormula.add(v.id);
    const err = res.errors[v.name];
    if (err) errorById[v.id] = err.message;
    else if (v.name in res.values) { byId[v.id] = res.values[v.name]; byName.set(keyOf(v.name), res.values[v.name]); }
  }
  return { byId, errorById, byName, isFormula };
}

export function coerce(v: Value, type: Variable['type']): Value {
  if (type === 'number') {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  if (type === 'boolean') return typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : v === 'true' || v === 'sim';
  return typeof v === 'string' ? v : String(v);
}

/** id da variável implícita criada para um campo que tem fórmula própria */
export const nodeVarId = (nodeId: string) => `node:${nodeId}`;

/**
 * Campos (número, barra, indicador) podem ter uma fórmula direta, sem variável cadastrada.
 * Cada um vira uma variável oculta que entra no mesmo cálculo das demais.
 */
export function nodeFormulaVars(nodes: SceneNode[]): Variable[] {
  return nodes
    .filter((n) => typeof n.data.formula === 'string' && n.data.formula.trim() && !n.data.bind)
    .map((n) => ({
      id: nodeVarId(n.id), name: `__campo_${n.id.replace(/[^a-zA-Z0-9]/g, '')}`, type: 'number' as const,
      initial: 0, formula: n.data.formula as string, group: '', description: '',
    }));
}
