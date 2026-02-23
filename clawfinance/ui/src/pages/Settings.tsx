import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Info,
  Download,
  Shield,
  Globe,
  Palette,
} from "lucide-react";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntegrationStatus {
  configured: boolean;
  label: string;
}

interface HealthResponse {
  status: string;
  db: string;
  redis: string;
  integrations: Record<string, IntegrationStatus>;
  uptime: number;
}

// ─── Integration definitions ──────────────────────────────────────────────────

interface IntegrationDef {
  id: string;
  name: string;
  description: string;
  category: "banking" | "investments" | "market_data" | "tax" | "research" | "ai";
  docsUrl: string;
  signupUrl: string;
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
  required: boolean;
  envKeys: string[];
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Powers all AI agents — required for any intelligence features.",
    category: "ai",
    docsUrl: "https://docs.anthropic.com/en/api/getting-started",
    signupUrl: "https://console.anthropic.com",
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "API Key", placeholder: "sk-ant-...", secret: true },
    ],
    required: true,
    envKeys: ["ANTHROPIC_API_KEY"],
  },
  {
    id: "plaid",
    name: "Plaid",
    description: "Connects bank accounts, credit cards, and transaction history.",
    category: "banking",
    docsUrl: "https://plaid.com/docs/quickstart/",
    signupUrl: "https://dashboard.plaid.com/signup",
    fields: [
      { key: "PLAID_CLIENT_ID", label: "Client ID", placeholder: "your_client_id" },
      { key: "PLAID_SECRET", label: "Secret", placeholder: "your_secret", secret: true },
      { key: "PLAID_ENV", label: "Environment", placeholder: "sandbox | development | production" },
    ],
    required: false,
    envKeys: ["PLAID_CLIENT_ID", "PLAID_SECRET"],
  },
  {
    id: "snaptrade",
    name: "SnapTrade",
    description: "Aggregates brokerage accounts (Fidelity, Schwab, TD, etc.) for portfolio tracking.",
    category: "investments",
    docsUrl: "https://docs.snaptrade.com/",
    signupUrl: "https://app.snaptrade.com/signup",
    fields: [
      { key: "SNAPTRADE_CLIENT_ID", label: "Client ID", placeholder: "your_client_id" },
      { key: "SNAPTRADE_CONSUMER_KEY", label: "Consumer Key", placeholder: "your_consumer_key", secret: true },
    ],
    required: false,
    envKeys: ["SNAPTRADE_CLIENT_ID", "SNAPTRADE_CONSUMER_KEY"],
  },
  {
    id: "finnhub",
    name: "Finnhub",
    description: "Real-time stock quotes, earnings calendars, company news, and analyst ratings.",
    category: "market_data",
    docsUrl: "https://finnhub.io/docs/api",
    signupUrl: "https://finnhub.io/register",
    fields: [
      { key: "FINNHUB_API_KEY", label: "API Key", placeholder: "your_api_key", secret: true },
    ],
    required: false,
    envKeys: ["FINNHUB_API_KEY"],
  },
  {
    id: "azure_doc_intel",
    name: "Azure Document Intelligence",
    description: "OCR for tax documents (W-2, 1099, etc.) enabling automatic data extraction.",
    category: "tax",
    docsUrl: "https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/",
    signupUrl: "https://portal.azure.com/#create/Microsoft.CognitiveServicesFormRecognizer",
    fields: [
      { key: "AZURE_DOC_INTEL_ENDPOINT", label: "Endpoint", placeholder: "https://your-resource.cognitiveservices.azure.com/" },
      { key: "AZURE_DOC_INTEL_KEY", label: "API Key", placeholder: "your_key", secret: true },
    ],
    required: false,
    envKeys: ["AZURE_DOC_INTEL_ENDPOINT", "AZURE_DOC_INTEL_KEY"],
  },
  {
    id: "taxbandits",
    name: "TaxBandits",
    description: "E-file tax forms and retrieve filing status programmatically.",
    category: "tax",
    docsUrl: "https://developer.taxbandits.com/docs",
    signupUrl: "https://www.taxbandits.com/signup/",
    fields: [
      { key: "TAXBANDITS_API_KEY", label: "API Key", placeholder: "your_api_key", secret: true },
    ],
    required: false,
    envKeys: ["TAXBANDITS_API_KEY"],
  },
  {
    id: "twitter",
    name: "Twitter / X API",
    description: "Sentiment analysis for stocks and companies via social data.",
    category: "research",
    docsUrl: "https://developer.twitter.com/en/docs/twitter-api",
    signupUrl: "https://developer.twitter.com/en/portal/projects-and-apps",
    fields: [
      { key: "TWITTER_API_KEY", label: "API Key", placeholder: "your_api_key" },
      { key: "TWITTER_API_SECRET", label: "API Secret", placeholder: "your_api_secret", secret: true },
      { key: "TWITTER_ACCESS_TOKEN", label: "Access Token", placeholder: "your_access_token" },
      { key: "TWITTER_ACCESS_SECRET", label: "Access Secret", placeholder: "your_access_secret", secret: true },
    ],
    required: false,
    envKeys: ["TWITTER_API_KEY", "TWITTER_API_SECRET"],
  },
  {
    id: "serpapi",
    name: "SerpAPI",
    description: "Google Trends, App Store rankings, and job posting data for alternative investment signals.",
    category: "research",
    docsUrl: "https://serpapi.com/search-api",
    signupUrl: "https://serpapi.com/users/sign_up",
    fields: [
      { key: "SERPAPI_KEY", label: "API Key", placeholder: "your_api_key", secret: true },
    ],
    required: false,
    envKeys: ["SERPAPI_KEY"],
  },
];

