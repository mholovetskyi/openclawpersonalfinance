# ClawFinance — Personal Finance Intelligence on OpenClaw

<p align="center">
  <strong>Your local-first, AI-powered personal finance system — built on OpenClaw.</strong><br>
  Budget tracking · Portfolio analysis · Tax estimation · Market research · Automated insights
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Production_Ready-14b8a6?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Stack-TypeScript_%2B_React-blue?style=for-the-badge" alt="Stack">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License">
</p>

---

## What is ClawFinance?

ClawFinance is a complete personal finance intelligence system that runs **entirely on your own machine**. It connects to your real bank accounts, investment portfolios, and tax documents — then uses AI agents (powered by OpenClaw) to:

- **Track spending** against budgets, detect unusual charges, find savings opportunities
- **Monitor portfolio** — performance, allocation drift, tax-loss harvesting candidates
- **Estimate taxes** — federal liability, quarterly payments, document extraction via OCR
- **Research companies** in your portfolio — SEC filings, insider activity, sentiment, alt data
- **Generate weekly summaries** and proactive alerts, delivered automatically via chat

**Everything runs locally. No cloud sync. No third-party data sharing. Just your data, your AI.**

---

## Architecture Overview

```
openclawpersonalfinance/
├── clawfinance/                 ← The finance application
│   ├── api/                     ← Express.js REST API (TypeScript, port 3001)
│   ├── ui/                      ← React + Vite + Tailwind dashboard (port 5173)
│   ├── db/migrations/           ← PostgreSQL schema (9 migration files)
│   ├── mcp-servers/             ← 7 MCP data source connectors
│   │   ├── mcp-plaid/           ← Bank accounts & transactions (Plaid API)
│   │   ├── mcp-snaptrade/       ← Investment portfolios (SnapTrade)
│   │   ├── mcp-finnhub/         ← Market data, news, earnings (Finnhub)
│   │   ├── mcp-sec/             ← SEC EDGAR filings (free, no key required)
│   │   ├── mcp-azure-doc-intel/ ← Tax document OCR (Azure)
│   │   ├── mcp-twitter/         ← Sentiment analysis (Twitter/X API)
│   │   └── mcp-altdata/         ← Google Trends, job postings (SerpAPI)
│   └── scripts/                 ← Setup, validation, and data sync scripts
├── skills/                      ← OpenClaw agent skills
│   ├── skill-finance-orchestrator/ ← Routes user requests to the right agent
│   ├── skill-data-ingestion/    ← Plaid/portfolio/news sync
│   ├── skill-budget/            ← Spending analysis & budget management
│   ├── skill-investment/        ← Portfolio analysis & tax-loss harvesting
│   ├── skill-tax/               ← Tax estimation & document processing
│   └── skill-research/          ← Company research & sentiment
├── .openclaw.json               ← OpenClaw workspace config (MCP + cron)
└── README.md                    ← You are here
```

**Services and ports:**
| Service | Port | Description |
|---|---|---|
| UI (Vite dev) | 5173 | React dashboard |
| API | 3001 | Express REST + WebSocket |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache + pub/sub |

---

## Prerequisites

Before starting, install:

