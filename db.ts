import { useSyncExternalStore } from "react";
import { norm } from "./format";

export type AccountType = "buyer" | "supplier" | "worker" | string;
export type EntryType = "inward" | "outward" | "sale" | "purchase" | "salary" | "advance" | "expense" | "capital" | "transfer";
export type PayMethod = "cash" | "cheque" | "online";
export type ChequeStatus = "pending" | "cleared" | "bounced";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  phone: string;
  address: string;
  openingBalance: number;
  title?: string | undefined;
  fixedWages?: number | undefined;
  idCard?: string | undefined;
  /** Owner capital / equity holder — not a party; excluded from receivables and payables. */
  equity?: boolean | undefined;
  createdAt: string;
  deletedAt?: string | undefined;
}

export interface Bank {
  id: string;
  name: string;
  accountNo?: string | undefined;
  openingBalance: number;
  createdAt: string;
  deletedAt?: string | undefined;
}

export interface OpeningItem { id: string; name: string; kind: "asset" | "liability"; amount: number }
export interface Opening {
  date: string;
  cash: number;
  stock: { materialId: string; kg: number; value: number }[];
  others: OpeningItem[];
  completed?: boolean | undefined;
}

export interface Entry {
  id: string;
  voucherNo: number;
  type: EntryType;
  date: string;
  accountId?: string | undefined;
  amount: number;
  method?: PayMethod | undefined;
  chequeNo?: string | undefined;
  bank?: string | undefined;
  /** Bank fund this payment moves through (online / cheque). For transfers: source fund ("cash" or bank id). */
  bankId?: string | undefined;
  /** Transfers only: destination fund ("cash" or bank id). */
  toBankId?: string | undefined;
  reference?: string | undefined;
  chequeStatus?: ChequeStatus | undefined;
  particulars: string;
  categoryId?: string | undefined;
  remarks?: string | undefined;
  materialId?: string | undefined;
  weightKg?: number | undefined;
  rate?: number | undefined;
  /** "net" = settled sale/purchase: recorded in the ledger but never moves party balance or funds. "advance" is legacy (paired with a linked cash voucher). */
  payMode?: "credit" | "advance" | "net" | undefined;
  receivedBy?: string | undefined;
  linkedId?: string | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
  deletedAt?: string | undefined;
}

/** Manual production run: converts one material (e.g. Scrap) into another (e.g. Billet) by weight. */
export interface Production {
  id: string;
  date: string;
  fromMaterialId: string;
  toMaterialId: string;
  bars: number;
  barWeightKg: number;
  totalKg: number;
  note: string;
  createdAt: string;
  deletedAt?: string | undefined;
  /* Heat-production extension (all optional so older runs keep working). */
  shift?: string | undefined;
  /** Up to 4 sample bar weights; their average × bars = billet output. */
  samples?: number[] | undefined;
  /** Estimated total raw material charged into the heat. */
  inputKg?: number | undefined;
  slagKg?: number | undefined;
  wasteKg?: number | undefined;
  kwh?: number | undefined;
  directCost?: number | undefined;
  /** Total heat cost = material (weighted avg) + energy + direct. */
  cost?: number | undefined;
  costPerKg?: number | undefined;
  /** inputKg − (billet + slag + waste). */
  varianceKg?: number | undefined;
}

/** Monthly electricity bill; its effective rate (amount ÷ units) prices heat energy. */
export interface HeatBill {
  id: string;
  period: string;
  amount: number;
  units: number;
  createdAt: string;
  deletedAt?: string | undefined;
}

export interface Named {
  id: string;
  name: string;
  selectable?: boolean;
}

export interface LoanRepayment {
  id: string;
  date: string;
  amount: number;
  note: string;
  createdAt: string;
  deletedAt?: string | undefined;
}

export interface Loan {
  id: string;
  direction: "given" | "taken";
  person: string;
  contact: string;
  date: string;
  amount: number;
  particulars: string;
  repayments: LoanRepayment[];
  createdAt: string;
  updatedAt?: string | undefined;
  deletedAt?: string | undefined;
}

export interface LogItem {
  id: string;
  action: "delete" | "edit";
  kind: "account" | "entry";
  refId: string;
  label: string;
  at: string;
  before?: Account | Entry | undefined;
  childIds?: string[] | undefined;
  restoredAt?: string | undefined;
}

