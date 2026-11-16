import { useMemo, useRef } from 'react';
import { analyze, formatIdent, FUNCTION_NAMES } from '../engine/formula';

const SHOWN_FUNCTIONS = ['se', 'min', 'max', 'piso', 'teto', 'arredondar', 'limitar', 'soma', 'media', 'raiz', 'abs', 'potencia'];

/**
 * Editor de fórmula com validação ao vivo. Mostra o trecho com problema destacado
 * e uma mensagem em português; variáveis e funções podem ser inseridas com um clique.
 */
export function FormulaEditor({ value, onChange, names, selfName, rows = 3, showChips = true, error }: {
  value: string;
  onChange: (v: string) => void;
  names: string[];
  selfName?: string;
  rows?: number;
  showChips?: boolean;
  /** erro de cálculo (ex.: divisão por zero, ciclo) vindo do avaliador */
  error?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const known = useMemo(() => names, [names.join('\u0000')]);
  const result = useMemo(() => (value.trim() ? analyze(value, known) : null), [value, known]);
  const first = result && !result.ok ? result.errors[0] : null;

  const insert = (text: string) => {
    const el = ref.current;
    if (!el) return onChange(value + text);
    const a = el.selectionStart ?? value.length, b = el.selectionEnd ?? value.length;
    const next = value.slice(0, a) + text + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); const p = a + text.length; el.setSelectionRange(p, p); });
  };

  return (
    <div className="space-y-1.5">
      <textarea
        ref={ref} rows={rows} spellCheck={false}
        className={`field resize-y font-mono ${first ? '!border-red-500/70' : ''}`}
        placeholder="Ex.: Força + (Agilidade / 2)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        aria-invalid={!!first}
      />
      {first && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200" role="alert">
          {first.pos !== undefined && (
            <pre className="mb-1 overflow-x-auto font-mono text-[11px] text-g-200">
              {value.slice(0, first.pos)}
              <span className="rounded-sm bg-red-500/40 underline decoration-wavy decoration-red-300">{value.slice(first.pos, first.pos + Math.max(1, first.length)) || ' '}</span>
              {value.slice(first.pos + Math.max(1, first.length))}
            </pre>
          )}
          {first.message}
          {result!.errors.length > 1 && <span className="text-red-300/70"> (+{result!.errors.length - 1} problema{result!.errors.length > 2 ? 's' : ''})</span>}
        </div>
      )}
      {!first && error && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200" role="alert">{error}</div>}
      {result?.ok && !error && <div className="text-xs text-emerald-400/80">Fórmula válida.</div>}

      {showChips && (
        <details className="text-xs text-g-400">
          <summary className="cursor-pointer select-none hover:text-g-200">Inserir variável ou função</summary>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {names.filter((n) => n && n !== selfName).map((n) => (
              <button key={n} type="button" className="rounded border border-g-700 bg-g-800 px-1.5 py-0.5 text-xs hover:border-accent hover:text-accent" onClick={() => insert(formatIdent(n))}>{n}</button>
            ))}
            {!names.filter((n) => n && n !== selfName).length && <span className="text-g-500">Nenhuma outra variável criada ainda.</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {SHOWN_FUNCTIONS.filter((f) => FUNCTION_NAMES.includes(f)).map((f) => (
              <button key={f} type="button" className="rounded border border-g-700 bg-g-850 px-1.5 py-0.5 font-mono text-xs hover:border-accent hover:text-accent" onClick={() => insert(f + '()')}>{f}()</button>
            ))}
          </div>
          <p className="mt-1.5 leading-4 text-g-500">
            Operadores: + − * / % ^ · comparações: == != &lt; &lt;= &gt; &gt;= · lógica: e, ou, nao. Condição: <span className="font-mono">se(Força &gt;= 10, 2, 0)</span>. Nomes com espaço: <span className="font-mono">[Pontos de Vida]</span>.
          </p>
        </details>
      )}
    </div>
  );
}
