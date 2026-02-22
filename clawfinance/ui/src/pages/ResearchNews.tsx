import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Search, TrendingUp, TrendingDown, Minus, ExternalLink, Newspaper, BarChart2, Twitter } from "lucide-react";
import { apiFetch } from "../lib/api";

interface NewsItem {
  ticker_symbol: string;
  headline: string;
  summary?: string;
  source: string;
  url?: string;
  published_at: string;
  sentiment_score?: number;
  source_type: string;
  security_name?: string;
}

interface SentimentPoint {
  snapshot_date: string;
  composite_score: number | null;
  tweet_volume: number;
  bull_tweets: number;
  bear_tweets: number;
}

interface AltDataItem {
  metric_date: string;
  metric_type: string;
  metric_value: number;
  metric_label: string;
}

interface ResearchData {
  ticker: string;
  news: NewsItem[];
  sentiment: {
    latest: SentimentPoint | null;
    avg_30d: number | null;
    label: "bullish" | "bearish" | "neutral";
    history: SentimentPoint[];
  };
  alt_data: AltDataItem[];
}

function SentimentBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-gray-500 text-xs">—</span>;
  const label = score > 0.2 ? "Bullish" : score < -0.2 ? "Bearish" : "Neutral";
  const cls =
    score > 0.2
      ? "bg-emerald-900/40 text-emerald-400 border-emerald-700"
      : score < -0.2
      ? "bg-red-900/40 text-red-400 border-red-700"
      : "bg-yellow-900/40 text-yellow-400 border-yellow-700";
  const Icon = score > 0.2 ? TrendingUp : score < -0.2 ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${cls}`}>
      <Icon className="w-3 h-3" />
      {label} ({score > 0 ? "+" : ""}{(score * 100).toFixed(0)})
    </span>
  );
}

function SourceIcon({ type }: { type: string }) {
  if (type === "twitter") return <Twitter className="w-3 h-3 text-sky-400" />;
  if (type === "sec") return <BarChart2 className="w-3 h-3 text-purple-400" />;
  return <Newspaper className="w-3 h-3 text-gray-400" />;
}

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ResearchNews() {
  const [searchInput, setSearchInput] = useState("");
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

  const { data: portfolioNews } = useQuery<{ data: NewsItem[] }>({
    queryKey: ["portfolio-news"],
    queryFn: () => apiFetch("/api/research/portfolio-news"),
    staleTime: 300_000,
  });

  const { data: tickerData, isLoading: tickerLoading } = useQuery<{ data: ResearchData }>({
    queryKey: ["research", activeTicker],
    queryFn: () => apiFetch(`/api/research/${activeTicker}`),
    enabled: !!activeTicker,
    staleTime: 300_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const t = searchInput.trim().toUpperCase();
    if (t) { setActiveTicker(t); setSearchInput(""); }
  };

  const research = tickerData?.data;
  const sentimentHistory = (research?.sentiment.history ?? [])
    .slice()
    .reverse()
    .map((s) => ({
      date: s.snapshot_date,
      score: s.composite_score != null ? Math.round(Number(s.composite_score) * 100) : null,
      bulls: s.bull_tweets,
      bears: s.bear_tweets,
    }));

  const allNews = portfolioNews?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter ticker for deep dive (e.g. NVDA, AAPL)…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-claw-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 bg-claw-600 hover:bg-claw-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Research
        </button>
      </form>

      {/* Ticker Deep Dive */}
      {activeTicker && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{activeTicker} — Deep Dive</h2>
            <button onClick={() => setActiveTicker(null)} className="text-xs text-gray-500 hover:text-gray-300">
              ✕ Close
            </button>
          </div>

          {tickerLoading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
              <div className="w-4 h-4 border-2 border-claw-500 border-t-transparent rounded-full animate-spin" />
              Loading research data…
            </div>
          )}

          {research && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Sentiment Card */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Sentiment</h3>
                <div className="flex items-center gap-3">
                  <SentimentBadge score={research.sentiment.avg_30d} />
                  <span className="text-xs text-gray-500">30-day avg</span>
                </div>
                {research.sentiment.latest && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-800 rounded p-2">
                      <div className="text-emerald-400 font-medium">{research.sentiment.latest.bull_tweets ?? 0}</div>
                      <div className="text-gray-500">Bull tweets</div>
                    </div>
                    <div className="bg-gray-800 rounded p-2">
                      <div className="text-red-400 font-medium">{research.sentiment.latest.bear_tweets ?? 0}</div>
                      <div className="text-gray-500">Bear tweets</div>
                    </div>
                  </div>
                )}
                {sentimentHistory.length > 0 && (
                  <ResponsiveContainer width="100%" height={80}>
                    <AreaChart data={sentimentHistory} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={false} />
                      <YAxis domain={[-100, 100]} tick={{ fontSize: 9, fill: "#6b7280" }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}`, "Sentiment"]}
                      />
                      <Area type="monotone" dataKey="score" stroke="#10b981" fill="url(#sg)" strokeWidth={1.5} dot={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {sentimentHistory.length === 0 && (
                  <p className="text-xs text-gray-600 italic">No sentiment history yet. Run skill-research to populate.</p>
                )}
              </div>

              {/* Alt Data */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Alt Data Signals</h3>
                {research.alt_data.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">No alt data yet. Run fetch_company_intel.py to populate.</p>
                ) : (
                  <div className="space-y-2">
                    {research.alt_data.slice(0, 6).map((d, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 capitalize">{d.metric_type.replace(/_/g, " ")}</span>
                        <span className="text-xs text-white font-medium">{d.metric_label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* News count */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Coverage</h3>
                <div className="text-3xl font-bold text-white">{research.news.length}</div>
                <div className="text-xs text-gray-500">articles in database</div>
                <div className="flex gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">Finnhub </span>
                    <span className="text-white">{research.news.filter((n) => n.source_type === "news").length}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">SEC </span>
                    <span className="text-white">{research.news.filter((n) => n.source_type === "sec").length}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Twitter </span>
                    <span className="text-white">{research.news.filter((n) => n.source_type === "twitter").length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* News Feed for Ticker */}
          {research && research.news.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-semibold text-white">{activeTicker} News Feed</h3>
              </div>
              <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
                {research.news.map((item, i) => (
                  <div key={i} className="px-4 py-3 hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <SourceIcon type={item.source_type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-white font-medium line-clamp-2 leading-snug">{item.headline}</p>
                          {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400 flex-shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{item.source}</span>
                          <span className="text-gray-700">·</span>
                          <span className="text-xs text-gray-500">{item.published_at ? timeSince(item.published_at) : "—"}</span>
                          {item.sentiment_score !== undefined && item.sentiment_score !== null && (
                            <>
                              <span className="text-gray-700">·</span>
                              <SentimentBadge score={item.sentiment_score} />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Portfolio News Feed */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Portfolio News</h2>
          <span className="text-xs text-gray-500">{allNews.length} articles · last 7 days</span>
        </div>

        {allNews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Newspaper className="w-8 h-8 text-gray-700" />
            <p className="text-gray-500 text-sm">No news yet for your portfolio holdings.</p>
            <p className="text-gray-600 text-xs max-w-sm text-center">
              Add holdings to your portfolio and run the research skill to fetch news and sentiment data.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {allNews.map((item, i) => (
              <div key={i} className="px-4 py-3 hover:bg-gray-800/50 transition-colors">
                <div className="flex items-start gap-3">
                  <SourceIcon type={item.source_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-white font-medium line-clamp-2 leading-snug">{item.headline}</p>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400 flex-shrink-0">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-medium text-claw-400">{item.ticker_symbol}</span>
                      {item.security_name && (
                        <span className="text-xs text-gray-500 truncate max-w-32">{item.security_name}</span>
                      )}
                      <span className="text-gray-700">·</span>
                      <span className="text-xs text-gray-500">{item.source}</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-xs text-gray-500">{item.published_at ? timeSince(item.published_at) : "—"}</span>
                      {item.sentiment_score !== undefined && item.sentiment_score !== null && (
                        <>
                          <span className="text-gray-700">·</span>
                          <SentimentBadge score={item.sentiment_score} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