export interface Data {
  accounts: Account[];
  entries: Entry[];
  categories: Named[];
  categoryChoicesMigrated?: boolean;
  accountTypes: Named[];
  loans: Loan[];
  banks: Bank[];
  opening?: Opening | undefined;
  materials: Named[];
  production: Production[];
  bills: HeatBill[];
  log: LogItem[];
  seq: number;
  voucherSeq: number;
  company: { name: string; address: string; phone: string };
  auth?: { username: string; hash: string; mode?: "password" | "pin"; recoveryEmail?: string; recoveryPhone?: string } | undefined;
}

export const ENTRY_TYPES: Record<EntryType, { label: string; cash: boolean; party: boolean; flow: "in" | "out" | "none" }> = {
  inward: { label: "Receive Payment", cash: true, party: true, flow: "in" },
  outward: { label: "Issue Payment", cash: true, party: true, flow: "out" },
  sale: { label: "Sale", cash: false, party: true, flow: "none" },
  purchase: { label: "Purchase", cash: false, party: true, flow: "none" },
  salary: { label: "Salary", cash: true, party: true, flow: "out" },
  advance: { label: "Advance", cash: true, party: true, flow: "out" },
  expense: { label: "Expense", cash: true, party: false, flow: "out" },
  capital: { label: "Capital Introduced", cash: true, party: false, flow: "in" },
  transfer: { label: "Internal Transfer", cash: false, party: false, flow: "none" },
};

export const METHODS: Record<PayMethod, string> = { cash: "Cash", cheque: "Cheque", online: "Online Transfer" };
export const ACCOUNT_TYPES: Record<AccountType, string> = {
  buyer: "Buyer",
  supplier: "Supplier",
  worker: "Worker",
};

const KEY = "cashbook-data-v1";
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());

function empty(): Data {
  // Fixed IDs: empty() runs at module scope on import, and random values
  // (crypto.randomUUID) are disallowed in Cloudflare Workers' global scope.
  const n = (name: string, id: string): Named => ({ id, name });
  return {
    accounts: [],
    entries: [],
    categories: [
      ["cat-salary", "Salary"],
      ["cat-advance", "Advance"],
      ["cat-lesco", "LESCO Bill"],
      ["cat-fuel", "Fuel"],
      ["cat-grocery", "Grocery"],
    ].map(([id, name]) => n(name!, id!)),
    categoryChoicesMigrated: true,
    accountTypes: [],
    loans: [],
    banks: [],
    materials: [
      { id: "mat-scrap", name: "Scrap" },
      { id: "mat-boora", name: "Boora" },
      { id: "mat-billet", name: "Billet" },
    ],
    production: [],
    bills: [],
    log: [],
    seq: 1,
    voucherSeq: 1,
    company: { name: "", address: "", phone: "" },
  };
}

let data: Data = empty();
let loaded = false;
let past: Data[] = [];
let future: Data[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const CASH = "cash";
export const UNASSIGNED_BANK = "bank-unassigned";

/** Additive, idempotent upgrade of older data: fills defaults and links legacy bank names to bank records. Never deletes. */
export function migrate(d: Data, newId: () => string = uid) {
  d.banks = d.banks ?? [];
  d.accountTypes = d.accountTypes ?? [];
  d.loans = d.loans ?? [];
  d.production = d.production ?? [];
  d.bills = d.bills ?? [];
  let changed = false;
  for (const e of d.entries) {
    if (e.type === "transfer" || !e.method || e.method === "cash" || e.bankId) continue;
    const name = e.bank?.trim();
    let b = name ? d.banks.find((x) => norm(x.name) === norm(name)) : d.banks.find((x) => x.id === UNASSIGNED_BANK);
    if (!b) {
      b = { id: name ? newId() : UNASSIGNED_BANK, name: name || "Unassigned Bank", openingBalance: 0, createdAt: new Date().toISOString() };
      d.banks.push(b);
    }
    e.bankId = b.id;
    changed = true;
  }
  return changed;
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(data));
}

/** Wipes every record, login, snapshot and draft on this device. Theme is kept. */
export function resetAllData() {
  Object.keys(localStorage).filter((k) => k.startsWith("cashbook-") && k !== "cashbook-theme").forEach((k) => localStorage.removeItem(k));
  sessionStorage.clear();
  data = empty();
  past = [];
  future = [];
  emit();
}

