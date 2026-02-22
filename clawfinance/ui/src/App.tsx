import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar.tsx";
import Header from "./components/layout/Header.tsx";
import ChatPanel from "./components/layout/ChatPanel.tsx";
import NetWorthDashboard from "./pages/NetWorthDashboard.tsx";
import PortfolioView from "./pages/PortfolioView.tsx";
import TransactionsBudget from "./pages/TransactionsBudget.tsx";
import TaxCenter from "./pages/TaxCenter.tsx";
import ResearchNews from "./pages/ResearchNews.tsx";
import Settings from "./pages/Settings.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <Routes>
              <Route path="/" element={<NetWorthDashboard />} />
              <Route path="/portfolio" element={<PortfolioView />} />
              <Route path="/transactions" element={<TransactionsBudget />} />
              <Route path="/tax" element={<TaxCenter />} />
              <Route path="/research" element={<ResearchNews />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
      {/* Floating AI chat panel — always visible */}
      <ChatPanel />
    </BrowserRouter>
  );
}
