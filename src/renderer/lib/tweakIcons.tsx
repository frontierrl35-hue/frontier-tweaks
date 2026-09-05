import {
  BellOff,
  Layers,
  Eye,
  ShieldOff,
  Search,
  Cpu,
  LogIn,
  MousePointerClick,
  PenOff,
  MicOff,
  FlaskConical,
  Bot,
  Sparkles,
  Zap,
  HardDrive,
  Database,
  RefreshCw,
  Gamepad2,
  Moon,
  Gauge,
  ShieldQuestion,
  Wifi,
  Trash2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/** Maps a tweak id to the icon shown in its card. Falls back to a generic
 *  wrench for anything not explicitly mapped, so new tweaks never render
 *  blank while waiting for a dedicated icon. */
const ICON_MAP: Record<string, LucideIcon> = {
  'disable-notifications': BellOff,
  'disable-transparency': Layers,
  'disable-animations': Eye,
  'disable-ceip': ShieldOff,
  'disable-search-indexing': Search,
  'disable-sysmain': Cpu,
  'disable-first-logon-animation': LogIn,
  'disable-click-to-do': MousePointerClick,
  'disable-inking': PenOff,
  'disable-speech-recognition': MicOff,
  'disable-experimental-features': FlaskConical,
  'disable-windows-copilot': Bot,
  'disable-cocreator': Sparkles,
  'disable-startup-delay': Zap,
  'optimize-windows-search': Search,
  'disable-storage-sense': HardDrive,
  'disable-reserved-storage': Database,
  'optimize-hung-applications': RefreshCw,
  'enable-game-mode': Gamepad2,
  'processor-scheduling-foreground': Cpu,
  'disable-hibernation': Moon,
  'best-performance-visual-effects': Gauge,
  'disable-mouse-acceleration': MousePointerClick,
  'disable-game-dvr': Gamepad2,
  'enable-hags': Gauge,
  'high-performance-power-plan': Zap,
};

export function getTweakIcon(id: string): LucideIcon {
  return ICON_MAP[id] ?? Wrench;
}

// Re-exported so callers that need an icon outside the map (e.g. network,
// debloat) don't have to import lucide-react directly just for one icon.
export { Wifi as NetworkIcon, Trash2 as DebloatIcon, ShieldQuestion as UnknownIcon };
