import { FormulaError } from './errors';
import { FUNCTIONS, Value, toNumber } from './functions';
import { Node } from './parser';

export interface EvalContext {
  /** devolve o valor atual da variável ou lança FormulaError */
  getVar(name: string, pos: number, end: number): Value;
}

const truthy = (v: Value) => (typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : v !== '');

const isNumericLike = (v: Value) => typeof v === 'number' || typeof v === 'boolean';

export function evaluate(n: Node, ctx: EvalContext): Value {
  switch (n.kind) {
    case 'num': case 'str': case 'bool': return n.value;
    case 'var': return ctx.getVar(n.name, n.pos, n.end);
    case 'unary': {
      const v = evaluate(n.arg, ctx);
      if (n.op === '!') return !truthy(v);
      const x = toNumber(v, n.op, n.pos);
      return n.op === '-' ? -x : x;
    }
    case 'call': {
      const def = FUNCTIONS[n.name.toLowerCase()];
      if (!def) throw new FormulaError('UNKNOWN_FUNCTION', `A função "${n.name}" não existe.`, n.pos, n.name.length);
      if (n.args.length < def.min || n.args.length > def.max) {
        const exp = def.min === def.max ? `${def.min}` : def.max === Infinity ? `pelo menos ${def.min}` : `${def.min} a ${def.max}`;
        throw new FormulaError('ARITY', `${n.name}() espera ${exp} argumento(s), mas recebeu ${n.args.length}.`, n.pos, n.end - n.pos);
      }
      const args = def.lazy ? n.args.map((a) => () => evaluate(a, ctx)) : n.args.map((a) => evaluate(a, ctx));
      return def.run(args, n.pos);
    }
    case 'binary': {
      if (n.op === '&&') return truthy(evaluate(n.left, ctx)) && truthy(evaluate(n.right, ctx));
      if (n.op === '||') return truthy(evaluate(n.left, ctx)) || truthy(evaluate(n.right, ctx));
      const a = evaluate(n.left, ctx);
      const b = evaluate(n.right, ctx);
      switch (n.op) {
        case '==': return isNumericLike(a) && isNumericLike(b) ? +a === +b : a === b;
        case '!=': return isNumericLike(a) && isNumericLike(b) ? +a !== +b : a !== b;
        case '<': case '<=': case '>': case '>=': {
          if (typeof a === 'string' && typeof b === 'string') {
            return n.op === '<' ? a < b : n.op === '<=' ? a <= b : n.op === '>' ? a > b : a >= b;
          }
          const x = toNumber(a, n.op, n.pos), y = toNumber(b, n.op, n.pos);
          return n.op === '<' ? x < y : n.op === '<=' ? x <= y : n.op === '>' ? x > y : x >= y;
        }
      }
      const x = toNumber(a, n.op, n.left.pos), y = toNumber(b, n.op, n.right.pos);
      switch (n.op) {
        case '+':
          // "+" concatena quando algum lado é texto não numérico
          return x + y;
        case '-': return x - y;
        case '*': return x * y;
        case '/':
          if (y === 0) throw new FormulaError('DIV_ZERO', 'Divisão por zero.', n.right.pos, n.right.end - n.right.pos);
          return x / y;
        case '%':
          if (y === 0) throw new FormulaError('DIV_ZERO', 'Resto da divisão por zero.', n.right.pos, n.right.end - n.right.pos);
          return x % y;
        case '^': return x ** y;
      }
      throw new FormulaError('SYNTAX', `Operador desconhecido "${n.op}".`, n.pos);
    }
  }
}
