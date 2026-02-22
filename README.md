# ClawFinance — Personal Finance Intelligence on OpenClaw

<p align="center">
  <img src="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.png" alt="OpenClaw" width="400">
</p>

<p align="center">
  <strong>Your local-first, AI-powered personal finance system — built on OpenClaw.</strong><br>
  Budget tracking · Portfolio analysis · Tax estimation · Market research · Automated insights
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Production_Ready-emerald?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Stack-TypeScript_%2B_Python_%2B_React-blue?style=for-the-badge" alt="Stack">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License">
</p>

---

## What is ClawFinance?

ClawFinance is a complete personal finance intelligence system that runs **entirely on your own machine**. It connects to your real bank accounts, investment portfolios, and tax documents — then uses AI agents (powered by OpenClaw) to:

- **Track your spending** against budgets, detect unusual charges, find savings opportunities
- **Monitor your portfolio** — performance, allocation drift, tax-loss harvesting candidates
- **Estimate your taxes** — federal liability, quarterly payments, document extraction via OCR
- **Research companies** in your portfolio — SEC filings, insider activity, Twitter sentiment, alt data
- **Generate weekly summaries** and proactive alerts, delivered automatically

Everything runs locally. No cloud sync. No third-party data sharing. Just your data, your AI.

---

## Architecture Overview

```
openclawpersonalfinance/
├── clawfinance/               ← The finance app
│   ├── api/                   ← Express.js REST API (TypeScript, port 3001)
│   ├── ui/                    ← React + Vite + Tailwind dashboard (port 5173)
│   ├── db/migrations/         ← 17 PostgreSQL migrations
│   └── mcp-servers/           ← 7 MCP data source servers
│       ├── mcp-plaid/         ← Bank accounts & transactions
│       ├── mcp-snaptrade/     ← Investment portfolios
│       ├── mcp-finnhub/       ← Market data & news
│       ├── mcp-sec/           ← SEC EDGAR filings (no key required)
│       ├── mcp-azure-doc-intel/ ← Tax document OCR (W-2, 1099, etc.)
│       ├── mcp-twitter/       ← Sentiment analysis
│       └── mcp-altdata/       ← Google Trends, app rankings, job postings
├── skills/                    ← OpenClaw agent skills
│   ├── skill-finance-orchestrator/ ← Lead orchestrator
│   ├── skill-data-ingestion/  ← Plaid/portfolio/news sync
│   ├── skill-budget/          ← Spending analysis & budgets
│   ├── skill-investment/      ← Portfolio analysis & tax-loss harvesting
│   ├── skill-tax/             ← Tax estimation & document processing
│   └── skill-research/        ← Company research & sentiment
├── .openclaw.json             ← OpenClaw workspace config (MCP servers + cron)
└── [OpenClaw source files]    ← OpenClaw core framework
```

---

## Quick Start

### Prerequisites

- **Node ≥ 22** and **Docker** (for Postgres + Redis)
- **Python 3.11+** (for deterministic calculation scripts)
- **OpenClaw** installed: `npm install -g openclaw@latest`

### 1. Clone & Set Up

```bash
git clone https://github.com/mholovetskyi/openclawpersonalfinance.git
cd openclawpersonalfinance

# Copy environment template
cp clawfinance/.env.example clawfinance/.env
# Edit clawfinance/.env and fill in your API keys
```

### 2. Start Services

```bash
cd clawfinance
docker-compose up -d         # Starts Postgres, Redis, API, UI
```

Or run locally without Docker:

```bash
cd clawfinance/api && npm install && npm run dev   # API on :3001
cd clawfinance/ui && npm install && npm run dev    # UI on :5173
```

### 3. Build MCP Servers

```bash
for dir in clawfinance/mcp-servers/*/; do
  (cd "$dir" && npm install && npm run build)
done
```

### 4. Start OpenClaw

```bash
openclaw start    # Loads .openclaw.json from repo root
```

Open **http://localhost:5173** to see the dashboard.

---

## Features by Phase

### Phase 1 — Foundation
- Postgres database with 9 core tables, Redis caching, Docker Compose
- Express REST API with WebSocket live updates
- React dashboard with Tailwind dark theme and Recharts visualizations
- Plaid MCP server for bank/card/investment account linking

### Phase 2 — Budget & Spending
- Transaction categorization (keyword + Plaid category inference)
- Budget CRUD with monthly spend tracking
- 6-month stacked bar chart, recurring charges detection
- `check_budgets.py` with statistical anomaly detection

### Phase 3 — Portfolio & Investments
- SnapTrade MCP for investment account aggregation
- Portfolio summary: total value, unrealized G/L, allocation by asset type
- Holdings table with per-position performance
- `calc_performance.py`, `calc_allocation.py`, `find_tax_loss_harvest.py`

### Phase 4 — Tax Intelligence
- Azure Document Intelligence for W-2, 1099-DIV/INT/B, K-1, 1098 extraction
- Federal tax estimator with 2026 brackets, LTCG rates, NIIT, standard deductions
- Quarterly payment schedule, withholding check
- Deductions tracker

### Phase 5 — Research & Alt Data
- Finnhub: real-time quotes, news, earnings calendar, financial statements
- SEC EDGAR: 10-K/10-Q filings, insider transactions (Form 4), XBRL financial facts
- Twitter API v2: sentiment scoring (bull/bear ratio by engagement)
- SerpAPI: Google Trends, App Store rankings, job posting velocity
- Sentiment history charts and portfolio news feed

