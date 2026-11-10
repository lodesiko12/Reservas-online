import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui";
import { InstallAppButton } from "../components/InstallAppButton";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // "reset" = "Primera vez o contraseña olvidada": pide el email y envía el enlace para elegir contraseña.
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [resetSent, setResetSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError("Credenciales incorrectas.");
    setLoading(false);
  }

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("password-setup", { body: { email: email.trim() } });
    setLoading(false);
    if (error || (data as any)?.error) {
      let msg = (data as any)?.error ?? "No se pudo enviar el enlace. Inténtalo de nuevo en unos minutos.";
      try { const j = await (error as any)?.context?.json?.(); if (j?.error) msg = j.error; } catch { /* noop */ }
      setError(msg);
      return;
    }
    setResetSent(true);
  }

  function switchMode(m: "login" | "reset") {
    setMode(m); setError(null); setResetSent(false); setPassword("");
  }

  const errorBox = error && (
    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">{error}</div>
  );

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/brand/turnigo-logo-principal.svg" alt="Turnigo" className="mx-auto h-12 w-auto dark:hidden" />
          <img src="/brand/turnigo-logo-negativo.svg" alt="Turnigo" className="mx-auto h-12 w-auto hidden dark:block" />
          <h1 className="sr-only">Turnigo</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {mode === "login" ? "Accede con tu cuenta" : "Crea o cambia tu contraseña"}
          </p>
        </div>

        {mode === "login" ? (
          <form onSubmit={submit} className="card p-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {errorBox}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : "Entrar"}
            </button>
            <button type="button" className="block w-full text-center text-sm text-brand-600 hover:underline dark:text-brand-300" onClick={() => switchMode("reset")}>
              Primera vez o contraseña olvidada
            </button>
          </form>
        ) : resetSent ? (
          <div className="card p-6 space-y-4 text-center">
            <div className="text-4xl">📧</div>
            <p className="font-semibold">Revisa tu correo</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hemos enviado a <strong>{email.trim()}</strong> un enlace para elegir tu contraseña. Caduca en 1 hora; mira también en spam.
            </p>
            <button type="button" className="btn-ghost w-full" onClick={() => switchMode("login")}>Volver a entrar</button>
          </div>
        ) : (
          <form onSubmit={requestReset} className="card p-6 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Escribe el email con el que te dieron acceso y te enviaremos un enlace para elegir tu contraseña.
            </p>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            {errorBox}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : "Enviarme el enlace"}
            </button>
            <button type="button" className="block w-full text-center text-sm text-slate-500 hover:underline dark:text-slate-400" onClick={() => switchMode("login")}>
              Volver
            </button>
          </form>
        )}
        <div className="mt-4"><InstallAppButton className="btn-ghost w-full" /></div>
      </div>
    </div>
  );
}
