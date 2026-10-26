import { describe, it, expect, beforeEach, vi } from "vitest";

const store: Record<string, string> = {};
vi.stubGlobal("sessionStorage", { clear: () => {} });
vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; }, key: () => null, length: 0 });

const db = await import("../db");
const { addAccount, addEntry, addCapital, addBank, addTransfer, updateEntry, getData, accountBalance, partyTotals, fundBalance, fundLedger, CASH, resetAllData, migrate, openingCapital, saveOpening } = db;

beforeEach(() => resetAllData());

describe("reported scenario", () => {
  it("capital, cash purchase, credit purchase and advance classify correctly", () => {
    const ali = addAccount({ name: "Ali Traders", type: "supplier", phone: "", address: "", openingBalance: 0 });
    addCapital({ date: "2026-10-01", amount: 5000000, fund: CASH });
    expect(fundBalance(getData(), CASH)).toBe(5000000);
    expect(partyTotals(getData()).payable).toBe(0);

    expect(5367 * 148).toBe(794316);
    // cash purchase: purchase + linked payment (Paid Now)
    const p1 = addEntry({ type: "purchase", date: "2026-10-02", amount: 794316, accountId: ali.id, particulars: "Scrap", payMode: "advance", weightKg: 5367, rate: 148 });
    addEntry({ type: "outward", date: "2026-10-02", amount: 794316, accountId: ali.id, method: "cash", particulars: "pay", linkedId: p1.id });
    expect(fundBalance(getData(), CASH)).toBe(4205684);
    expect(accountBalance(getData(), ali.id)).toBe(0);

    expect(4603 * 148).toBe(681244);
    addEntry({ type: "purchase", date: "2026-10-03", amount: 681244, accountId: ali.id, particulars: "Scrap", payMode: "credit", weightKg: 4603, rate: 148 });
    expect(fundBalance(getData(), CASH)).toBe(4205684);
    expect(partyTotals(getData()).payable).toBe(681244);

    // advance to supplier (separate party, nothing owed yet)
    const bilal = addAccount({ name: "Bilal Steel", type: "supplier", phone: "", address: "", openingBalance: 0 });
    addEntry({ type: "outward", date: "2026-10-04", amount: 681244, accountId: bilal.id, method: "cash", particulars: "advance" });
    expect(fundBalance(getData(), CASH)).toBe(4205684 - 681244);
    const t = partyTotals(getData());
    expect(t.payable).toBe(681244);
    expect(t.supplierAdvance).toBe(681244);
  });

  it("legacy 'My Capital' party marked as owner capital is not a payable", () => {
    const cap = addAccount({ name: "My Capital", type: "supplier", phone: "", address: "", openingBalance: 0 });
    addEntry({ type: "inward", date: "2026-10-01", amount: 5000000, accountId: cap.id, method: "cash", particulars: "capital" });
    expect(partyTotals(getData()).payable).toBe(5000000);
    db.updateAccount(cap.id, { equity: true });
    expect(partyTotals(getData()).payable).toBe(0);
    expect(fundBalance(getData(), CASH)).toBe(5000000);
  });
});

