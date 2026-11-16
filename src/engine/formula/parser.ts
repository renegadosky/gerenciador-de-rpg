import { FormulaError } from './errors';
import { tokenize, Token } from './lexer';

export type Node =
  | { kind: 'num'; value: number; pos: number; end: number }
  | { kind: 'str'; value: string; pos: number; end: number }
  | { kind: 'bool'; value: boolean; pos: number; end: number }
  | { kind: 'var'; name: string; pos: number; end: number }
  | { kind: 'unary'; op: '-' | '+' | '!'; arg: Node; pos: number; end: number }
  | { kind: 'binary'; op: string; left: Node; right: Node; pos: number; end: number }
  | { kind: 'call'; name: string; args: Node[]; pos: number; end: number };

// [precedência esquerda, associatividade direita?]
const BINARY: Record<string, [number, boolean]> = {
  '||': [1, false],
  '&&': [2, false],
  '==': [3, false], '!=': [3, false],
  '<': [4, false], '<=': [4, false], '>': [4, false], '>=': [4, false],
  '+': [5, false], '-': [5, false],
  '*': [6, false], '/': [6, false], '%': [6, false],
  '^': [8, true],
};
const UNARY_PREC = 7;

const WORD_OPS: Record<string, string> = { e: '&&', ou: '||' };

class Parser {
  private i = 0;
  constructor(private toks: Token[], private src: string) {}

  private peek() { return this.toks[this.i]; }
  private next() { return this.toks[this.i++]; }

  parse(): Node {
    if (this.peek().type === 'eof') throw new FormulaError('SYNTAX', 'A fórmula está vazia.', 0);
    const n = this.expr(0);
    const t = this.peek();
    if (t.type !== 'eof') {
      throw new FormulaError('SYNTAX', t.type === 'rparen'
        ? 'Parêntese ")" sem o "(" correspondente.'
        : `Não esperava "${t.value}" aqui. Faltou um operador (+, -, *, /) antes?`, t.pos, t.end - t.pos);
    }
    return n;
  }

  private binOp(t: Token): string | null {
    if (t.type === 'op' && BINARY[t.value]) return t.value;
    if (t.type === 'ident' && WORD_OPS[t.value.toLowerCase()] && this.src[t.pos] !== '[') return WORD_OPS[t.value.toLowerCase()];
    return null;
  }

  private expr(minPrec: number): Node {
    let left = this.prefix();
    for (;;) {
      const t = this.peek();
      const op = this.binOp(t);
      if (!op) break;
      const [prec, right] = BINARY[op];
      if (prec < minPrec) break;
      this.next();
      const rhs = this.expr(right ? prec : prec + 1);
      left = { kind: 'binary', op, left, right: rhs, pos: left.pos, end: rhs.end };
    }
    return left;
  }

  private prefix(): Node {
    const t = this.next();
    switch (t.type) {
      case 'num': return { kind: 'num', value: parseFloat(t.value), pos: t.pos, end: t.end };
      case 'str': return { kind: 'str', value: t.value, pos: t.pos, end: t.end };
      case 'lparen': {
        const n = this.expr(0);
        const c = this.next();
        if (c.type !== 'rparen') throw new FormulaError('SYNTAX', 'Faltou fechar o parêntese ")".', t.pos, 1);
        return n;
      }
      case 'op':
        if (t.value === '-' || t.value === '+' || t.value === '!') {
          const arg = this.expr(UNARY_PREC);
          return { kind: 'unary', op: t.value, arg, pos: t.pos, end: arg.end };
        }
        throw new FormulaError('SYNTAX', `O operador "${t.value}" precisa de um valor antes dele.`, t.pos, t.end - t.pos);
      case 'ident': {
        const bracketed = this.src[t.pos] === '[';
        const lower = t.value.toLowerCase();
        if (!bracketed) {
          if (lower === 'verdadeiro' || lower === 'true') return { kind: 'bool', value: true, pos: t.pos, end: t.end };
          if (lower === 'falso' || lower === 'false') return { kind: 'bool', value: false, pos: t.pos, end: t.end };
          if (lower === 'nao' || lower === 'não') {
            const arg = this.expr(UNARY_PREC);
            return { kind: 'unary', op: '!', arg, pos: t.pos, end: arg.end };
          }
          if (this.peek().type === 'lparen') {
            this.next();
            const args: Node[] = [];
            if (this.peek().type !== 'rparen') {
              for (;;) {
                args.push(this.expr(0));
                if (this.peek().type === 'comma') { this.next(); continue; }
                break;
              }
            }
            const c = this.next();
            if (c.type !== 'rparen') throw new FormulaError('SYNTAX', `Faltou fechar o parêntese da função ${t.value}(...).`, t.pos, t.end - t.pos);
            return { kind: 'call', name: t.value, args, pos: t.pos, end: c.end };
          }
        }
        return { kind: 'var', name: t.value, pos: t.pos, end: t.end };
      }
      case 'eof':
        throw new FormulaError('SYNTAX', 'A fórmula terminou antes do esperado. Falta um valor no final.', t.pos);
      default:
        throw new FormulaError('SYNTAX', `Não esperava "${t.value}" aqui.`, t.pos, t.end - t.pos);
    }
  }
}

export function parse(src: string, knownNames: string[] = []): Node {
  return new Parser(tokenize(src, knownNames), src).parse();
}

/** Nomes de variáveis referenciados na fórmula (sem repetição). */
export function collectVars(n: Node, acc: Set<string> = new Set()): Set<string> {
  switch (n.kind) {
    case 'var': acc.add(n.name); break;
    case 'unary': collectVars(n.arg, acc); break;
    case 'binary': collectVars(n.left, acc); collectVars(n.right, acc); break;
    case 'call': n.args.forEach((a) => collectVars(a, acc)); break;
  }
  return acc;
}
