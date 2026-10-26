import { describe, it, expect } from "vitest";
import { signedForAccount, entryFunds, type Entry } from "@/lib/db";
const base = { id: "x", date: "2026-10-19", amount: 600000, particulars: "", voucherNo: 1, createdAt: "" } as unknown as Entry;
describe("net sale", () => {
  it("does not change party balance", () => { expect(signedForAccount({ ...base, type: "sale", payMode: "net" })).toBe(0); });
  it("credit sale adds to balance", () => { expect(signedForAccount({ ...base, type: "sale", payMode: "credit" })).toBe(600000); });
  it("net purchase moves no cash", () => { expect(entryFunds({ ...base, type: "purchase", payMode: "net" }).reduce((t, f) => t + f.delta, 0)).toBe(0); });
});
