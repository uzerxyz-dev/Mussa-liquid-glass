import { useSyncExternalStore } from "react";

/** Dashboard widget layout: order + size per widget, persisted per device. */
export type WidgetId =
  | "treasury" | "cheques" | "cash" | "bank" | "receivable" | "payable" | "advances" | "stock" | "quick" | "activity" | "heats"
  | "vouchers" | "accounts" | "sales" | "purchases" | "cashbook" | "workers" | "loans" | "expenses" | "reports" | "electricity" | "monthly";
export type WidgetLayout = { id: WidgetId; w: number; h: number };

export const WIDGET_LABELS: Record<WidgetId, string> = {
  treasury: "Treasury Position", cheques: "Cheque Status", cash: "Cash in hand", bank: "Bank balance", receivable: "Receivables", payable: "Payables", advances: "Advances",
  stock: "Raw material stock", quick: "Quick actions", activity: "Recent activity", heats: "Production heats",
  vouchers: "Vouchers", accounts: "Accounts / Ledgers", sales: "Sales", purchases: "Purchases", cashbook: "Cash Book",
  workers: "Workers", loans: "Personal Loans", expenses: "Expenses", reports: "Reports", electricity: "Electricity", monthly: "This month",
};

export const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: "treasury", w: 2, h: 3 },
  { id: "quick", w: 2, h: 2 }, { id: "cheques", w: 2, h: 1 },
  { id: "stock", w: 2, h: 2 },
  { id: "vouchers", w: 1, h: 1 }, { id: "advances", w: 1, h: 1 }, { id: "monthly", w: 2, h: 1 },
  { id: "heats", w: 4, h: 2 },
  { id: "activity", w: 2, h: 2 }, { id: "accounts", w: 1, h: 1 }, { id: "workers", w: 1, h: 1 },
  { id: "loans", w: 1, h: 1 }, { id: "reports", w: 1, h: 1 },
];
export const ALL_WIDGETS = Object.keys(WIDGET_LABELS) as WidgetId[];
export const MAX_W = 4;
export const MAX_H = 3;

const KEY = "cashbook-dashboard-layout";
type State = { layout: WidgetLayout[]; editing: boolean; drawer: boolean };
let state: State = { layout: DEFAULT_LAYOUT, editing: false, drawer: false };
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(raw)) state = { ...state, layout: raw.filter((x) => ALL_WIDGETS.includes(x?.id)).map((x) => ({ id: x.id, w: clamp(x.w, 1, MAX_W), h: clamp(x.h, 1, MAX_H) })) };
    // One-time: add the Treasury Position card to layouts saved before it existed.
    if (!localStorage.getItem(KEY + "-treasury")) {
      localStorage.setItem(KEY + "-treasury", "1");
      if (!state.layout.some((x) => x.id === "treasury")) {
        state = { ...state, layout: [{ id: "treasury", w: 2, h: 3 }, ...state.layout.filter((x) => !["cash", "bank", "receivable", "payable"].includes(x.id))] };
        localStorage.setItem(KEY, JSON.stringify(state.layout));
      }
    }
    if (!localStorage.getItem(KEY + "-treasury2")) {
      localStorage.setItem(KEY + "-treasury2", "1");
      state = { ...state, layout: state.layout.map((x) => x.id === "treasury" ? { ...x, w: 2, h: 3 } : x) };
      localStorage.setItem(KEY, JSON.stringify(state.layout));
    }
    if (!localStorage.getItem(KEY + "-cheques")) {
      localStorage.setItem(KEY + "-cheques", "1");
      if (!state.layout.some((x) => x.id === "cheques")) {
        const i = state.layout.findIndex((x) => x.id === "quick");
        const l = [...state.layout]; l.splice(i < 0 ? 1 : i + 1, 0, { id: "cheques", w: 2, h: 1 });
        state = { ...state, layout: l };
        localStorage.setItem(KEY, JSON.stringify(state.layout));
      }
    }
  } catch { /* keep default */ }
}
function clamp(n: unknown, lo: number, hi: number) { const v = Math.round(Number(n) || lo); return Math.min(hi, Math.max(lo, v)); }
function set(patch: Partial<State>, persist = false) {
  state = { ...state, ...patch };
  if (persist) localStorage.setItem(KEY, JSON.stringify(state.layout));
  subs.forEach((f) => f());
}
export function haptic(ms = 10) { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } }

export function useDashboard() {
  return useSyncExternalStore(
    (f) => { load(); subs.add(f); f(); return () => subs.delete(f); },
    () => state,
    () => state,
  );
}
export const dashboard = {
  setEditing: (editing: boolean) => { haptic(editing ? 20 : 10); set({ editing }, true); },
  setDrawer: (drawer: boolean) => set({ drawer }),
  toggle: (id: WidgetId, on: boolean) => {
    const has = state.layout.some((x) => x.id === id);
    if (on && !has) set({ layout: [...state.layout, DEFAULT_LAYOUT.find((x) => x.id === id) ?? { id, w: 1, h: 1 }] }, true);
    if (!on && has) set({ layout: state.layout.filter((x) => x.id !== id) }, true);
  },
  resize: (id: WidgetId, w: number, h: number) => set({ layout: state.layout.map((x) => x.id === id ? { ...x, w: clamp(w, 1, MAX_W), h: clamp(h, 1, MAX_H) } : x) }, true),
  move: (id: WidgetId, toId: WidgetId) => {
    if (id === toId) return;
    const l = [...state.layout];
    const from = l.findIndex((x) => x.id === id), to = l.findIndex((x) => x.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = l.splice(from, 1);
    l.splice(to, 0, item!);
    haptic(8);
    set({ layout: l }, true);
  },
  reset: () => set({ layout: DEFAULT_LAYOUT }, true),
};
