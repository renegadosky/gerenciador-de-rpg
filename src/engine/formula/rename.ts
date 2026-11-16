import { keyOf } from './graph';
import { tokenize } from './lexer';

const RESERVED = new Set(['e', 'ou', 'nao', 'não', 'verdadeiro', 'falso', 'true', 'false']);

/** Como escrever o nome de uma variável dentro de uma fórmula (usa [colchetes] quando necessário). */
export function formatIdent(name: string): string {
  const plain = /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) && !RESERVED.has(name.toLowerCase());
  return plain ? name : `[${name}]`;
}

/** Reescreve referências a `from` para `to`, sem tocar em funções, textos entre aspas ou outros nomes. */
export function renameInFormula(src: string, from: string, to: string, knownNames: string[] = []): string {
  let toks;
  try { toks = tokenize(src, [...knownNames, from]); } catch { return src; }
  let out = '', last = 0;
  toks.forEach((t, i) => {
    if (t.type !== 'ident' || keyOf(t.value) !== keyOf(from)) return;
    const bracketed = src[t.pos] === '[';
    if (!bracketed && toks[i + 1]?.type === 'lparen') return; // é chamada de função
    out += src.slice(last, t.pos) + formatIdent(to);
    last = t.end;
  });
  return out + src.slice(last);
}

/** Motivo pelo qual um nome de variável não é aceitável (ou null se estiver ok). */
export function nameProblem(name: string, others: string[]): string | null {
  const n = name.trim();
  if (!n) return 'Dê um nome à variável.';
  if (n.length > 80) return 'O nome é longo demais (máx. 80 caracteres).';
  if (/[\]\[]/.test(n)) return 'O nome não pode conter colchetes.';
  if (others.some((o) => keyOf(o) === keyOf(n))) return 'Já existe uma variável com este nome.';
  return null;
}