describe("banks and cheques", () => {
  it("online goes to bank, not cash; transfers are internal", () => {
    const b1 = addBank({ name: "Meezan", openingBalance: 100000 });
    const b2 = addBank({ name: "HBL", openingBalance: 0 });
    const buyer = addAccount({ name: "Buyer", type: "buyer", phone: "", address: "", openingBalance: 0 });
    addEntry({ type: "inward", date: "2026-10-01", amount: 50000, accountId: buyer.id, method: "online", bankId: b1.id, reference: "TRX1", particulars: "" });
    expect(fundBalance(getData(), CASH)).toBe(0);
    expect(fundBalance(getData(), b1.id)).toBe(150000);
    addTransfer({ date: "2026-10-02", amount: 30000, from: b1.id, to: b2.id });
    expect(fundBalance(getData(), b1.id)).toBe(120000);
    expect(fundBalance(getData(), b2.id)).toBe(30000);
  });

  it("pending cheque is listed but not available; bounce restores party due", () => {
    const b = addBank({ name: "Meezan", openingBalance: 0 });
    const buyer = addAccount({ name: "Buyer", type: "buyer", phone: "", address: "", openingBalance: 0 });
    addEntry({ type: "sale", date: "2026-10-01", amount: 80000, accountId: buyer.id, particulars: "", payMode: "credit" });
    const chq = addEntry({ type: "inward", date: "2026-10-02", amount: 80000, accountId: buyer.id, method: "cheque", chequeNo: "123", bankId: b.id, chequeStatus: "pending", particulars: "" });
    expect(fundBalance(getData(), b.id)).toBe(0);
    expect(fundLedger(getData(), b.id).pending).toBe(80000);
    updateEntry(chq.id, { chequeStatus: "cleared" });
    expect(fundBalance(getData(), b.id)).toBe(80000);
    updateEntry(chq.id, { chequeStatus: "bounced" });
    expect(fundBalance(getData(), b.id)).toBe(0);
    expect(accountBalance(getData(), buyer.id)).toBe(80000);
  });

  it("migration links legacy bank names without deleting", () => {
    const d = structuredClone(getData());
    d.entries.push({ id: "x", voucherNo: 1, type: "inward", date: "2026-01-01", amount: 10, method: "online", bank: "Meezan Bank", particulars: "", createdAt: "" });
    migrate(d, () => "b1");
    expect(d.entries[0]!.bankId).toBe("b1");
    expect(d.banks[0]!.name).toBe("Meezan Bank");
  });
});

describe("opening capital", () => {
  it("equals assets minus liabilities", () => {
    const s = addAccount({ name: "Sup", type: "supplier", phone: "", address: "", openingBalance: 0 });
    saveOpening({ date: "2026-01-01", cash: 100000, stock: [{ materialId: "mat-scrap", kg: 1000, value: 148000 }], others: [{ id: "l", name: "Loan", kind: "liability", amount: 50000 }] }, { [s.id]: -20000 }, [], [{ name: "Meezan", openingBalance: 200000 }]);
    expect(openingCapital(getData()).capital).toBe(100000 + 200000 + 148000 - 20000 - 50000);
    expect(fundBalance(getData(), CASH)).toBe(100000);
  });
});

describe("heat production costing", () => {
  it("computes billet output, variance and cost per kg from samples, energy rate and material average", () => {
    const { addProduction, addBill, effectiveRate, materialAvgCost, stockSummary } = db;
    const d0 = getData();
    const scrap = d0.materials.find((m) => m.name === "Scrap")!;
    const billet = d0.materials.find((m) => m.name === "Billet")!;
    // 5,367 kg @ 148 => weighted average 148
    addEntry({ type: "purchase", date: "2026-10-02", amount: 794316, particulars: "Scrap", payMode: "credit", materialId: scrap.id, weightKg: 5367, rate: 148 });
    expect(materialAvgCost(getData(), scrap.id)).toBeCloseTo(148, 6);
    // bill: 2,784,000 / 12,400 units = 224.61.../unit
    addBill({ period: "Oct 2026", amount: 2784000, units: 12400 });
    const rate = effectiveRate(getData());
    expect(rate).toBeCloseTo(2784000 / 12400, 6);
    // heat: samples avg 21.4 × 200 bars = 4,280 kg billet; input 4,600; slag 240; waste 80
    const avgBar = (21.3 + 21.5 + 21.4 + 21.4) / 4;
    const out = avgBar * 200;
    expect(out).toBeCloseTo(4280, 6);
    const input = 4600, kwh = 610;
    const cost = input * 148 + kwh * rate;
    addProduction({
      date: "2026-10-10", fromMaterialId: scrap.id, toMaterialId: billet.id,
      bars: 200, barWeightKg: avgBar, totalKg: out, note: "",
      shift: "Day", samples: [21.3, 21.5, 21.4, 21.4], inputKg: input, slagKg: 240, wasteKg: 80, kwh,
      cost: Math.round(cost), costPerKg: Math.round((cost / out) * 100) / 100, varianceKg: input - (out + 240 + 80),
    });
    const s = stockSummary(getData());
    expect(s.find((r) => r.id === scrap.id)!.stock).toBeCloseTo(5367 - 4600, 6);
    expect(s.find((r) => r.id === billet.id)!.stock).toBeCloseTo(4280, 6);
    const heat = getData().production[0]!;
    expect(heat.varianceKg).toBeCloseTo(0, 6);
    expect(heat.costPerKg).toBeCloseTo(Math.round((cost / 4280) * 100) / 100, 6);
  });
});
