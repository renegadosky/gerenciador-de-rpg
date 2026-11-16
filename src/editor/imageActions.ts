import { fileToScaledDataUrl } from '../lib/image';
import { errMsg, toast } from '../stores/toast';
import { useEditor } from '../stores/editor';
import { createNode } from './defaults';
import * as ops from './sceneOps';
import { runtime } from './runtime';
import { toWorld } from './viewport';

/** Cria um elemento de imagem a partir de um arquivo (arrastar, colar ou ferramenta de imagem). */
export async function addImageFromFile(file: File, at?: { x: number; y: number }) {
  try {
    const img = await fileToScaledDataUrl(file);
    const k = Math.min(1, 420 / Math.max(img.width, img.height));
    const w = Math.round(img.width * k), h = Math.round(img.height * k);
    const st = useEditor.getState();
    const c = at ?? toWorld(st.viewport, runtime.stage.w / 2, runtime.stage.h / 2);
    const node = createNode('image', { x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2) }, { w, h });
    node.data = { ...node.data, src: img.dataUrl };
    node.name = file.name.replace(/\.[^.]+$/, '') || 'Imagem';
    node.aspectLocked = true;
    st.addNodes([node]);
  } catch (e) {
    toast.error(errMsg(e));
  }
}

/** Troca a imagem de um elemento existente. */
export async function setImageFile(id: string, file: File) {
  try {
    const img = await fileToScaledDataUrl(file);
    useEditor.getState().commit((s) => ops.updateData(s, id, { src: img.dataUrl }));
  } catch (e) {
    toast.error(errMsg(e));
  }
}
