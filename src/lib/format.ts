import { keyOf } from '../engine/formula';
import type { Value } from '../types';

export function formatNumber(v: number, decimals?: number): string {
  if (!Number.isFinite(v)) return '—';
  if (decimals !== undefined && decimals !== null && (decimals as unknown) !== '') {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: Number(decimals), maximumFractionDigits: Number(decimals) });
  }
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

export function formatValue(v: Value | undefined): string {
  if (v === undefined) return '';
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  return v;
}

/** Substitui {Nome} pelo valor atual da variável. Nomes desconhecidos ficam visíveis como {Nome}. */
export function interpolate(text: string, lookup: (name: string) => Value | undefined): string {
  return text.replace(/\{([^{}]+)\}/g, (m, name: string) => {
    const v = lookup(name.trim());
    return v === undefined ? m : formatValue(v);
  });
}

export const hasTemplate = (s: string) => /\{[^{}]+\}/.test(s);

export function toNumberSafe(v: Value | undefined, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : fallback; }
  return fallback;
}
export function truthy(v: Value | undefined): boolean {
  return typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : typeof v === 'string' ? v !== '' : false;
}
export { keyOf };
