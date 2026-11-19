import {
  Armchair, Ban, Bell, BookOpen, Building2, CakeSlice, CalendarDays, Euro, FileText, FolderKanban,
  Home, Inbox, LayoutDashboard, LayoutGrid, MessageCircle, Plus, Receipt, Scissors, Settings,
  ShoppingBag, Stethoscope, TrendingUp, User, Users, UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * Las definiciones de navegación (BusinessApp, AdminApp, AgenciaApp) siguen usando un emoji como
 * identificador de `icon`; aquí se traduce a un icono de línea. Un emoji sin traducción se muestra tal cual.
 */
const ICONS: Record<string, LucideIcon> = {
  "🏢": Building2,
  "🏠": Home,
  "📊": LayoutDashboard,
  "👥": Users,
  "🧑‍🤝‍🧑": Users,
  "👤": User,
  "💬": MessageCircle,
  "📅": CalendarDays,
  "🗓": CalendarDays,
  "🔔": Bell,
  "📥": Inbox,
  "⚙": Settings,
  "🗂": FolderKanban,
  "📝": FileText,
  "🧾": Receipt,
  "🩺": Stethoscope,
  "💶": Euro,
  "✂": Scissors,
  "🚫": Ban,
  "📈": TrendingUp,
  "🟢": LayoutGrid,
  "🛍": ShoppingBag,
  "➕": Plus,
  "🍰": CakeSlice,
  "🍽": UtensilsCrossed,
  "📒": BookOpen,
  "📖": BookOpen,
  "🪑": Armchair,
};

export function NavIcon({ icon, size = 18, className }: { icon: string; size?: number; className?: string }) {
  const Icon = ICONS[icon.replace(/️/g, "")];
  if (!Icon) return <span className={className}>{icon}</span>;
  return <Icon size={size} strokeWidth={1.75} className={className} aria-hidden="true" />;
}