| Tool | Minimum | Recommended | Install |
|---|---|---|---|
| **Node.js** | v18 | v22 LTS | [nodejs.org](https://nodejs.org) |
| **Docker Desktop** | 24+ | latest | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| **Git** | any | any | [git-scm.com](https://git-scm.com) |

> **Windows users:** Use Git Bash or WSL2 for the shell commands in this guide.

---

## Quick Start (5 minutes)

### Step 1 — Clone the repo

```bash
git clone https://github.com/mholovetskyi/openclawpersonalfinance.git
cd openclawpersonalfinance
```

### Step 2 — Create your environment file

```bash
cp clawfinance/.env.example clawfinance/.env
```

Then open `clawfinance/.env` in your editor and set **at minimum**:

```env
DB_PASSWORD=pick_a_strong_password_here
DB_ENCRYPTION_KEY=pick_a_32_char_random_string_here
CLAWFINANCE_API_KEY=pick_any_local_secret_here
ANTHROPIC_API_KEY=sk-ant-...   # Required for AI agents
```

> Generate random values: `openssl rand -base64 32`

### Step 3 — Run the automated setup

```bash
bash clawfinance/scripts/setup.sh
```

This script:
- Checks Docker and Node are installed
- Validates your `.env` file
- Installs all npm dependencies
- Starts Docker services (Postgres, Redis, API, UI)
- Waits for the API to become healthy

### Step 4 — Open the dashboard

Visit **http://localhost:5173**

Go to **Settings** in the left sidebar to configure integrations.

---

## Manual Setup (step by step)

If you prefer to set things up manually:

### Start database services

```bash
cd clawfinance
docker-compose up -d postgres redis
```

Wait for Postgres to be ready:
```bash
docker-compose exec postgres pg_isready -U clawfinance
```

### Start the API

```bash
cd clawfinance/api
npm install
npm run dev   # Starts on http://localhost:3001
```

Check it's healthy:
```bash
curl http://localhost:3001/health
# {"status":"ok","service":"clawfinance-api"}
```

### Start the UI

```bash
cd clawfinance/ui
npm install
npm run dev   # Starts on http://localhost:5173
```

### Verify everything

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "clawfinance-api",
  "db": "ok",
  "redis": "ok",
  "integrations": { "anthropic": { "configured": true, "label": "Connected" }, ... },
  "uptime": 42
}
```

---

## Running with Docker Compose (all services)

```bash
cd clawfinance
docker-compose up -d --build
```

This builds and starts all 4 containers: postgres, redis, api, ui.

The UI container uses nginx and proxies `/api/` and `/ws` to the API container automatically.

Useful commands:
```bash
docker-compose logs -f api      # API logs
docker-compose logs -f ui       # UI/nginx logs
docker-compose ps               # Service status
docker-compose down             # Stop everything
docker-compose down -v          # Stop + delete database data (DESTRUCTIVE)
```

---

## Integration Setup

ClawFinance works out of the box with no integrations — but to sync real data you'll need API keys. Open **http://localhost:5173/settings** to configure them interactively.

Alternatively, edit `clawfinance/.env` directly and restart the API.

### Anthropic Claude (Required for AI)

All AI features — the chat panel, automated insights, and agent skills — require an Anthropic API key.

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and navigate to **API Keys**
3. Click **Create Key** and copy the value
4. Add to `.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

### Plaid — Bank Accounts & Transactions

Plaid connects checking, savings, and credit card accounts.

1. Sign up at [dashboard.plaid.com](https://dashboard.plaid.com/signup)
2. Create a new app — choose **Sandbox** for testing (free, uses fake data)
3. From **Keys** tab, copy your **Client ID** and **Sandbox Secret**
4. Add to `.env`:
   ```env
   PLAID_CLIENT_ID=your_client_id
   PLAID_SECRET=your_sandbox_secret
   PLAID_ENV=sandbox
   ```
5. Upgrade to `development` or `production` when ready to use real accounts (requires Plaid approval)
6. Run the Plaid link script to connect your first account:
   ```bash
   bash clawfinance/scripts/link_plaid_account.sh
   ```

**Plaid environments:**
| Value | Data | Cost |
|---|---|---|
| `sandbox` | Fake test data (default) | Free |
| `development` | Real accounts, up to 100 items | Free |
| `production` | Real accounts, unlimited | Paid per item |

### SnapTrade — Investment Accounts

SnapTrade aggregates brokerage accounts: Fidelity, Schwab, TD Ameritrade, Robinhood, and 50+ more.

1. Sign up at [app.snaptrade.com](https://app.snaptrade.com/signup)
2. Navigate to **Developer** → **API Keys**
3. Copy your **Client ID** and **Consumer Key**
4. Add to `.env`:
   ```env
   SNAPTRADE_CLIENT_ID=your_client_id
   SNAPTRADE_CONSUMER_KEY=your_consumer_key
   ```

### Finnhub — Market Data & News

Finnhub provides real-time quotes, company news, earnings calendars, and financial statements.

1. Register at [finnhub.io/register](https://finnhub.io/register)
2. The **free tier** allows 60 API calls/minute — enough for personal use
3. Copy your **API Key** from the dashboard
4. Add to `.env`:
   ```env
   FINNHUB_API_KEY=your_api_key
   ```

### SEC EDGAR — No Key Required

The SEC EDGAR API is completely free and public. The `mcp-sec` server works immediately with no configuration. It provides:
- 10-K and 10-Q filings
- Insider transactions (Form 4)
- XBRL financial facts

### Azure Document Intelligence — Tax OCR

Extracts structured data from W-2, 1099, K-1, and 1098 tax documents.

1. Sign in to [portal.azure.com](https://portal.azure.com)
2. Search for **Document Intelligence** and create a resource
   - Resource group: create new (e.g., `clawfinance-rg`)
   - Region: any (East US recommended for latency)
   - Pricing tier: **Free (F0)** for up to 500 pages/month
3. After deployment, go to **Keys and Endpoint**
4. Copy **Endpoint** and **Key 1**
5. Add to `.env`:
   ```env
   AZURE_DOC_INTEL_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
   AZURE_DOC_INTEL_KEY=your_key_1
   ```

### TaxBandits — Tax Filing

Enables programmatic tax form retrieval and e-filing status.

1. Sign up at [taxbandits.com](https://www.taxbandits.com/signup/)
2. Generate a sandbox API key from the developer portal
3. Add to `.env`:
   ```env
   TAXBANDITS_API_KEY=your_api_key
   ```

### Twitter / X API — Sentiment Analysis

Provides social sentiment scoring for stocks in your portfolio.

1. Apply at [developer.twitter.com](https://developer.twitter.com/en/portal/projects-and-apps)
2. Create a project and app with **Read** access
3. Under **Keys and Tokens**, generate:
   - **API Key & Secret** (Consumer Keys)
   - **Access Token & Secret** (with Read permissions)
4. Add to `.env`:
   ```env
   TWITTER_API_KEY=your_api_key
   TWITTER_API_SECRET=your_api_secret
   TWITTER_ACCESS_TOKEN=your_access_token
   TWITTER_ACCESS_SECRET=your_access_secret
   ```

**Note:** The free Twitter API tier (v2 Basic) allows 500K tweets/month, sufficient for personal portfolio monitoring.

### SerpAPI — Alternative Data

Google Trends, App Store rankings, and job posting velocity for alternative investment signals.

1. Sign up at [serpapi.com](https://serpapi.com/users/sign_up)
2. The **free plan** gives 100 searches/month
3. Copy your **API Key** from the dashboard
4. Add to `.env`:
   ```env
   SERPAPI_KEY=your_api_key
   ```

---

## Building MCP Servers

The MCP servers need to be compiled before OpenClaw can use them:

```bash
# Build all MCP servers at once
for dir in clawfinance/mcp-servers/*/; do
  echo "Building $dir..."
  (cd "$dir" && npm install && npm run build)
done
```

Or build individually:
```bash
cd clawfinance/mcp-servers/mcp-plaid && npm install && npm run build
cd clawfinance/mcp-servers/mcp-finnhub && npm install && npm run build
# etc.
```

---

## Starting OpenClaw Agents

```bash
# From the repo root
openclaw start
```

OpenClaw reads `.openclaw.json` to load MCP servers and skills. You can interact with the agents via:
- The built-in **chat panel** at http://localhost:5173 (bottom-right button)
- Any messaging channel you've configured in OpenClaw (WhatsApp, Telegram, Slack, etc.)

### Trigger a manual sync

```
# In the chat panel or any OpenClaw channel:
sync my transactions
check my portfolio
run weekly summary
analyze my spending this month
```

### Cron jobs (automatic)

These run automatically once OpenClaw is started:

| Job | Schedule | Action |
|---|---|---|
| `bank-sync` | Every 6 hours | Plaid transaction sync + categorization |
| `portfolio-sync` | Every 4 hours | Holdings prices & performance |
| `budget-check` | Daily at 9am | Budget vs. spend check, post alerts |
| `portfolio-insights` | Weekdays 8am | Allocation drift, performance analysis |
| `research-sweep` | Weekdays 7am | SEC filings, insider activity, sentiment |
| `news-sync` | Every 8 hours | Company news for your holdings |
| `tax-estimate-refresh` | 1st of each month | Refresh federal tax liability estimate |
| `weekly-summary` | Mondays at 8am | Full financial review |

---

## API Reference

All API endpoints require the `X-API-Key` header matching `CLAWFINANCE_API_KEY`.

**Base URL:** `http://localhost:3001`

### Health & Status
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Simple health check (no auth) |
| `GET` | `/api/health` | Detailed health + integration status |

### Accounts
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/accounts` | All linked accounts |

### Transactions
| Method | Path | Query params | Description |
|---|---|---|---|
| `GET` | `/api/transactions` | `start`, `end`, `category`, `account_id`, `limit` | List transactions |
| `GET` | `/api/transactions/summary` | `month=YYYY-MM` | Monthly spend by category |

### Budgets
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/budgets` | All budgets with current spend |
| `POST` | `/api/budgets` | Create a budget |
| `PUT` | `/api/budgets/:id` | Update a budget |
| `DELETE` | `/api/budgets/:id` | Delete a budget |

### Net Worth
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/networth` | Current net worth + 12-month history |

### Portfolio
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/portfolio` | Portfolio summary (total value, G/L, by asset type) |
| `GET` | `/api/portfolio/holdings` | All positions with per-share details |

### Tax
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/tax/estimate` | Federal tax liability estimate |
| `GET` | `/api/tax/documents` | Uploaded tax documents |
| `POST` | `/api/tax/documents/upload` | Upload a document for OCR |
| `GET` | `/api/tax/deductions` | Tracked deductions |

### Research
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/research/:ticker` | Company research (news, filings, sentiment) |
| `GET` | `/api/research/portfolio-news` | News feed for all holdings |

### Insights
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/insights` | Active insights (filter: `?status=new`) |
| `PATCH` | `/api/insights/:id` | Mark as `viewed`, `dismissed`, or `acted_on` |

### Chat
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a message to the AI assistant |

**Example:**
```bash
curl -H "X-API-Key: your_api_key" http://localhost:3001/api/accounts
```

---

## Database Schema

ClawFinance uses 9 PostgreSQL tables:

| Table | Description |
|---|---|
| `accounts` | Linked bank, investment, and credit accounts |
| `transactions` | All financial transactions with categories |
| `budgets` | Monthly spending budgets per category |
| `holdings` | Investment positions (ticker, quantity, cost basis, market value) |
| `tax_documents` | Uploaded tax documents with extracted fields |
| `insights` | AI-generated insights and alerts |
| `company_intelligence` | Company research cache (news, filings, sentiment) |
| `net_worth_snapshots` | Daily net worth history |
| `agent_state` | OpenClaw agent persistent state |

Migrations are applied automatically by PostgreSQL on first start (via `/docker-entrypoint-initdb.d`).

---

## Development Guide

### Project structure

```
clawfinance/api/src/
├── index.ts           ← Express app entry, route mounts
├── middleware/
│   └── auth.ts        ← X-API-Key header check
├── routes/
│   ├── accounts.ts    ← GET /api/accounts
│   ├── transactions.ts ← GET /api/transactions
│   ├── budgets.ts     ← CRUD /api/budgets
│   ├── portfolio.ts   ← GET /api/portfolio + /holdings
│   ├── tax.ts         ← GET /api/tax/*
│   ├── research.ts    ← GET /api/research/*
│   ├── insights.ts    ← GET/PATCH /api/insights
│   ├── networth.ts    ← GET /api/networth
│   ├── chat.ts        ← POST /api/chat
│   └── health.ts      ← GET /api/health (detailed)
└── services/
    ├── db.ts          ← pg Pool
    └── websocket.ts   ← WS broadcast helper

clawfinance/ui/src/
├── App.tsx            ← Routes + layout
├── components/layout/
│   ├── Sidebar.tsx    ← Nav links
│   ├── Header.tsx     ← Page title + status
│   └── ChatPanel.tsx  ← Floating AI chat
├── pages/
│   ├── NetWorthDashboard.tsx
│   ├── PortfolioView.tsx
│   ├── TransactionsBudget.tsx
│   ├── TaxCenter.tsx
│   ├── ResearchNews.tsx
│   └── Settings.tsx   ← API key management
└── lib/
    ├── api.ts         ← fetch wrapper
    └── websocket.ts   ← WS client
```

### Adding a new API route

1. Create `clawfinance/api/src/routes/my-route.ts`
2. Import and mount in `index.ts`: `app.use("/api/my-route", myRouter)`
3. The route is automatically covered by `localAuth` middleware

### Adding a new UI page

1. Create `clawfinance/ui/src/pages/MyPage.tsx`
2. Add a `Route` in `App.tsx`
3. Add a nav link in `Sidebar.tsx` (and title in `Header.tsx`)

### TypeScript compilation

```bash
# API
cd clawfinance/api && npx tsc --noEmit   # Type check only
cd clawfinance/api && npm run build       # Compile to dist/

# MCP servers
cd clawfinance/mcp-servers/mcp-plaid && npm run build
```

---

## Troubleshooting

### API won't start — "DATABASE_URL is required"
Make sure `clawfinance/.env` exists and `DB_PASSWORD` is set. Run:
```bash
bash clawfinance/scripts/validate-env.sh
```

### Postgres container exits immediately
Check if port 5432 is already in use (another Postgres running):
```bash
docker-compose logs postgres
lsof -i :5432   # or netstat -an | grep 5432
```

### UI shows unstyled/broken layout
Tailwind requires `postcss.config.js`. Make sure it exists:
```bash
ls clawfinance/ui/postcss.config.js   # Should exist
```
If missing: `echo 'export default { plugins: { tailwindcss: {}, autoprefixer: {} } }' > clawfinance/ui/postcss.config.js`

### "X-API-Key" error in browser
The dev server (Vite) proxies API calls. Check `clawfinance/ui/vite.config.ts` has:
```ts
proxy: { "/api": "http://localhost:3001" }
```
Also ensure `CLAWFINANCE_API_KEY` in `.env` matches `VITE_API_KEY` in `.env` (or leave blank for open local dev).

### MCP server not found by OpenClaw
Build the MCP server first (`npm run build`), then check `.openclaw.json` references the compiled `dist/index.js` path.

### Chat panel not responding
The chat requires `ANTHROPIC_API_KEY` in `.env`. Verify with:
```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/health | jq .integrations.anthropic
```

---

## Security Notes

- **Never commit `.env`** — it's in `.gitignore`
- All API routes (except `/health`) require the `X-API-Key` header
- Sensitive fields in the database are encrypted with `DB_ENCRYPTION_KEY`
- The UI runs behind nginx in Docker, which strips request headers before upstream
- No data is ever sent outside your local network (all AI calls go directly to Anthropic's API from your machine)

---

## Features by Phase

### Phase 1 — Foundation
- PostgreSQL database with 9 core tables, Redis, Docker Compose
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
