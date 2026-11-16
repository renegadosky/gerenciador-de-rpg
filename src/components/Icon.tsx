import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceBetween,
  AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceBetween, AlertTriangle, ArrowLeft, Book, Bone, BringToFront,
  Check, ChevronDown, ChevronRight, Cloud, CloudOff, Coins, Compass, Copy, Crown, CircleDot, Dices, Droplet, Eye, EyeOff,
  FileText, Flame, FlaskConical, FolderOpen, Footprints, Gauge, Gem, Grid3x3, Group, Hand, Hash, Heart, Image, Key, Leaf,
  Library, List, ListChecks, Loader2, Lock, LogOut, LucideIcon, Magnet, Map, Minus, Moon, MousePointer2,
  MousePointerClick, Network, Pencil, Play, Plus, Redo2, Ruler, Scroll, SendToBack, Shapes, Shield, Sigma, Skull, Smile,
  Square, Star, Sun, Sword, Table, TextCursor, Trash2, Type, Undo2, Ungroup, Unlock, X, Zap, Scissors, ClipboardPaste, Upload,
  RotateCcw, Palette, Layers, SlidersHorizontal, Settings2, FilePlus2, Search,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  'align-start-v': AlignStartVertical, 'align-center-v': AlignCenterVertical, 'align-end-v': AlignEndVertical,
  'align-start-h': AlignStartHorizontal, 'align-center-h': AlignCenterHorizontal, 'align-end-h': AlignEndHorizontal,
  'space-h': AlignHorizontalSpaceBetween, 'space-v': AlignVerticalSpaceBetween,
  alert: AlertTriangle, back: ArrowLeft, front: BringToFront, backmost: SendToBack, check: Check, down: ChevronDown, right: ChevronRight,
  cloud: Cloud, 'cloud-off': CloudOff, copy: Copy, 'circle-dot': CircleDot, eye: Eye, 'eye-off': EyeOff,
  file: FileText, folder: FolderOpen, gauge: Gauge, grid: Grid3x3, group: Group, hand: Hand, hash: Hash, image: Image,
  library: Library, list: List, 'list-checks': ListChecks, loader: Loader2, lock: Lock, unlock: Unlock, logout: LogOut,
  magnet: Magnet, minus: Minus, 'mouse-pointer': MousePointer2, 'mouse-pointer-click': MousePointerClick, network: Network,
  pencil: Pencil, play: Play, plus: Plus, redo: Redo2, undo: Undo2, ruler: Ruler, shapes: Shapes, sigma: Sigma, smile: Smile,
  square: Square, table: Table, 'text-cursor': TextCursor, trash: Trash2, type: Type, ungroup: Ungroup, x: X,
  scissors: Scissors, paste: ClipboardPaste, upload: Upload, reset: RotateCcw, layers: Layers, sliders: SlidersHorizontal,
  palette: Palette, settings: Settings2, 'file-plus': FilePlus2, search: Search,
  // ícones escolhíveis pelo usuário no elemento "Ícone"
  sword: Sword, shield: Shield, heart: Heart, star: Star, skull: Skull, flame: Flame, zap: Zap, dices: Dices, coins: Coins,
  scroll: Scroll, gem: Gem, crown: Crown, compass: Compass, map: Map, key: Key, book: Book, flask: FlaskConical,
  footprints: Footprints, moon: Moon, sun: Sun, leaf: Leaf, droplet: Droplet, bone: Bone,
};

export const USER_ICONS = [
  'sword', 'shield', 'heart', 'star', 'skull', 'flame', 'zap', 'dices', 'coins', 'scroll', 'gem', 'crown', 'compass', 'map',
  'key', 'book', 'flask', 'footprints', 'moon', 'sun', 'leaf', 'droplet', 'bone', 'eye',
];

export function Icon({ name, size = 16, className, strokeWidth = 1.75, style }: {
  name: string; size?: number; className?: string; strokeWidth?: number; style?: React.CSSProperties;
}) {
  const C = MAP[name] ?? Square;
  return <C size={size} className={className} strokeWidth={strokeWidth} style={style} />;
}
