import { FormulaError } from './errors';
import { evaluate } from './evaluate';
import { FUNCTIONS, Value } from './functions';
import { collectVars, Node, parse } from './parser';

export interface VarDef {
  name: string;
  /** valor base (usado quando não há fórmula) */
  value: Value;
  formula?: string;
}

export interface ComputeResult {
  values: Record<string, Value>;
  errors: Record<string, FormulaError>;
  /** ordem topológica usada no cálculo (dependências primeiro) */
  order: string[];
}

export const keyOf = (name: string) => name.normalize('NFC').trim().toLowerCase();

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function suggest(name: string, known: string[]): string | undefined {
  const k = keyOf(name);
  let best: string | undefined, bd = Infinity;
  for (const c of known) {
    const d = levenshtein(k, keyOf(c));
    if (d < bd) { bd = d; best = c; }
  }
  return best !== undefined && bd <= Math.max(2, Math.floor(k.length / 3)) ? best : undefined;
}

/** Percorre a AST conferindo funções, aridade e variáveis existentes. Devolve todos os problemas. */
export function analyze(src: string, knownNames: string[]): { ok: boolean; errors: FormulaError[]; deps: string[] } {
  let ast: Node;
  try {
    ast = parse(src, knownNames);
  } catch (e) {
    if (e instanceof FormulaError) return { ok: false, errors: [e], deps: [] };
    throw e;
  }
  const known = new Set(knownNames.map(keyOf));
  const errors: FormulaError[] = [];
  const deps = new Set<string>();
  const walk = (n: Node) => {
    switch (n.kind) {
      case 'var':
        deps.add(n.name);
        if (!known.has(keyOf(n.name))) {
          const s = suggest(n.name, knownNames);
          errors.push(new FormulaError('UNKNOWN_VARIABLE',
            `A variável "${n.name}" não existe.${s ? ` Você quis dizer "${s}"?` : ''}`, n.pos, n.end - n.pos));
        }
        break;
      case 'unary': walk(n.arg); break;
      case 'binary': walk(n.left); walk(n.right); break;
      case 'call': {
        const def = FUNCTIONS[n.name.toLowerCase()];
        if (!def) {
          const s = suggest(n.name, Object.keys(FUNCTIONS));
          errors.push(new FormulaError('UNKNOWN_FUNCTION',
            `A função "${n.name}" não existe.${s ? ` Você quis dizer "${s}"?` : ''}`, n.pos, n.name.length));
        } else if (n.args.length < def.min || n.args.length > def.max) {
          errors.push(new FormulaError('ARITY', `${n.name}() recebeu ${n.args.length} argumento(s), o que não é válido.`, n.pos, n.end - n.pos));
        }
        n.args.forEach(walk);
        break;
      }
    }
  };
  walk(ast);
  return { ok: errors.length === 0, errors, deps: [...deps] };
}

/**
 * Calcula todas as variáveis respeitando dependências.
 * - Ordenação topológica por DFS, com detecção de ciclos (reporta o caminho A → B → A).
 * - Um erro em uma variável é propagado como DEPENDENCY às que dependem dela, sem derrubar as demais.
 */
export function computeAll(vars: VarDef[]): ComputeResult {
  const byKey = new Map<string, VarDef>();
  for (const v of vars) byKey.set(keyOf(v.name), v);

  const names = vars.map((v) => v.name);
  const asts = new Map<string, Node>();
  const errors: Record<string, FormulaError> = {};
  const values: Record<string, Value> = {};
  const order: string[] = [];
  const state = new Map<string, 0 | 1 | 2>(); // 1 = visitando, 2 = pronto
  const stack: string[] = [];

  const fail = (v: VarDef, e: FormulaError) => { errors[v.name] = e; };

  const visit = (v: VarDef): void => {
    const k = keyOf(v.name);
    if (state.get(k) === 2) return;
    if (state.get(k) === 1) return; // ciclo tratado por quem detectou
    state.set(k, 1);
    stack.push(v.name);

    if (v.formula && v.formula.trim()) {
      let ast: Node | undefined;
      try {
        ast = parse(v.formula, names);
        asts.set(k, ast);
      } catch (e) {
        if (e instanceof FormulaError) fail(v, e); else throw e;
      }
      if (ast) {
        for (const dn of collectVars(ast)) {
          const dep = byKey.get(keyOf(dn));
          if (!dep) continue; // reportado na avaliação
          if (state.get(keyOf(dep.name)) === 1) {
            const from = stack.findIndex((s) => keyOf(s) === keyOf(dep.name));
            const path = [...stack.slice(from), dep.name].join(' → ');
            for (const n of stack.slice(from)) {
              const vv = byKey.get(keyOf(n))!;
              errors[vv.name] = new FormulaError('CYCLE', `Referência circular: ${path}.`);
            }
          } else {
            visit(dep);
          }
        }
      }
    }

    stack.pop();
    state.set(k, 2);
    order.push(v.name);

    if (errors[v.name]) return;
    if (!v.formula || !v.formula.trim()) { values[v.name] = v.value; return; }
    const ast = asts.get(k)!;
    try {
      values[v.name] = evaluate(ast, {
        getVar(name, pos, end) {
          const dep = byKey.get(keyOf(name));
          if (!dep) {
            const s = suggest(name, vars.map((x) => x.name));
            throw new FormulaError('UNKNOWN_VARIABLE', `A variável "${name}" não existe.${s ? ` Você quis dizer "${s}"?` : ''}`, pos, end - pos);
          }
          if (errors[dep.name]) {
            throw new FormulaError('DEPENDENCY', `Depende de "${dep.name}", que está com erro: ${errors[dep.name].message}`, pos, end - pos);
          }
          return values[dep.name];
        },
      });
    } catch (e) {
      if (e instanceof FormulaError) fail(v, e); else throw e;
    }
  };

  for (const v of vars) visit(v);
  return { values, errors, order };
}
