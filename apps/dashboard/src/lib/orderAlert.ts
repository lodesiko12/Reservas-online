// Aviso sonoro para pedidos nuevos (restaurante con pedidos online).
// El navegador solo permite audio tras una interacción del usuario; si aún no la ha habido,
// el aviso se omite sin error (el globo del menú sigue indicando los pedidos nuevos).

const KEY = "turnigo:order-sound";
let ctx: AudioContext | null = null;

export function isOrderSoundOn(): boolean {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}

export function setOrderSoundOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* sin localStorage */ }
}

/** Dos tonos cortos ascendentes. */
export function playOrderBeep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.22 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.2);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + i * 0.22);
      osc.stop(now + i * 0.22 + 0.22);
    });
  } catch {
    /* audio no disponible */
  }
}