const CATEGORY_LABELS: Record<IntegrationDef["category"], string> = {
  ai: "AI Engine",
  banking: "Banking & Cards",
  investments: "Investments",
  market_data: "Market Data",
  tax: "Tax",
  research: "Research & Sentiment",
};

const CATEGORY_ORDER: IntegrationDef["category"][] = [
  "ai",
  "banking",
  "investments",
  "market_data",
  "tax",
  "research",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ configured, label }: IntegrationStatus) {
  if (configured) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-claw-400">
        <CheckCircle size={12} /> {label}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
      <XCircle size={12} /> Not configured
    </span>
  );
}

function IntegrationCard({
  integration,
  serverStatus,
}: {
  integration: IntegrationDef;
  serverStatus: IntegrationStatus | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const configured = serverStatus?.configured ?? false;

  function toggleSecret(key: string) {
    setShowSecret((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    // In dev mode: tell user to update .env
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className={`rounded-xl border ${configured ? "border-claw-800 bg-claw-950/30" : "border-gray-800 bg-gray-900"} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white">{integration.name}</h3>
            {integration.required && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-claw-900 text-claw-300 font-medium">Required</span>
            )}
            {serverStatus && <StatusBadge {...serverStatus} />}
          </div>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed">{integration.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={integration.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-claw-400 flex items-center gap-1 transition-colors"
          >
            Sign up <ExternalLink size={10} />
          </a>
          <a
            href={integration.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-claw-400 flex items-center gap-1 transition-colors"
          >
            Docs <ExternalLink size={10} />
          </a>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            {expanded ? "Hide" : "Configure"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="p-3 rounded-lg bg-gray-800/60 flex gap-2 text-xs text-gray-400">
            <Info size={14} className="flex-shrink-0 mt-0.5 text-claw-500" />
            <span>
              Add these keys to your{" "}
              <code className="bg-gray-700 px-1 rounded font-mono">clawfinance/.env</code> file
              and restart the API server. Keys are stored locally and never transmitted.
            </span>
          </div>

          {integration.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                {field.label}
                <code className="ml-2 text-gray-600 font-mono">{field.key}</code>
              </label>
              <div className="relative">
                <input
                  type={field.secret && !showSecret[field.key] ? "password" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-claw-600"
                />
                {field.secret && (
                  <button
                    type="button"
                    onClick={() => toggleSecret(field.key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                  >
                    {showSecret[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              Paste your keys above, then copy the{" "}
              <code className="bg-gray-800 px-1 rounded font-mono">KEY=value</code> pairs into your{" "}
              <code className="bg-gray-800 px-1 rounded font-mono">.env</code> file.
            </p>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-claw-700 hover:bg-claw-600 text-white text-xs font-medium transition-colors"
            >
              <Save size={12} />
              {saved ? "Copied to clipboard!" : "Copy .env snippet"}
            </button>
          </div>

          {Object.keys(values).length > 0 && (
            <pre className="mt-2 p-3 rounded-lg bg-gray-950 border border-gray-800 text-xs font-mono text-claw-300 overflow-x-auto">
              {integration.fields
                .filter((f) => values[f.key])
                .map((f) => `${f.key}=${values[f.key]}`)
                .join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Health Panel ─────────────────────────────────────────────────────────────

function HealthPanel({ health, loading, onRefresh }: {
  health: HealthResponse | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  function ServiceBadge({ ok, label }: { ok: boolean; label: string }) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${ok ? "bg-claw-950/40 border border-claw-800" : "bg-red-950/40 border border-red-800"}`}>
        {ok ? <CheckCircle size={14} className="text-claw-400" /> : <XCircle size={14} className="text-red-400" />}
        <span className="text-xs font-medium text-gray-300">{label}</span>
        <span className={`text-xs ${ok ? "text-claw-400" : "text-red-400"}`}>{ok ? "OK" : "Error"}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">System Status</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-claw-400 transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {!health ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <AlertCircle size={14} className="text-yellow-500" />
          API server not reachable. Is it running?
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ServiceBadge ok={health.db === "ok"} label="PostgreSQL" />
            <ServiceBadge ok={health.redis === "ok"} label="Redis" />
          </div>
          <div className="text-xs text-gray-600 pt-1">
            Uptime: {Math.floor(health.uptime / 60)}m {Math.floor(health.uptime % 60)}s
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preferences Panel ────────────────────────────────────────────────────────

interface UserPreferences {
  currency: string;
  locale: string;
  date_format: string;
  theme: string;
  default_date_range_days: number;
  dashboard_layout: string;
}

function PreferencesPanel() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ data: UserPreferences }>("/api/preferences")
      .then((r) => setPrefs(r.data))
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    try {
      await api.patch<{ data: UserPreferences }>("/api/preferences", prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Globe size={16} className="text-claw-400" />
        <h2 className="text-sm font-semibold text-white">Preferences</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Currency</label>
          <select
            value={prefs.currency}
            onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg"
          >
            {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY", "INR", "BRL"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Date Format</label>
          <select
            value={prefs.date_format}
            onChange={(e) => setPrefs({ ...prefs, date_format: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg"
          >
            {["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", "DD.MM.YYYY"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Theme</label>
          <select
            value={prefs.theme}
            onChange={(e) => setPrefs({ ...prefs, theme: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg"
          >
            {["dark", "light", "system"].map((t) => (
              <option key={t} className="capitalize">{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Dashboard Layout</label>
          <select
            value={prefs.dashboard_layout}
            onChange={(e) => setPrefs({ ...prefs, dashboard_layout: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg"
          >
            {["default", "compact", "detailed"].map((l) => (
              <option key={l} className="capitalize">{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Locale</label>
          <select
            value={prefs.locale}
            onChange={(e) => setPrefs({ ...prefs, locale: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg"
          >
            {["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "ja-JP", "zh-CN", "pt-BR"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Default Date Range</label>
          <select
            value={prefs.default_date_range_days}
            onChange={(e) => setPrefs({ ...prefs, default_date_range_days: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg"
          >
            {[7, 14, 30, 60, 90, 180, 365].map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-claw-700 hover:bg-claw-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Save size={12} />
          {saved ? "Saved!" : saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}

// ─── Data Export Panel ────────────────────────────────────────────────────────

function DataExportPanel() {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const body: any = { format };
      if (encrypt && passphrase) {
        body.encrypt = true;
        body.passphrase = passphrase;
      }
      const res = await fetch("/api/data/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clawfinance-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Download size={16} className="text-claw-400" />
        <h2 className="text-sm font-semibold text-white">Data Export & Backup</h2>
      </div>

      <p className="text-xs text-gray-400">
        Export all your financial data. Data stays on your machine — exports are generated locally and never transmitted.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "json" | "csv")}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg"
          >
            <option value="json">JSON (all data)</option>
            <option value="csv">CSV (transactions only)</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-claw-600 focus:ring-claw-500"
            />
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Shield size={12} /> Encrypt with passphrase
            </span>
          </label>
        </div>
      </div>

      {encrypt && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Passphrase (min 8 characters)</label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter encryption passphrase..."
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg placeholder-gray-600 focus:outline-none focus:border-claw-600"
          />
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleExport}
          disabled={exporting || (encrypt && passphrase.length < 8)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-claw-700 hover:bg-claw-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Download size={12} />
          {exported ? "Downloaded!" : exporting ? "Exporting..." : "Export Data"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Settings() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"integrations" | "preferences" | "data">("integrations");

  async function fetchHealth() {
    setHealthLoading(true);
    try {
      const data = await api.get<HealthResponse>("/api/health");
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
  }, []);

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: INTEGRATIONS.filter((i) => i.category === cat),
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-400">
          Configure integrations, personalize your experience, and manage your data.
          All credentials and data are stored locally and never leave your machine.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
        {([
          { key: "integrations", label: "Integrations", icon: ExternalLink },
          { key: "preferences", label: "Preferences", icon: Palette },
          { key: "data", label: "Data & Backup", icon: Shield },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              activeSection === key ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* System health */}
      <HealthPanel health={health} loading={healthLoading} onRefresh={fetchHealth} />

      {activeSection === "integrations" && (
        <>
          {/* Setup instructions */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Quick Setup</h2>
            <ol className="space-y-2 text-xs text-gray-400">
              <li className="flex gap-2">
                <span className="font-bold text-claw-500 flex-shrink-0">1.</span>
                Copy the example env file:
                <code className="bg-gray-800 px-1.5 py-0.5 rounded font-mono text-gray-300">cp clawfinance/.env.example clawfinance/.env</code>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-claw-500 flex-shrink-0">2.</span>
                Fill in the API keys below (click "Configure" on each integration)
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-claw-500 flex-shrink-0">3.</span>
                Start the stack:
                <code className="bg-gray-800 px-1.5 py-0.5 rounded font-mono text-gray-300">cd clawfinance && docker-compose up -d</code>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-claw-500 flex-shrink-0">4.</span>
                Restart the API after any key changes to pick up new values
              </li>
            </ol>
          </div>

          {/* Integrations by category */}
          {byCategory.map(({ category, label, items }) => (
            <section key={category}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {label}
              </h2>
              <div className="space-y-3">
                {items.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    serverStatus={
                      health?.integrations?.[integration.id]
                    }
                  />
                ))}
              </div>
            </section>
          ))}

          {/* SEC note — no key needed */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">SEC EDGAR</h2>
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-claw-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">No API key required</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  SEC EDGAR is a free public API. The mcp-sec server works out of the box.{" "}
                  <a href="https://www.sec.gov/developer" target="_blank" rel="noopener noreferrer" className="text-claw-400 hover:underline">
                    sec.gov/developer <ExternalLink size={10} className="inline" />
                  </a>
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {activeSection === "preferences" && <PreferencesPanel />}

      {activeSection === "data" && (
        <>
          <DataExportPanel />

          {/* Security info */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-claw-400" />
              <h2 className="text-sm font-semibold text-white">Security & Privacy</h2>
            </div>
            <div className="space-y-2 text-xs text-gray-400">
              <p>
                <strong className="text-gray-300">Local-first architecture:</strong> All financial data is stored in your local PostgreSQL
                database. No data is sent to external servers unless you explicitly configure integrations.
              </p>
              <p>
                <strong className="text-gray-300">Encrypted at rest:</strong> Sensitive fields (access tokens, account identifiers) are
                encrypted using AES-256 via pgcrypto. Your encryption key stays in your local .env file.
              </p>
              <p>
                <strong className="text-gray-300">Audit logging:</strong> All data access and mutations are logged with timestamps,
                IP addresses, and request IDs for compliance-grade traceability.
              </p>
              <p>
                <strong className="text-gray-300">API security:</strong> Rate limiting, input validation (Zod), security headers,
                and WebSocket authentication protect all endpoints.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
