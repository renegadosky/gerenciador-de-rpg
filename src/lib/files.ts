/** Baixa um objeto como arquivo .json. */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function readJsonFile(file: File): Promise<unknown> {
  if (file.size > 60 * 1024 * 1024) throw new Error('O arquivo é grande demais.');
  const text = await file.text();
  try { return JSON.parse(text); } catch { throw new Error('O arquivo não é um JSON válido.'); }
}

export const safeFileName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'arquivo';
