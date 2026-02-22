import { useLocation } from "react-router-dom";

const TITLES: Record<string, string> = {
  "/": "Net Worth",
  "/portfolio": "Portfolio",
  "/transactions": "Transactions & Budget",
  "/tax": "Tax Center",
  "/research": "Research & News",
  "/settings": "Settings",
};

export default function Header() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "ClawFinance";

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-4">
      <h1 className="text-lg font-semibold text-white flex-1">{title}</h1>
      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
        Local · Private
      </span>
    </header>
  );
}
