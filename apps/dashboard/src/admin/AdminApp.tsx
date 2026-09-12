import { Routes, Route, Navigate } from "react-router-dom";
import { Layout, type NavItem } from "../components/Layout";
import { Businesses } from "./Businesses";
import { BusinessDetail } from "./BusinessDetail";

const nav: NavItem[] = [
  { to: "/admin", label: "Negocios", icon: "🏢", end: true },
];

export function AdminApp() {
  return (
    <Routes>
      <Route element={<Layout nav={nav} brandLabel="Super-Admin" />}>
        <Route index element={<Businesses />} />
        <Route path="negocio/:id" element={<BusinessDetail />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
