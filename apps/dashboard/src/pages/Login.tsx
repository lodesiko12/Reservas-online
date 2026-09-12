import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError("Credenciales incorrectas.");
    setLoading(false);
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-xl bg-brand-500 grid place-items-center text-white font-bold text-xl">R</div>
          <h1 className="mt-3 text-xl font-bold">Panel de Reservas</h1>
          <p className="text-sm text-slate-500">Accede con tu cuenta</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : "Entrar"}
          </button>
        </form>
        <p className="text-center text-xs text-slate-400 mt-4">
          Demo · admin@reservas.test / staff@barberia.test
        </p>
      </div>
    </div>
  );
}