export function loadData() {
  if (loaded) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const incoming = JSON.parse(raw) as Partial<Data> & { tags?: Named[] };
      const base = empty();
      data = { ...base, ...incoming, accountTypes: incoming.accountTypes ?? [], loans: incoming.loans ?? [], materials: incoming.materials ?? base.materials, production: incoming.production ?? [], bills: incoming.bills ?? [] } as Data;
      data.accounts = (incoming.accounts ?? []).map((a) => ({ ...a, type: a.type === "customer" || a.type === "other" ? "buyer" : a.type }));
      data.entries = (incoming.entries ?? []).map((e) => { const { tagId: _legacyTag, ...entry } = e as Entry & { tagId?: string }; return entry; });
      if (migrate(data)) persist();
      const wanted = ["Salary", "Advance", "LESCO Bill", "Fuel", "Grocery"];
      const existing = new Set(data.categories.map((c) => norm(c.name)));
      wanted.forEach((name) => { if (!existing.has(norm(name))) data.categories.push({ id: uid(), name }); });
      if (!incoming.categoryChoicesMigrated) {
        data.categories = data.categories.map((category) => ({ ...category, selectable: wanted.some((name) => norm(name) === norm(category.name)) }));
        data.categoryChoicesMigrated = true;
        persist();
      }
    }
  } catch {
    /* ignore corrupt data */
  }
  loaded = true;
  emit();
}

function commit(mut: (d: Data) => void, undoable = true) {
  if (undoable) {
    past.push(data);
    if (past.length > 60) past.shift();
    future = [];
  }
  const next = structuredClone(data);
  mut(next);
  data = next;
  persist();
  emit();
}

export function undo() {
  const p = past.pop();
  if (!p) return false;
  future.push(data);
  data = p;
  persist();
  emit();
  return true;
}
export function redo() {
  const f = future.pop();
  if (!f) return false;
  past.push(data);
  data = f;
  persist();
  emit();
  return true;
}

export function useData() {
  return useSyncExternalStore(subscribe, () => data, () => data);
}
export function useLoaded() {
  return useSyncExternalStore(subscribe, () => loaded, () => false);
}
export const getData = () => data;

