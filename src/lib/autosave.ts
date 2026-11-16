import { ConflictError } from '../data/repository';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

export interface AutosaverOptions {
  delay?: number;
  /** Grava o estado ATUAL (a função lê o que precisa do store no momento da chamada). */
  save: () => Promise<void>;
  onStatus: (s: SaveStatus, error?: Error) => void;
  /** tentativas extras após erro (com espera crescente) */
  retries?: number;
  retryDelay?: number;
}

/**
 * Salvamento automático com debounce.
 * - agrupa várias alterações seguidas em uma só gravação;
 * - nunca roda duas gravações ao mesmo tempo (alterações durante a gravação geram outra em seguida);
 * - tenta de novo após falhas transitórias; conflito de versão não é repetido.
 */
export class Autosaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  private dirty = false;
  private attempts = 0;
  private stopped = false;

  constructor(private o: AutosaverOptions) {}

  get isDirty() { return this.dirty; }

  touch() {
    if (this.stopped) return;
    this.dirty = true;
    this.attempts = 0;
    this.o.onStatus('dirty');
    this.arm(this.o.delay ?? 700);
  }

  private arm(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), ms);
  }

  private async run(): Promise<void> {
    this.timer = null;
    if (this.running) { this.again = true; return; }
    this.running = (async () => {
      do {
        this.again = false;
        this.dirty = false;
        this.o.onStatus('saving');
        try {
          await this.o.save();
          this.attempts = 0;
          if (!this.dirty && !this.again) this.o.onStatus('saved');
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          this.dirty = true;
          if (err instanceof ConflictError) {
            this.stopped = true;
            this.o.onStatus('conflict', err);
            return;
          }
          this.o.onStatus('error', err);
          if (this.attempts < (this.o.retries ?? 3)) {
            this.attempts++;
            this.arm((this.o.retryDelay ?? 2000) * this.attempts);
          }
          return;
        }
      } while (this.again || (this.dirty && !this.timer));
    })();
    try { await this.running; } finally { this.running = null; }
  }

  /** Grava agora (ex.: ao sair da página). */
  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.running) await this.running;
    if (this.dirty && !this.stopped) await this.run();
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stopped = true;
  }
}
