import { Component, ErrorInfo, ReactNode, useEffect, useRef, useState } from 'react';
import type { SaveStatus } from '../lib/autosave';
import { useToasts } from '../stores/toast';
import { Icon } from './Icon';

export function Spinner({ size = 16 }: { size?: number }) {
  return <Icon name="loader" size={size} className="animate-spin text-g-400" />;
}

export function FullCenter({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full items-center justify-center p-6 text-g-300">{children}</div>;
}

export function ErrorState({ title = 'Algo deu errado', message, action }: { title?: string; message?: string; action?: ReactNode }) {
  return (
    <FullCenter>
      <div className="max-w-md text-center">
        <Icon name="alert" size={28} className="mx-auto mb-3 text-amber-400" />
        <div className="mb-1 text-base font-semibold text-g-100">{title}</div>
        {message && <div className="mb-4 text-sm text-g-400">{message}</div>}
        {action}
      </div>
    </FullCenter>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); }
  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="Erro inesperado na interface"
          message={this.state.error.message}
          action={<button className="btn" onClick={() => location.reload()}>Recarregar</button>}
        />
      );
    }
    return this.props.children;
  }
}

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`anim-in pointer-events-auto max-w-sm cursor-pointer rounded-lg border px-3 py-2 text-sm shadow-xl ${
            t.kind === 'error' ? 'border-red-500/40 bg-red-950/90 text-red-100'
              : t.kind === 'success' ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
              : 'border-g-600 bg-g-800 text-g-100'}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, width = 440 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        className="anim-in w-full rounded-xl border border-g-700 bg-g-850 shadow-2xl"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-g-700 px-4 py-3">
          <div className="text-base font-semibold">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="x" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Excluir', onConfirm, onClose }: {
  title: string; message: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-g-300">{message}</p>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-danger border-red-500/50 text-red-300" disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); onClose(); } }}
        >{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function SaveBadge({ status, error }: { status: SaveStatus; error?: string | null }) {
  const map: Record<SaveStatus, { icon: string; text: string; cls: string }> = {
    idle: { icon: 'cloud', text: 'Salvo', cls: 'text-g-400' },
    saved: { icon: 'check', text: 'Salvo', cls: 'text-emerald-400' },
    dirty: { icon: 'pencil', text: 'Alterações pendentes…', cls: 'text-g-300' },
    saving: { icon: 'loader', text: 'Salvando…', cls: 'text-g-300' },
    error: { icon: 'cloud-off', text: 'Falha ao salvar — tentando de novo', cls: 'text-amber-400' },
    conflict: { icon: 'alert', text: 'Conflito: recarregue a página', cls: 'text-red-400' },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${m.cls}`} title={error ?? undefined} role="status">
      <Icon name={m.icon} size={13} className={status === 'saving' ? 'animate-spin' : ''} /> {m.text}
    </span>
  );
}

/** Aviso do navegador ao fechar a aba com alterações ainda não gravadas. */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [active]);
}

/** Campo de texto que só confirma ao sair/Enter (evita gravar a cada tecla). */
export function CommitInput({ value, onCommit, className = 'field', onBlur, ...rest }: {
  value: string; onCommit: (v: string) => void; className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setV(value), [value]);
  return (
    <input
      {...rest} ref={ref} className={className} value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={(e) => { if (v !== value) onCommit(v); onBlur?.(e); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') ref.current?.blur();
        if (e.key === 'Escape') { setV(value); ref.current?.blur(); }
        e.stopPropagation();
      }}
    />
  );
}

/** Campo numérico com arrastar-no-rótulo para ajustar, como em editores de design. */
export function NumberField({ label, value, onChange, step = 1, min, max, suffix, width, decimals = 2, title }: {
  label?: string; value: number | ''; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; width?: number | string; decimals?: number; title?: string;
}) {
  const [text, setText] = useState(fmt(value, decimals));
  useEffect(() => setText(fmt(value, decimals)), [value, decimals]);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const commit = () => {
    const n = parseFloat(text.replace(',', '.'));
    if (Number.isFinite(n)) onChange(clamp(n)); else setText(fmt(value, decimals));
  };
  const scrub = (e: React.PointerEvent) => {
    if (value === '') return;
    e.preventDefault();
    const startX = e.clientX, start = Number(value);
    const move = (ev: PointerEvent) => onChange(clamp(round(start + Math.round((ev.clientX - startX) / 2) * step * (ev.shiftKey ? 10 : 1), decimals)));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <label className="flex min-w-0 items-center gap-1 rounded-md border border-g-700 bg-g-850 px-1.5 hover:border-g-600 focus-within:border-accent" style={{ width }} title={title}>
      {label && <span onPointerDown={scrub} className="cursor-ew-resize select-none text-xs text-g-400">{label}</span>}
      <input
        className="w-full min-w-0 bg-transparent py-1 text-sm outline-none"
        value={text} inputMode="decimal"
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            onChange(clamp(round((Number(value) || 0) + d, decimals)));
          }
        }}
      />
      {suffix && <span className="text-xs text-g-500">{suffix}</span>}
    </label>
  );
}
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const fmt = (v: number | '', d: number) => (v === '' ? '' : String(round(Number(v), d)));

export function ColorField({ value, onChange, allowEmpty }: { value: string | undefined; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value ?? '') ? (value as string) : '#000000';
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="h-6 w-6 shrink-0 cursor-pointer rounded border border-g-700 bg-transparent p-0" aria-label="Cor" />
      <CommitInput className="field !py-0.5 font-mono" value={value ?? ''} placeholder={allowEmpty ? 'nenhuma' : '#000000'} onCommit={onChange} />
      {allowEmpty && value ? <button className="icon-btn !h-6 !w-6" title="Remover" onClick={() => onChange('')}><Icon name="x" size={12} /></button> : null}
    </div>
  );
}
