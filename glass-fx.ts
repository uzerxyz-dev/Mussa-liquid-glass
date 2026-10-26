import { useSyncExternalStore } from "react";

/**
 * Liquid Glass FX settings.
 *
 * Light and dark themes keep fully independent values and independent persistence
 * (`glass_fx_light` / `glass_fx_dark`). Values are clamped on read, so malformed or
 * tampered localStorage can never produce an unreadable UI. Everything that touches
 * localStorage or the DOM is guarded so nothing runs during server rendering.
 */
export type FxTheme = "light" | "dark";

export type FxSettings = {
  /** Canvas luminance, 0 (darker) … 100 (brighter); 50 = theme default. */
  canvas: number;
  /** Backdrop blur in px. */
  blur: number;
  /** Glass surface opacity in %. */
  opacity: number;
  /** Shadow depth, 0 … 100; 50 = theme default. */
  shadow: number;
  /** Ambient glow intensity, 0 … 100. */
  glow: number;
  /** Ambient glow pulse frequency, 0 (very slow) … 100 (faster). */
  glowFreq: number;
  /** Ambient orb intensity, 0 … 100. */
  orbs: number;
};

export type FxKey = keyof FxSettings;

export const FX_LIMITS: Record<FxKey, { min: number; max: number; step: number }> = {
  canvas: { min: 0, max: 100, step: 1 },
  blur: { min: 0, max: 40, step: 1 },
  opacity: { min: 30, max: 95, step: 1 },
  shadow: { min: 0, max: 100, step: 1 },
  glow: { min: 0, max: 100, step: 1 },
  glowFreq: { min: 0, max: 100, step: 1 },
  orbs: { min: 0, max: 100, step: 1 },
};

export const FX_DEFAULTS: Record<FxTheme, FxSettings> = {
  light: { canvas: 50, blur: 16, opacity: 68, shadow: 50, glow: 45, glowFreq: 40, orbs: 55 },
  dark: { canvas: 50, blur: 18, opacity: 58, shadow: 55, glow: 40, glowFreq: 40, orbs: 45 },
};

export const FX_STORAGE_KEY: Record<FxTheme, string> = {
  light: "glass_fx_light",
  dark: "glass_fx_dark",
};

const KEYS = Object.keys(FX_LIMITS) as FxKey[];

function clampNum(v: unknown, key: FxKey, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const { min, max } = FX_LIMITS[key];
  return Math.round(Math.min(max, Math.max(min, n)));
}

/** Validate any value into a complete, in-range settings object. */
export function sanitizeFx(raw: unknown, theme: FxTheme): FxSettings {
  const base = FX_DEFAULTS[theme];
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...base };
  for (const k of KEYS) out[k] = clampNum(src[k], k, base[k]);
  return out;
}

function readStored(theme: FxTheme): FxSettings {
  if (typeof window === "undefined") return FX_DEFAULTS[theme];
  try {
    const txt = window.localStorage.getItem(FX_STORAGE_KEY[theme]);
    return sanitizeFx(txt ? JSON.parse(txt) : null, theme);
  } catch {
    return FX_DEFAULTS[theme];
  }
}

function writeStored(theme: FxTheme, fx: FxSettings) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(FX_STORAGE_KEY[theme], JSON.stringify(fx)); } catch { /* storage unavailable or full */ }
}

function clearStored(theme: FxTheme) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(FX_STORAGE_KEY[theme]); } catch { /* ignore */ }
}

let state: Record<FxTheme, FxSettings> = { light: FX_DEFAULTS.light, dark: FX_DEFAULTS.dark };
let loaded = false;
const subs = new Set<() => void>();

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = { light: readStored("light"), dark: readStored("dark") };
}

function emit() { subs.forEach((f) => f()); }

/** Convert settings to the CSS custom properties consumed by styles.css. */
export function fxToCssVars(fx: FxSettings): Record<string, string> {
  const shadowK = fx.shadow / 50; // 0 … 2, 1 = default
  const canvasDelta = fx.canvas - 50; // -50 … +50
  const tone = canvasDelta >= 0 ? "white" : "black";
  const pct = Math.abs(canvasDelta) * 0.5; // up to 25 % mix
  return {
    "--fx-blur": `${fx.blur}px`,
    "--fx-opacity": `${fx.opacity}%`,
    "--fx-pop-opacity": `${Math.min(96, Math.max(82, fx.opacity + 20))}%`,
    "--fx-field-opacity": `${Math.min(96, Math.max(60, fx.opacity + 16))}%`,
    "--fx-surface-opacity": `${Math.max(25, fx.opacity - 14)}%`,
    "--fx-shadow-k": shadowK.toFixed(3),
    "--fx-glow-k": (fx.glow / 50).toFixed(3),
    // 0 → 24s per pulse, 100 → 4s per pulse.
    "--fx-glow-dur": `${(24 - (fx.glowFreq / 100) * 20).toFixed(1)}s`,
    "--fx-orb-k": (fx.orbs / 50).toFixed(3),
    "--fx-canvas-tone": tone,
    "--fx-canvas-pct": `${pct.toFixed(1)}%`,
  };
}

/** Apply one theme's settings to the document. Client only; safe to call anywhere. */
export function applyGlassFx(theme: FxTheme) {
  if (typeof document === "undefined") return;
  ensureLoaded();
  const root = document.documentElement;
  const vars = fxToCssVars(state[theme]);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}

export function setGlassFx(theme: FxTheme, patch: Partial<FxSettings>) {
  ensureLoaded();
  const next = sanitizeFx({ ...state[theme], ...patch }, theme);
  state = { ...state, [theme]: next };
  writeStored(theme, next);
  emit();
}

/** Reset only the given theme; the other theme is untouched. */
export function resetGlassFx(theme: FxTheme) {
  ensureLoaded();
  state = { ...state, [theme]: FX_DEFAULTS[theme] };
  clearStored(theme);
  emit();
}

export function useGlassFx(theme: FxTheme): FxSettings {
  return useSyncExternalStore(
    (f) => { ensureLoaded(); subs.add(f); return () => { subs.delete(f); }; },
    () => { ensureLoaded(); return state[theme]; },
    () => FX_DEFAULTS[theme],
  );
}
