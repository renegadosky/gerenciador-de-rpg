import { FormulaError } from './errors';

export type Value = number | string | boolean;
export interface FnDef {
  min: number;
  max: number;
  /** funções "lazy" recebem thunks (usado por `se`, para só avaliar o ramo escolhido) */
  lazy?: boolean;
  run: (args: any[], pos: number) => Value;
}

const num = (v: Value, fn: string, pos: number): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v.replace(',', '.'));
  if (v.trim() !== '' && Number.isFinite(n)) return n;
  throw new FormulaError('TYPE', `${fn}() precisa de números, mas recebeu o texto "${v}".`, pos);
};

const nums = (name: string) => (a: Value[], pos: number) => a.map((v) => num(v, name, pos));

const F: Record<string, FnDef> = {};
const def = (names: string[], d: FnDef) => names.forEach((n) => (F[n] = d));

def(['min', 'menor'], { min: 1, max: Infinity, run: (a, p) => Math.min(...nums('min')(a, p)) });
def(['max', 'maior'], { min: 1, max: Infinity, run: (a, p) => Math.max(...nums('max')(a, p)) });
def(['soma', 'sum'], { min: 1, max: Infinity, run: (a, p) => nums('soma')(a, p).reduce((x, y) => x + y, 0) });
def(['media', 'média', 'avg'], { min: 1, max: Infinity, run: (a, p) => { const n = nums('media')(a, p); return n.reduce((x, y) => x + y, 0) / n.length; } });
def(['abs'], { min: 1, max: 1, run: (a, p) => Math.abs(num(a[0], 'abs', p)) });
def(['piso', 'floor'], { min: 1, max: 1, run: (a, p) => Math.floor(num(a[0], 'piso', p)) });
def(['teto', 'ceil'], { min: 1, max: 1, run: (a, p) => Math.ceil(num(a[0], 'teto', p)) });
def(['arredondar', 'round'], {
  min: 1, max: 2,
  run: (a, p) => {
    const d = a[1] === undefined ? 0 : num(a[1], 'arredondar', p);
    const f = 10 ** d;
    return Math.round(num(a[0], 'arredondar', p) * f) / f;
  },
});
def(['raiz', 'sqrt'], {
  min: 1, max: 1,
  run: (a, p) => {
    const n = num(a[0], 'raiz', p);
    if (n < 0) throw new FormulaError('TYPE', 'Não existe raiz quadrada de número negativo.', p);
    return Math.sqrt(n);
  },
});
def(['potencia', 'potência', 'pow'], { min: 2, max: 2, run: (a, p) => num(a[0], 'potencia', p) ** num(a[1], 'potencia', p) });
def(['limitar', 'clamp'], {
  min: 3, max: 3,
  run: (a, p) => Math.min(Math.max(num(a[0], 'limitar', p), num(a[1], 'limitar', p)), num(a[2], 'limitar', p)),
});
def(['se', 'if'], {
  min: 3, max: 3, lazy: true,
  run: (t) => {
    const c = t[0]();
    const truthy = typeof c === 'boolean' ? c : typeof c === 'number' ? c !== 0 : c !== '';
    return truthy ? t[1]() : t[2]();
  },
});

export const FUNCTIONS = F;
export const FUNCTION_NAMES = Object.keys(F);
export { num as toNumber };
