import { FormulaError } from './errors';

export type TokenType = 'num' | 'str' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'eof';
export interface Token {
  type: TokenType;
  value: string;
  pos: number;
  end: number;
}

const isLetter = (c: string) => /\p{L}/u.test(c) || c === '_';
const isDigit = (c: string) => c >= '0' && c <= '9';

/**
 * Identificadores aceitam letras unicode (Força, Agilidade), dígitos e "_".
 * Nomes com espaços usam colchetes: [Pontos de Vida].
 */
export function tokenize(src: string, knownNames: string[] = []): Token[] {
  const out: Token[] = [];
  // nomes conhecidos, do mais longo ao mais curto: "Pontos de Vida" vence "Pontos"
  const names = [...new Set(knownNames.map((n) => n.normalize('NFC').trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((n) => ({ raw: n, lower: n.toLowerCase() }));
  const isWord = (ch: string | undefined) => !!ch && (isLetter(ch) || isDigit(ch));
  const calls: boolean[] = []; // pilha de parênteses: true = chamada de função
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const start = i;

    // variável cujo nome tem espaços ou começa com dígito (ex.: "Nova variável 2")
    if (names.length && !isWord(src[i - 1]) && c !== '[' && c !== '"' && c !== "'") {
      const hit = names.find((n) => src.slice(i, i + n.raw.length).normalize('NFC').toLowerCase() === n.lower && !isWord(src[i + n.raw.length]));
      if (hit && (isLetter(c) || isDigit(c) || hit.raw.includes(' '))) {
        // não confunde com número puro ("2") quando o nome é só dígitos
        if (!/^[\d.,\s]+$/.test(hit.raw)) {
          out.push({ type: 'ident', value: src.slice(i, i + hit.raw.length), pos: i, end: i + hit.raw.length });
          i += hit.raw.length;
          continue;
        }
      }
    }

    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      while (isDigit(src[i] ?? '')) i++;
      if (src[i] === '.') { i++; while (isDigit(src[i] ?? '')) i++; }
      // vírgula decimal (2,5) fora de chamadas de função; dentro delas a vírgula separa argumentos
      else if (src[i] === ',' && isDigit(src[i + 1] ?? '') && !calls[calls.length - 1]) { i++; while (isDigit(src[i] ?? '')) i++; }
      out.push({ type: 'num', value: src.slice(start, i).replace(',', '.'), pos: start, end: i });
      continue;
    }
    if (isLetter(c)) {
      while (i < src.length && (isLetter(src[i]) || isDigit(src[i]))) i++;
      out.push({ type: 'ident', value: src.slice(start, i), pos: start, end: i });
      continue;
    }
    if (c === '[') {
      const close = src.indexOf(']', i + 1);
      if (close < 0) throw new FormulaError('SYNTAX', 'Colchete "[" sem o "]" correspondente.', i);
      const name = src.slice(i + 1, close).trim();
      if (!name) throw new FormulaError('SYNTAX', 'Nome vazio entre colchetes.', i, close - i + 1);
      out.push({ type: 'ident', value: name, pos: i, end: close + 1 });
      i = close + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      let s = '';
      while (i < src.length && src[i] !== q) s += src[i++];
      if (i >= src.length) throw new FormulaError('SYNTAX', 'Texto entre aspas não foi fechado.', start, src.length - start);
      i++;
      out.push({ type: 'str', value: s, pos: start, end: i });
      continue;
    }
    if (c === '(') {
      const prev = out[out.length - 1];
      calls.push(!!prev && prev.type === 'ident' && src[prev.pos] !== '[');
      out.push({ type: 'lparen', value: c, pos: i, end: ++i });
      continue;
    }
    if (c === ')') { calls.pop(); out.push({ type: 'rparen', value: c, pos: i, end: ++i }); continue; }
    if (c === ',' || c === ';') { out.push({ type: 'comma', value: ',', pos: i, end: ++i }); continue; }

    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '<>'].includes(two)) {
      out.push({ type: 'op', value: two === '<>' ? '!=' : two, pos: i, end: i + 2 });
      i += 2;
      continue;
    }
    if ('+-*/%^<>=!'.includes(c)) {
      out.push({ type: 'op', value: c === '=' ? '==' : c, pos: i, end: ++i });
      continue;
    }
    throw new FormulaError('SYNTAX', `Caractere inesperado "${c}".`, i);
  }
  out.push({ type: 'eof', value: '', pos: src.length, end: src.length });
  return out;
}
