import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  FileText,
  Newspaper,
} from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Net Worth" },
  { to: "/portfolio", icon: TrendingUp, label: "Portfolio" },
  { to: "/transactions", icon: CreditCard, label: "Transactions" },
  { to: "/tax", icon: FileText, label: "Tax Center" },
  { to: "/research", icon: Newspaper, label: "Research" },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-800">
        <span className="text-xl font-bold text-white">🦞 ClawFinance</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-claw-700 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
        Phase 1 · Foundation
      </div>
    </aside>
  );
}
