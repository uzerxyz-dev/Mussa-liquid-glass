import { toast } from "sonner";

/** Shows an error, vibrates on phones and highlights the field with the given id. */
export function fieldError(id: string | null, message: string) {
  toast.error(message);
  try { navigator.vibrate?.([60, 40, 60]); } catch { /* unsupported */ }
  if (!id || typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  const target = (el.matches("input,select,textarea,button") ? el : el.querySelector<HTMLElement>("input,select,textarea,button")) ?? el;
  el.classList.add("field-error");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  target.focus?.({ preventScroll: true });
  const clear = () => { el.classList.remove("field-error"); el.removeEventListener("input", clear, true); el.removeEventListener("change", clear, true); };
  el.addEventListener("input", clear, true);
  el.addEventListener("change", clear, true);
  setTimeout(clear, 6000);
}