/* ---------- auth ---------- */
export async function hashPw(pw: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("cb::" + pw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function setupAuth(username: string, pin: string, companyName: string, recoveryEmail = "", recoveryPhone = "") {
  const hash = await hashPw(pin);
  commit((d) => {
    d.auth = { username, hash, mode: "pin", recoveryEmail, recoveryPhone };
    if (companyName) d.company.name = companyName;
  }, false);
}
export async function checkPw(pw: string, username?: string) {
  if (!data.auth) return false;
  if (username !== undefined && norm(username) !== norm(data.auth.username)) return false;
  return (await hashPw(pw)) === data.auth.hash;
}
export function updateCompany(c: Data["company"]) {
  commit((d) => {
    d.company = c;
  }, false);
}
export function updateRecovery(recoveryEmail: string, recoveryPhone: string) {
  commit((d) => { if (d.auth) Object.assign(d.auth, { recoveryEmail, recoveryPhone, mode: "pin" }); }, false);
}
export function matchesRecovery(value: string) {
  const n = norm(value);
  return !!n && !!data.auth && (n === norm(data.auth.recoveryEmail ?? "") || n === norm(data.auth.recoveryPhone ?? ""));
}

/* ---------- accounts ---------- */
export function initials(name: string) {
  const i = name
    .split(/[\s\-_.]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, "")[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 5);
  return i || "AC";
}
export function previewCode(name: string) {
  return `${initials(name)}01${data.seq}`;
}

export function addAccount(a: Omit<Account, "id" | "code" | "createdAt">) {
  const acc: Account = { ...a, id: uid(), code: previewCode(a.name), createdAt: new Date().toISOString() };
  commit((d) => {
    d.accounts.push(acc);
    d.seq += 1;
  });
  return acc;
}

export function accountTypeLabel(d: Data, type: AccountType) {
  return ACCOUNT_TYPES[type] ?? d.accountTypes.find((x) => x.id === type)?.name ?? type;
}
export function addAccountType(name: string) {
  const item = { id: `custom-${uid()}`, name };
  commit((d) => { d.accountTypes.push(item); });
  return item;
}

export function updateAccount(id: string, patch: Partial<Account>) {
  commit((d) => {
    const a = d.accounts.find((x) => x.id === id);
    if (!a) return;
    d.log.unshift({ id: uid(), action: "edit", kind: "account", refId: id, label: `${a.code} · ${a.name}`, at: new Date().toISOString(), before: { ...a } });
    Object.assign(a, patch);
  });
}

/* ---------- entries ---------- */
export function addEntry(e: Omit<Entry, "id" | "voucherNo" | "createdAt">) {
  const entry: Entry = { ...e, id: uid(), voucherNo: data.voucherSeq, createdAt: new Date().toISOString() };
  commit((d) => {
    d.entries.push(entry);
    d.voucherSeq += 1;
  });
  return entry;
}
export function updateEntry(id: string, patch: Partial<Entry>) {
  commit((d) => {
    const e = d.entries.find((x) => x.id === id);
    if (!e) return;
    d.log.unshift({ id: uid(), action: "edit", kind: "entry", refId: id, label: entryLabel(d, e), at: new Date().toISOString(), before: { ...e } });
    Object.assign(e, patch, { updatedAt: new Date().toISOString() });
  });
}

function entryLabel(d: Data, e: Entry) {
  const acc = d.accounts.find((a) => a.id === e.accountId);
  return `V-${e.voucherNo} · ${ENTRY_TYPES[e.type].label} · ${acc?.name ?? e.particulars} · Rs ${e.amount.toLocaleString("en-IN")}`;
}

/* ---------- delete / restore ---------- */
export function deleteItems(kind: "account" | "entry", ids: string[]) {
  const now = new Date().toISOString();
  commit((d) => {
    for (const id of ids) {
      if (kind === "entry") {
        const e = d.entries.find((x) => x.id === id && !x.deletedAt);
        if (!e) continue;
        e.deletedAt = now;
        d.log.unshift({ id: uid(), action: "delete", kind, refId: id, label: entryLabel(d, e), at: now, before: { ...e } });
      } else {
        const a = d.accounts.find((x) => x.id === id && !x.deletedAt);
        if (!a) continue;
        a.deletedAt = now;
        const childIds: string[] = [];
        d.entries.forEach((e) => {
          if (e.accountId === id && !e.deletedAt) {
            e.deletedAt = now;
            childIds.push(e.id);
          }
        });
        d.log.unshift({ id: uid(), action: "delete", kind, refId: id, label: `${a.code} · ${a.name}${childIds.length ? ` (+${childIds.length} entries)` : ""}`, at: now, before: { ...a }, childIds });
      }
    }
  });
}

export function restoreLog(logIds: string[]) {
  const now = new Date().toISOString();
  commit((d) => {
    for (const lid of logIds) {
      const l = d.log.find((x) => x.id === lid);
      if (!l || l.restoredAt) continue;
      if (l.action === "delete") {
        const list = l.kind === "account" ? d.accounts : d.entries;
        const item = (list as { id: string; deletedAt?: string }[]).find((x) => x.id === l.refId);
        if (item) delete item.deletedAt;
        l.childIds?.forEach((cid) => {
          const e = d.entries.find((x) => x.id === cid);
          if (e) delete e.deletedAt;
        });
      } else if (l.before) {
        if (l.kind === "account") {
          const i = d.accounts.findIndex((x) => x.id === l.refId);
          if (i >= 0) d.accounts[i] = { ...(l.before as Account), deletedAt: d.accounts[i]!.deletedAt };
        } else {
          const i = d.entries.findIndex((x) => x.id === l.refId);
          if (i >= 0) d.entries[i] = { ...(l.before as Entry), deletedAt: d.entries[i]!.deletedAt };
        }
      }
      l.restoredAt = now;
    }
  });
}

export function purgeLog(logIds: string[]) {
  commit((d) => {
    for (const lid of logIds) {
      const l = d.log.find((x) => x.id === lid);
      if (!l) continue;
      if (l.action === "delete" && !l.restoredAt) {
        if (l.kind === "account") d.accounts = d.accounts.filter((a) => a.id !== l.refId);
        else d.entries = d.entries.filter((e) => e.id !== l.refId);
        if (l.childIds) d.entries = d.entries.filter((e) => !l.childIds!.includes(e.id));
      }
      d.log = d.log.filter((x) => x.id !== lid);
    }
  });
}

/* ---------- categories / tags ---------- */
export function addNamed(kind: "categories", name: string) {
  const existing = data[kind].find((item) => norm(item.name) === norm(name));
  if (existing) {
    if (existing.selectable === false) commit((d) => { const item = d[kind].find((x) => x.id === existing.id); if (item) item.selectable = true; });
    return existing;
  }
  const item = { id: uid(), name, selectable: true };
  commit((d) => {
    d[kind].push(item);
  });
  return item;
}
export function renameNamed(kind: "categories", id: string, name: string) {
  commit((d) => {
    const x = d[kind].find((i) => i.id === id);
    if (x) x.name = name;
  });
}
export function removeNamed(kind: "categories", id: string) {
  commit((d) => {
    d[kind] = d[kind].filter((i) => i.id !== id);
  });
}

/* ---------- queries ---------- */
export const liveAccounts = (d: Data) => d.accounts.filter((a) => !a.deletedAt);
export const liveEntries = (d: Data) => d.entries.filter((e) => !e.deletedAt);

/** Debit (+) increases what party owes us; credit (-) decreases. */
export function signedForAccount(e: Entry) {
  // A bounced cheque never settled anything: the party's original due is restored.
  if (e.chequeStatus === "bounced") return 0;
  if ((e.type === "sale" || e.type === "purchase") && e.payMode === "net") return 0;
  switch (e.type) {
    case "sale":
    case "outward":
    case "salary":
    case "advance":
      return e.amount;
    case "inward":
    case "purchase":
      return -e.amount;
    default:
      return 0;
  }
}

export function accountBalance(d: Data, id: string) {
  const a = d.accounts.find((x) => x.id === id);
  let b = a?.openingBalance ?? 0;
  for (const e of d.entries) if (!e.deletedAt && e.accountId === id) b += signedForAccount(e);
  return b;
}

export function cashFlow(e: Entry) {
  const f = ENTRY_TYPES[e.type].flow;
  if (e.chequeStatus === "bounced") return 0;
  return f === "in" ? e.amount : f === "out" ? -e.amount : 0;
}

/** Cash in hand = physical cash only. Online and cheque payments live in their bank's ledger. */
export const inCashHand = (e: Entry) => e.type !== "transfer" && ENTRY_TYPES[e.type].cash && (e.method === "cash" || !e.method);

/* ---------- funds: cash in hand + each bank ---------- */
export type FundState = "cleared" | "pending" | "bounced";
export const entryState = (e: Entry): FundState => (e.method === "cheque" ? e.chequeStatus ?? "pending" : "cleared");

/** Which fund(s) an entry moves and by how much (+ in, − out), ignoring cheque state. Sales/purchases move no money. */
export function entryFunds(e: Entry): { fund: string; delta: number }[] {
  if (e.type === "transfer") return [{ fund: e.bankId ?? CASH, delta: -e.amount }, { fund: e.toBankId ?? CASH, delta: e.amount }];
  const flow = ENTRY_TYPES[e.type].flow;
  if (flow === "none") return [];
  const fund = !e.method || e.method === "cash" ? CASH : e.bankId ?? UNASSIGNED_BANK;
  return [{ fund, delta: flow === "in" ? e.amount : -e.amount }];
}

export const liveBanks = (d: Data) => d.banks.filter((b) => !b.deletedAt);
export function fundName(d: Data, fund: string) {
  return fund === CASH ? "Cash in Hand" : d.banks.find((b) => b.id === fund)?.name ?? "Unassigned Bank";
}
export function fundOpening(d: Data, fund: string) {
  return fund === CASH ? d.opening?.cash ?? 0 : d.banks.find((b) => b.id === fund)?.openingBalance ?? 0;
}

/** Running statement for one fund. Balance counts cleared items only; pending cheques are listed separately. */
export function fundLedger(d: Data, fund: string, from = "", to = "") {
  const moves = liveEntries(d)
    .flatMap((e) => entryFunds(e).filter((m) => m.fund === fund).map((m) => ({ e, delta: m.delta, state: entryState(e) })))
    .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.e.voucherNo - b.e.voucherNo);
  let bal = fundOpening(d, fund);
  for (const m of moves) if (from && m.e.date < from && m.state === "cleared") bal += m.delta;
  const opening = bal;
  const rows = moves.filter((m) => (!from || m.e.date >= from) && (!to || m.e.date <= to)).map((m) => {
    if (m.state === "cleared") bal += m.delta;
    return { ...m, bal };
  });
  const pending = moves.filter((m) => m.state === "pending").reduce((s, m) => s + m.delta, 0);
  return { opening, rows, closing: bal, pending };
}
export const fundBalance = (d: Data, fund: string) => fundLedger(d, fund).closing;
export function fundList(d: Data) {
  const ids = [CASH, ...liveBanks(d).map((b) => b.id)];
  return ids.map((id) => ({ id, name: fundName(d, id), ...fundLedger(d, id) }));
}

export function addBank(b: Pick<Bank, "name" | "accountNo" | "openingBalance">) {
  const bank: Bank = { ...b, id: uid(), createdAt: new Date().toISOString() };
  commit((d) => { d.banks.push(bank); });
  return bank;
}
export function updateBank(id: string, patch: Partial<Bank>) {
  commit((d) => { const b = d.banks.find((x) => x.id === id); if (b) Object.assign(b, patch); });
}

/** Owner capital goes straight into the chosen cash/bank fund — never into a party ledger. */
export function addCapital(input: { date: string; amount: number; fund: string; reference?: string; particulars?: string }) {
  return addEntry({
    type: "capital", date: input.date, amount: input.amount,
    method: input.fund === CASH ? "cash" : "online",
    bankId: input.fund === CASH ? undefined : input.fund,
    bank: input.fund === CASH ? undefined : fundName(data, input.fund),
    reference: input.reference || undefined,
    particulars: input.particulars?.trim() || "Capital introduced by owner",
  });
}
/** Moving money between own funds is neither income nor expense. */
export function addTransfer(input: { date: string; amount: number; from: string; to: string; reference?: string; particulars?: string }) {
  return addEntry({
    type: "transfer", date: input.date, amount: input.amount, method: "online",
    bankId: input.from, toBankId: input.to, reference: input.reference || undefined,
    particulars: input.particulars?.trim() || `Transfer ${fundName(data, input.from)} → ${fundName(data, input.to)}`,
  });
}

/* ---------- party classification ---------- */
export function balanceClass(a: Pick<Account, "type" | "equity">, b: number) {
  if (a.equity) return "Owner Capital";
  if (b > 0) return a.type === "supplier" ? "Supplier Advance" : "Receivable";
  if (b < 0) return a.type === "buyer" ? "Customer Advance" : "Payable";
  return "Settled";
}
export function partyTotals(d: Data) {
  const t = { receivable: 0, payable: 0, supplierAdvance: 0, customerAdvance: 0 };
  for (const a of liveAccounts(d)) {
    if (a.equity) continue;
    const b = accountBalance(d, a.id);
    if (b > 0) { if (a.type === "supplier") t.supplierAdvance += b; else t.receivable += b; }
    if (b < 0) { if (a.type === "buyer") t.customerAdvance -= b; else t.payable -= b; }
  }
  return t;
}

/* ---------- opening setup ---------- */
export function saveOpening(o: Opening, partyOpenings: Record<string, number>, equityIds: string[], banks: { id?: string | undefined; name: string; accountNo?: string | undefined; openingBalance: number }[]) {
  commit((d) => {
    d.opening = o;
    for (const a of d.accounts) {
      if (a.id in partyOpenings) a.openingBalance = partyOpenings[a.id]!;
      a.equity = equityIds.includes(a.id) || undefined;
    }
    for (const b of banks) {
      const ex = b.id ? d.banks.find((x) => x.id === b.id) : undefined;
      if (ex) Object.assign(ex, { name: b.name, accountNo: b.accountNo, openingBalance: b.openingBalance });
      else if (b.name.trim()) d.banks.push({ id: uid(), name: b.name.trim(), accountNo: b.accountNo, openingBalance: b.openingBalance, createdAt: new Date().toISOString() });
    }
  });
}
/** Opening capital = opening assets − opening liabilities (owner equity is never a payable). */
export function openingCapital(d: Data) {
  const o = d.opening;
  const banks = liveBanks(d).reduce((s, b) => s + b.openingBalance, 0);
  const cash = o?.cash ?? 0;
  let receivable = 0, supplierAdvance = 0, payable = 0, customerAdvance = 0;
  for (const a of liveAccounts(d)) {
    if (a.equity) continue;
    const b = a.openingBalance;
    if (b > 0) { if (a.type === "supplier") supplierAdvance += b; else receivable += b; }
    if (b < 0) { if (a.type === "buyer") customerAdvance -= b; else payable -= b; }
  }
  const stock = (o?.stock ?? []).reduce((s, x) => s + x.value, 0);
  const otherAssets = (o?.others ?? []).filter((x) => x.kind === "asset").reduce((s, x) => s + x.amount, 0);
  const otherLiab = (o?.others ?? []).filter((x) => x.kind === "liability").reduce((s, x) => s + x.amount, 0);
  const assets = cash + banks + receivable + supplierAdvance + stock + otherAssets;
  const liabilities = payable + customerAdvance + otherLiab;
  return { cash, banks, receivable, supplierAdvance, stock, otherAssets, payable, customerAdvance, otherLiab, assets, liabilities, capital: assets - liabilities };
}

export function searchAccounts(d: Data, q: string, limit = 8, type?: AccountType) {
  const n = norm(q);
  if (!n) return [];
  const list = liveAccounts(d).filter((a) => !type || a.type === type);
  const starts = list.filter((a) => norm(a.name).startsWith(n) || norm(a.code).startsWith(n));
  const contains = list.filter((a) => !starts.includes(a) && (norm(a.name).includes(n) || norm(a.code).includes(n) || norm(a.phone).includes(n) || norm(a.address).includes(n)));
  return [...starts, ...contains].slice(0, limit);
}

export function findDuplicate(d: Data, e: { accountId?: string | undefined; amount: number; date: string; type: EntryType }, ignoreId?: string) {
  return liveEntries(d).find((x) => x.id !== ignoreId && x.type === e.type && x.accountId === e.accountId && x.amount === e.amount && x.date === e.date);
}

/* ---------- personal loans (isolated from business cash) ---------- */
export const liveLoans = (d: Data) => d.loans.filter((l) => !l.deletedAt);
export const loanPaid = (l: Loan) => l.repayments.filter((r) => !r.deletedAt).reduce((s, r) => s + r.amount, 0);
export const loanRemaining = (l: Loan) => Math.max(0, l.amount - loanPaid(l));
export function addLoan(input: Omit<Loan, "id" | "repayments" | "createdAt">) {
  const loan: Loan = { ...input, id: uid(), repayments: [], createdAt: new Date().toISOString() };
  commit((d) => { d.loans.push(loan); });
  return loan;
}
export function addLoanRepayment(loanId: string, input: Pick<LoanRepayment, "date" | "amount" | "note">) {
  commit((d) => { const l = d.loans.find((x) => x.id === loanId); if (l) { l.repayments.push({ ...input, id: uid(), createdAt: new Date().toISOString() }); l.updatedAt = new Date().toISOString(); } });
}
export function deleteLoan(id: string) {
  commit((d) => { const l = d.loans.find((x) => x.id === id); if (l) l.deletedAt = new Date().toISOString(); });
}

/* ---------- materials & stock ---------- */
export function addMaterial(name: string) {
  const existing = data.materials.find((m) => norm(m.name) === norm(name));
  if (existing) return existing;
  const item = { id: uid(), name };
  commit((d) => { d.materials.push(item); });
  return item;
}
export function addProduction(p: Omit<Production, "id" | "createdAt">) {
  commit((d) => { d.production.push({ ...p, id: uid(), createdAt: new Date().toISOString() }); });
}
export function deleteProduction(id: string) {
  commit((d) => { const p = d.production.find((x) => x.id === id); if (p) p.deletedAt = new Date().toISOString(); });
}
export const liveProduction = (d: Data) => d.production.filter((p) => !p.deletedAt);

/* ---------- electricity bills & heat costing ---------- */
export function addBill(b: Pick<HeatBill, "period" | "amount" | "units">) {
  const bill: HeatBill = { ...b, id: uid(), createdAt: new Date().toISOString() };
  commit((d) => { d.bills.push(bill); });
  return bill;
}
export function deleteBill(id: string) {
  commit((d) => { const b = d.bills.find((x) => x.id === id); if (b) b.deletedAt = new Date().toISOString(); });
}
export const liveBills = (d: Data) => d.bills.filter((b) => !b.deletedAt);
/** Effective unit rate of the latest bill = bill amount ÷ billed units. */
export function effectiveRate(d: Data) {
  const latest = [...liveBills(d)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return latest && latest.units > 0 ? latest.amount / latest.units : 0;
}
/** Moving weighted-average cost per kg of a material: opening stock value + purchases. */
export function materialAvgCost(d: Data, materialId: string) {
  let qty = 0, val = 0;
  for (const s of d.opening?.stock ?? []) if (s.materialId === materialId) { qty += s.kg; val += s.value; }
  for (const e of liveEntries(d)) if (e.type === "purchase" && e.materialId === materialId && e.weightKg && e.rate) { qty += e.weightKg; val += e.weightKg * e.rate; }
  return qty > 0 ? val / qty : 0;
}
/** Stock in kg per material: purchases + produced − sales − consumed in production. */
export function stockSummary(d: Data) {
  const rows = new Map<string, { purchased: number; sold: number; produced: number; consumed: number }>();
  const row = (id: string) => { let r = rows.get(id); if (!r) { r = { purchased: 0, sold: 0, produced: 0, consumed: 0 }; rows.set(id, r); } return r; };
  d.materials.forEach((m) => row(m.id));
  for (const s of d.opening?.stock ?? []) row(s.materialId).purchased += s.kg;
  for (const e of liveEntries(d)) {
    if (!e.materialId || !e.weightKg) continue;
    if (e.type === "purchase") row(e.materialId).purchased += e.weightKg;
    if (e.type === "sale") row(e.materialId).sold += e.weightKg;
  }
  for (const p of liveProduction(d)) { row(p.toMaterialId).produced += p.totalKg; row(p.fromMaterialId).consumed += p.inputKg ?? p.totalKg; }
  return [...rows].map(([id, r]) => ({ id, name: d.materials.find((m) => m.id === id)?.name ?? "Unknown", ...r, stock: r.purchased + r.produced - r.sold - r.consumed }));
}

/* ---------- backup ---------- */
export function exportJSON() {
  return JSON.stringify({ app: "cashbook", version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}
export function importJSON(text: string) {
  const parsed = JSON.parse(text);
  const incoming: Data = parsed.data ?? parsed;
  if (!Array.isArray(incoming.accounts) || !Array.isArray(incoming.entries)) throw new Error("Invalid backup file");
  commit((d) => {
    Object.assign(d, { ...empty(), ...incoming, accountTypes: incoming.accountTypes ?? [], loans: incoming.loans ?? [], materials: incoming.materials ?? empty().materials, production: incoming.production ?? [], bills: incoming.bills ?? [], auth: d.auth ?? incoming.auth });
    migrate(d);
  });
}

/* ---------- rolling snapshots (auto-backup) ---------- */
const SNAP = "cashbook-snapshots";
export interface Snapshot { at: string; data: string }
export function getSnapshots(): Snapshot[] {
  try { return JSON.parse(localStorage.getItem(SNAP) || "[]"); } catch { return []; }
}
export function takeSnapshot() {
  if (!loaded) return;
  const list = getSnapshots();
  const json = JSON.stringify(data);
  if (list[0]?.data === json) return;
  list.unshift({ at: new Date().toISOString(), data: json });
  try { localStorage.setItem(SNAP, JSON.stringify(list.slice(0, 10))); } catch { localStorage.setItem(SNAP, JSON.stringify(list.slice(0, 3))); }
}
export function restoreSnapshot(at: string) {
  const s = getSnapshots().find((x) => x.at === at);
  if (!s) return;
  const parsed = JSON.parse(s.data);
  commit((d) => { Object.assign(d, { ...empty(), ...parsed, auth: d.auth }); migrate(d); });
}
export async function changePassword(pin: string) {
  const hash = await hashPw(pin);
  commit((d) => { if (d.auth) { d.auth.hash = hash; d.auth.mode = "pin"; } }, false);
}
