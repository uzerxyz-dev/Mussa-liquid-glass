import { supabase } from "@/integrations/supabase/client";
import { getData, importJSON, exportJSON, takeSnapshot } from "./db";

/** Upload the whole local cash book to the signed-in user's cloud copy. */
export async function backupToCloud() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in to cloud backup");
  const { auth: _local, ...rest } = getData();
  const { error } = await supabase.from("cloud_backups").upsert({ user_id: u.user.id, data: rest as never, updated_at: new Date().toISOString() });
  if (error) throw error;
  localStorage.setItem("cashbook-cloud-last", new Date().toISOString());
}

export async function lastCloudBackup() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from("cloud_backups").select("updated_at").eq("user_id", u.user.id).maybeSingle();
  return data?.updated_at ?? null;
}

/** Replace local data with the cloud copy (local snapshot taken first). */
export async function restoreFromCloud() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in to cloud backup");
  const { data, error } = await supabase.from("cloud_backups").select("data").eq("user_id", u.user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No cloud backup found for this account");
  takeSnapshot();
  importJSON(JSON.stringify({ data: data.data }));
}

let timer: ReturnType<typeof setTimeout> | undefined;
let lastSent = "";
/** Debounced auto-backup; silently skipped when offline or signed out. */
export function scheduleAutoBackup() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (!navigator.onLine) return;
    const json = exportJSON();
    if (json === lastSent) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    try { await backupToCloud(); lastSent = json; } catch { /* retry on next change */ }
  }, 5000);
}
