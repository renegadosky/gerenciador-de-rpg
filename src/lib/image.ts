export interface ScaledImage { dataUrl: string; width: number; height: number }

const MAX_BYTES = 15 * 1024 * 1024;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('O arquivo não parece ser uma imagem válida.'));
    img.src = src;
  });
}

/**
 * Lê uma imagem e a reduz para no máximo `maxDim` pixels no maior lado,
 * para que a ficha não fique pesada. SVG é mantido como está.
 */
export async function fileToScaledDataUrl(file: File, maxDim = 1600): Promise<ScaledImage> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (PNG, JPG, WebP, GIF ou SVG).');
  if (file.size > MAX_BYTES) throw new Error('A imagem é grande demais (máximo de 15 MB).');
  const raw = await readAsDataUrl(file);
  const img = await loadImage(raw);
  const width = img.naturalWidth || 300, height = img.naturalHeight || 300;
  if (file.type === 'image/svg+xml') return { dataUrl: raw, width, height };
  const scale = Math.min(1, maxDim / Math.max(width, height));
  if (scale === 1 && file.size < 400 * 1024) return { dataUrl: raw, width, height };
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: raw, width, height };
  ctx.drawImage(img, 0, 0, w, h);
  const keepsAlpha = file.type !== 'image/jpeg';
  return { dataUrl: canvas.toDataURL(keepsAlpha ? 'image/webp' : 'image/jpeg', 0.88), width: w, height: h };
}
