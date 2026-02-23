import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar.tsx";
import Header from "./components/layout/Header.tsx";
import ChatPanel from "./components/layout/ChatPanel.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import NetWorthDashboard from "./pages/NetWorthDashboard.tsx";
import PortfolioView from "./pages/PortfolioView.tsx";
import TransactionsBudget from "./pages/TransactionsBudget.tsx";
import TaxCenter from "./pages/TaxCenter.tsx";
import ResearchNews from "./pages/ResearchNews.tsx";
import Settings from "./pages/Settings.tsx";
import GoalsPage from "./pages/Goals.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary fallbackTitle="Application error">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-6">
              <Routes>
                <Route path="/" element={<ErrorBoundary fallbackTitle="Dashboard error"><NetWorthDashboard /></ErrorBoundary>} />
                <Route path="/portfolio" element={<ErrorBoundary fallbackTitle="Portfolio error"><PortfolioView /></ErrorBoundary>} />
                <Route path="/transactions" element={<ErrorBoundary fallbackTitle="Transactions error"><TransactionsBudget /></ErrorBoundary>} />
                <Route path="/tax" element={<ErrorBoundary fallbackTitle="Tax Center error"><TaxCenter /></ErrorBoundary>} />
                <Route path="/research" element={<ErrorBoundary fallbackTitle="Research error"><ResearchNews /></ErrorBoundary>} />
                <Route path="/goals" element={<ErrorBoundary fallbackTitle="Goals error"><GoalsPage /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary fallbackTitle="Settings error"><Settings /></ErrorBoundary>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
        {/* Floating AI chat panel — always visible */}
        <ChatPanel />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