### Phase 6 — Orchestration & Polish
- **Floating chat panel** with AI routing to appropriate skill
- Proactive insight engine: high-spend alerts, insider sell alerts, sentiment shifts
- 8-job cron schedule: bank sync, portfolio sync, budget check, research sweep, tax refresh, weekly summary
- Enhanced net worth dashboard with area chart, account cards, asset breakdown pie

---

## Environment Variables

Copy `clawfinance/.env.example` to `clawfinance/.env` and configure:

| Variable | Source | Required |
|---|---|---|
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | [plaid.com/docs](https://plaid.com/docs/) | For bank sync |
| `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY` | [snaptrade.com](https://snaptrade.com) | For investments |
| `FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io) | For market data |
| `AZURE_DOC_INTEL_ENDPOINT` / `AZURE_DOC_INTEL_KEY` | [Azure Portal](https://portal.azure.com) | For tax OCR |
| `TWITTER_API_KEY` / `TWITTER_API_SECRET` / `TWITTER_ACCESS_TOKEN` / `TWITTER_ACCESS_SECRET` | [developer.twitter.com](https://developer.twitter.com) | For sentiment |
| `SERPAPI_KEY` | [serpapi.com](https://serpapi.com) | For alt data |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | For AI agents |
| `CLAWFINANCE_API_KEY` | Set any local secret | Always |

> SEC EDGAR is a **free public API** — no key required.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/accounts` | All linked accounts |
| `GET` | `/api/transactions` | Transactions (filters: start, end, category, account_id) |
| `GET` | `/api/transactions/summary?month=YYYY-MM` | Monthly spend by category |
| `GET/POST/PUT/DELETE` | `/api/budgets` | Budget CRUD |
| `GET` | `/api/networth` | Current net worth + history |
| `GET` | `/api/insights` | Active/all insights |
| `PATCH` | `/api/insights/:id` | Mark viewed/dismissed |
| `GET` | `/api/portfolio` | Portfolio summary |
| `GET` | `/api/portfolio/holdings` | All positions |
| `GET` | `/api/tax/estimate` | Tax liability estimate |
| `POST` | `/api/tax/documents/upload` | Upload tax document for OCR |
| `GET` | `/api/research/:ticker` | Company research data |
| `GET` | `/api/research/portfolio-news` | News for all holdings |
| `POST` | `/api/chat` | Chat with AI assistant |

---

## Cron Schedule

Configured in `.openclaw.json`, automatically run by OpenClaw:

| Job | Schedule | Task |
|---|---|---|
| `bank-sync` | Every 6 hours | Plaid transaction sync + categorization |
| `portfolio-sync` | Every 4 hours | Portfolio holdings & prices |
| `budget-check` | Daily 9am | Budget vs. spend check, post alerts |
| `portfolio-insights` | Weekdays 8am | Allocation drift, performance analysis |
| `research-sweep` | Weekdays 7am | SEC filings, insider activity, sentiment |
| `news-sync` | Every 8 hours | Company news for holdings |
| `tax-estimate-refresh` | 1st of month | Refresh tax liability estimate |
| `weekly-summary` | Mondays 8am | Full financial review summary |

---

---

# OpenClaw — Personal AI Assistant

The rest of this README covers **OpenClaw** — the AI assistant framework that ClawFinance is built on.

<p align="center">
  <a href="https://github.com/openclaw/openclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/openclaw/openclaw/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/openclaw/openclaw/releases"><img src="https://img.shields.io/github/v/release/openclaw/openclaw?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**OpenClaw** is a _personal AI assistant_ you run on your own devices. It answers you on the channels you already use (WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, Microsoft Teams, WebChat), plus extension channels like BlueBubbles, Matrix, Zalo, and Zalo Personal.

[Website](https://openclaw.ai) · [Docs](https://docs.openclaw.ai) · [Getting Started](https://docs.openclaw.ai/start/getting-started) · [Discord](https://discord.gg/clawd)

## OpenClaw Install

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

## OpenClaw Highlights

- **[Local-first Gateway](https://docs.openclaw.ai/gateway)** — single control plane for sessions, channels, tools, and events
- **[Multi-channel inbox](https://docs.openclaw.ai/channels)** — WhatsApp, Telegram, Slack, Discord, iMessage, Signal, Teams, Matrix, and more
- **[Skills platform](https://docs.openclaw.ai/tools/skills)** — extend with workspace skills (like ClawFinance's 6 skills)
- **[Cron + webhooks](https://docs.openclaw.ai/automation/cron-jobs)** — scheduled tasks and event-driven automation
- **[MCP servers](https://docs.openclaw.ai/tools)** — plug in any Model Context Protocol data source
- **[Voice Wake + Talk Mode](https://docs.openclaw.ai/nodes/voicewake)** — always-on speech on macOS/iOS/Android
- **[Live Canvas](https://docs.openclaw.ai/platforms/mac/canvas)** — agent-driven visual workspace

## From Source

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm build
pnpm openclaw onboard --install-daemon
```

## Security

OpenClaw connects to real messaging surfaces. DMs use pairing by default — unknown senders receive a pairing code. Full security guide: [Security](https://docs.openclaw.ai/gateway/security).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=openclaw/openclaw&type=date&legend=top-left)](https://www.star-history.com/#openclaw/openclaw&type=date&legend=top-left)
