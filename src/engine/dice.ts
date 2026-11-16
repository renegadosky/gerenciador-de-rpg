import { FormulaError, evaluate, parse, Value } from './formula';

export interface RollResult {
  ok: boolean;
  total: number;
  /** texto legível: "2d6 [4+2] + 3 = 9" */
  text: string;
  error?: string;
}

const DICE = /(\d*)\s*d\s*(\d+)(?:\s*(kh|kl)\s*(\d+))?/gi;
const MAX_DICE = 100, MAX_FACES = 1000;

/**
 * Rola uma expressão como `2d6 + Força`, `1d20 + [Bônus de Ataque]` ou `4d6kh3` (mantém os 3 maiores).
 * Os dados são sorteados aqui; o restante da expressão passa pelo mesmo motor de fórmulas (seguro, sem eval).
 * `rng` é injetável para testes.
 */
export function rollDice(
  expr: string,
  names: string[],
  lookup: (name: string) => Value | undefined,
  rng: () => number = Math.random,
): RollResult {
  const src = expr.trim();
  if (!src) return { ok: false, total: 0, text: '', error: 'Escreva uma expressão, ex.: 1d20 + Força.' };
  try {
    let shown = src;
    let numeric = src;
    // protege nomes de variáveis (ex.: "Nível d4") de serem lidos como dados
    const protectedNames = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
    const holes: string[] = [];
    const hide = (s: string) => {
      let out = s;
      for (const n of protectedNames) {
        if (!/\d*\s*d\s*\d+/i.test(n)) continue;
        const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        out = out.replace(re, (m) => { holes.push(m); return `\u0001${holes.length - 1}\u0002`; });
      }
      return out;
    };
    const unhide = (s: string) => s.replace(/\u0001(\d+)\u0002/g, (_, i) => holes[Number(i)]);

    numeric = hide(src);
    shown = numeric;
    let dice = 0;
    numeric = numeric.replace(DICE, (_m, n, f, keep, k) => {
      const count = n === '' ? 1 : parseInt(n, 10), faces = parseInt(f, 10);
      if (count < 1 || count > MAX_DICE) throw new FormulaError('SYNTAX', `Use entre 1 e ${MAX_DICE} dados por rolagem.`);
      if (faces < 2 || faces > MAX_FACES) throw new FormulaError('SYNTAX', `Os dados têm de 2 a ${MAX_FACES} faces.`);
      dice++;
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(rng() * faces));
      let kept = rolls;
      if (keep) {
        const kk = Math.min(count, Math.max(1, parseInt(k, 10)));
        const sorted = [...rolls].sort((a, b) => a - b);
        kept = keep.toLowerCase() === 'kh' ? sorted.slice(-kk) : sorted.slice(0, kk);
      }
      const sum = kept.reduce((a, b) => a + b, 0);
      shown = shown.replace(_m, `${_m.trim()} [${rolls.join('+')}${keep ? ` → ${sum}` : ''}]`);
      return String(sum);
    });
    if (!dice) throw new FormulaError('SYNTAX', 'Nenhum dado na expressão. Use algo como 1d20 + Força.');
    numeric = unhide(numeric);
    shown = unhide(shown);
    const ast = parse(numeric, names);
    const v = evaluate(ast, {
      getVar(name, pos, end) {
        const val = lookup(name);
        if (val === undefined) throw new FormulaError('UNKNOWN_VARIABLE', `A variável "${name}" não existe ou está com erro.`, pos, end - pos);
        return val;
      },
    });
    const total = typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : parseFloat(String(v));
    if (!Number.isFinite(total)) throw new FormulaError('TYPE', 'O resultado da rolagem não é um número.');
    const rounded = Math.round(total * 100) / 100;
    return { ok: true, total: rounded, text: `${shown} = ${rounded}` };
  } catch (e) {
    return { ok: false, total: 0, text: '', error: e instanceof Error ? e.message : String(e) };
  }
}

export const DICE_PATTERN = DICE;
