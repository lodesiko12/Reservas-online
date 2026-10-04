// Notificaciones push (Web Push) de la agencia. Cada dispositivo se suscribe con la clave
// pública VAPID; el servidor (Edge Function agency-push) firma con la privada.
import { supabase } from "../../lib/supabase";

// Clave PÚBLICA (no es un secreto). La privada vive solo en los secretos de agency-push.
export const VAPID_PUBLIC_KEY = "BCQWlWh3UvCDdhToc_89ypCpywPBXEn72Njfj-vOV-bUCHOCLuCuVzc7kNqaIhIKIQvuwHeg0iHBi2I7GNwnN38";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}
function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function toKey(b64: string): ArrayBuffer {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function getPushState(): Promise<PushState> {
  // En iPhone/iPad el push solo funciona con la app añadida a la pantalla de inicio.
  if (isIos() && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function enablePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, error: "No has permitido las notificaciones en este dispositivo." };
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    const { error } = await supabase.rpc("agency_save_push_subscription", {
      p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh ?? "", p_auth: j.keys?.auth ?? "", p_user_agent: navigator.userAgent,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "No se pudieron activar las notificaciones." };
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("agency_push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
