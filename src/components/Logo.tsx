/** Marca: hexágono com losango (um "dado" visto de cima), na cor de destaque do tema. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16 3.5l10.8 6.25v12.5L16 28.5 5.2 22.25V9.75z" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinejoin="round" fill="rgb(var(--accent) / .14)" />
      <path d="M16 10l5 6-5 6-5-6z" fill="rgb(var(--accent))" />
      <path d="M16 3.5V10M26.8 9.75L21 16M26.8 22.25L21 16M16 28.5V22M5.2 22.25L11 16M5.2 9.75L11 16" stroke="rgb(var(--accent) / .55)" strokeWidth="1.2" />
    </svg>
  );
}
