export { FormulaError } from './errors';
export type { FormulaErrorCode } from './errors';
export { parse, collectVars } from './parser';
export type { Node } from './parser';
export { evaluate } from './evaluate';
export { computeAll, analyze, keyOf, suggest } from './graph';
export type { VarDef, ComputeResult } from './graph';
export { FUNCTION_NAMES } from './functions';
export { renameInFormula, formatIdent, nameProblem } from './rename';
export type { Value } from './functions';

import { evaluate } from './evaluate';
import { parse } from './parser';
import type { Value } from './functions';

/** Avalia uma fórmula isolada com um mapa simples de variáveis (útil em testes e pré-visualização). */
export function evalFormula(src: string, vars: Record<string, Value> = {}): Value {
  const lower = new Map(Object.entries(vars).map(([k, v]) => [k.normalize('NFC').toLowerCase(), v]));
  return evaluate(parse(src, Object.keys(vars)), {
    getVar(name) {
      const k = name.normalize('NFC').toLowerCase();
      if (!lower.has(k)) throw new Error(`variável ausente: ${name}`);
      return lower.get(k)!;
    },
  });
}
