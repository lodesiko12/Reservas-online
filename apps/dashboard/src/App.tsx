import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Login } from "./pages/Login";
import { Spinner } from "./components/ui";
import { AdminApp } from "./admin/AdminApp";
import { BusinessApp } from "./business/BusinessApp";

export default function App() {
  const { loading, session, isSuperAdmin, business, businesses } = useAuth();

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  }
  if (!session) return <Login />;

  if (isSuperAdmin) {
    return (
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  if (business) {
    return (
      <Routes>
        <Route path="/app/*" element={<BusinessApp />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    );
  }

  // Autenticado pero sin negocio ni rol admin.
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div className="card p-8 max-w-md">
        <h1 className="text-lg font-bold mb-2">Sin negocio asignado</h1>
        <p className="text-slate-600 text-sm">
          Tu cuenta no está vinculada a ningún negocio. Contacta con el administrador.
        </p>
        {businesses.length === 0 && (
          <a href="/" className="btn-ghost mt-4" onClick={() => { /* fallthrough */ }}>Reintentar</a>
        )}
      </div>
    </div>
  );
}
