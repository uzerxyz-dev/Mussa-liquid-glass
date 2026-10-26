import { describe, expect, it } from "vitest";
import { isChequeOverdue } from "@/components/app/ChequeStatusCard";

describe("cheque status alert", () => {
  const t0 = new Date("2026-10-21T10:00:00Z").getTime();
  const e = { createdAt: "2026-10-21T10:00:00Z" };
  it("does not alert within 30 minutes", () => expect(isChequeOverdue(e, t0 + 29 * 60000)).toBe(false));
  it("alerts after 30 minutes pending", () => expect(isChequeOverdue(e, t0 + 30 * 60000)).toBe(true));
});
