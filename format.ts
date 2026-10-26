export function fmtPKR(n: number, withSymbol = true) {
  const s = Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}${withSymbol ? "Rs " : ""}${s}`;
}

export function todayISO() {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** yyyy-mm-dd -> DD-MM-YYYY */
export function fmtDate(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

/** ISO timestamp -> 03:45 PM */
export function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
}

export function fmtDateTime(iso?: string) {
  if (!iso) return "";
  return `${fmtDate(iso.slice(0, 10) === iso ? iso : localDate(iso))} ${fmtTime(iso)}`;
}

function localDate(iso: string) {
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Search normalisation: ignore case, dashes, spaces, dots etc. */
export function norm(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "");
}

/** Capitalise first letter of every word, keep the rest as typed. */
export function titleCase(s: string) {
  return s.replace(/(^|[\s(/-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
}

const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function two(n: number) {
  if (n < 20) return ones[n];
  return `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`;
}
function three(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ones[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
}

/** Pakistani/Indian system: Crore, Lakh, Thousand */
export function amountInWords(amount: number) {
  let n = Math.floor(Math.abs(amount));
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore > 99 ? three(crore) : two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return `Rupees ${parts.join(" ")} Only`;
}

export function downloadFile(name: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(rows: (string | number)[][]) {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/** Kilograms shown as tons, e.g. 2000 → "2.000 Ton". */
export function fmtTon(kg: number) {
  return `${(kg / 1000).toLocaleString("en-PK", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} Ton`;
}
