import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui";

/** ¿La URL trae un enlace de "elegir contraseña"? (?token_hash=…&type=recovery) */
export function getRecoveryToken(): string | null {
  const p = new URLSearchParams(window.location.search);
  return p.get("type") === "recovery" ? p.get("token_hash") : null;
}

/**
 * Pantalla a la que llega el enlace del email. El token se canjea al pulsar "Guardar" (no al
 * abrir la página), así que los antivirus que precargan enlaces no lo gastan.
 */
export function SetPassword({ tokenHash }: { tokenHash: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (pw.length > 72) { setError("La contraseña admite como máximo 72 caracteres."); return; }
    if (pw !== pw2) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true);
    const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (vErr) { setLoading(false); setExpired(true); return; }
    const { error: uErr } = await supabase.auth.updateUser({ password: pw });
    if (uErr) {
      setLoading(false);
      setError(/different from the old password/i.test(uErr.message)
        ? "Elige una contraseña distinta a la anterior."
        : /weak|pwned|easy to guess/i.test(uErr.message)
          ? "Esa contraseña es demasiado débil. Prueba con otra más larga."
          : "No se pudo guardar la contraseña. Inténtalo de nuevo.");
      return;
    }
    // Recarga limpia en la raíz: quita el token de la URL y entra al panel con la sesión ya iniciada.
    window.location.replace("/");
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/brand/turnigo-logo-principal.svg" alt="Turnigo" className="mx-auto h-12 w-auto dark:hidden" />
          <img src="/brand/turnigo-logo-negativo.svg" alt="Turnigo" className="mx-auto h-12 w-auto hidden dark:block" />
          <h1 className="sr-only">Turnigo</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Elige tu contraseña</p>
        </div>
        {expired ? (
          <div className="card p-6 space-y-4 text-center">
            <div className="text-4xl">⌛</div>
            <p className="font-semibold">Este enlace ha caducado o ya se usó</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pide uno nuevo desde la pantalla de acceso con «Primera vez o contraseña olvidada».
            </p>
            <a href="/" className="btn-primary w-full">Ir a acceder</a>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-6 space-y-4">
            <div>
              <label className="label">Nueva contraseña</label>
              <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} autoFocus autoComplete="new-password" placeholder="mín. 8 caracteres" />
            </div>
            <div>
              <label className="label">Repite la contraseña</label>
              <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password" />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">{error}</div>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : "Guardar contraseña y entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
