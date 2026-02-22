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

## Table of Contents

- [What is ClawFinance?](#what-is-clawfinance)
- [Non-Technical Setup Guide](#non-technical-setup-guide)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start (5 minutes)](#quick-start-5-minutes)
- [Manual Setup](#manual-setup-step-by-step)
- [Running with Docker Compose](#running-with-docker-compose-all-services)
- [Integration Setup (API Keys)](#integration-setup)
- [API Reference](#api-reference)
- [Adding a New API Integration](#adding-a-new-api-integration)
- [Adding a New MCP Server](#adding-a-new-mcp-server)
- [Database Schema](#database-schema)
- [Development Guide](#development-guide)
- [Cron Jobs & Automation](#cron-jobs--automation)
- [OpenClaw Skills](#openclaw-skills)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)
- [Features by Phase](#features-by-phase)
- [OpenClaw Framework](#openclaw--personal-ai-assistant)

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

## Non-Technical Setup Guide

> **Not a developer? Start here.** This section walks you through setup with no assumed knowledge.

### What you're setting up

ClawFinance is software that runs on your computer (not in a browser tab). Think of it like installing a program, except this one is an AI assistant that can see all your finances and answer questions about them.

You'll install a few free tools, run a few commands, and then use it through a regular website at `http://localhost:5173`.

### Step 1 — Install the required tools

You need three things installed. Click each link, download the installer for your operating system, and run it:

**1. Node.js** (the engine that runs the app)
- Go to: https://nodejs.org
- Download the **LTS** version (the left button)
- Run the installer, keep all defaults

**2. Docker Desktop** (runs the database)
- Go to: https://docs.docker.com/get-docker/
- Download for your OS (Mac, Windows, or Linux)
- Install it, then **open Docker Desktop** and let it finish starting up (it shows a whale icon in your taskbar/menu bar when ready)

**3. Git** (downloads the code)
- Go to: https://git-scm.com/downloads
- Download and install for your OS

> **Windows users:** After installing Git, open **Git Bash** (search for it in your Start menu) and use that for all the commands below.

### Step 2 — Download ClawFinance

Open a terminal (Git Bash on Windows, Terminal on Mac/Linux) and type:

```bash
git clone https://github.com/mholovetskyi/openclawpersonalfinance.git
cd openclawpersonalfinance
```

### Step 3 — Create your personal settings file

```bash
cp .env.example clawfinance/.env
```

Now open the file `clawfinance/.env` in any text editor (Notepad works fine). Find these four lines and fill them in:

```
DB_PASSWORD=          ← Type any password you make up (e.g. MyStrongPass123!)
DB_ENCRYPTION_KEY=    ← Type any 32-character random string
CLAWFINANCE_API_KEY=  ← Type any secret you make up (e.g. myprivatekey123)
ANTHROPIC_API_KEY=    ← Your Claude AI key (see below)
```

**Getting an Anthropic API key (required for AI features):**
1. Go to https://console.anthropic.com and create a free account
2. Click **API Keys** in the left menu
3. Click **Create Key**, give it a name, and copy the key that starts with `sk-ant-`
4. Paste it next to `ANTHROPIC_API_KEY=` in your `.env` file

Save and close the file.

### Step 4 — Run setup

```bash
bash clawfinance/scripts/setup.sh
```

This may take 2–5 minutes the first time (it's downloading software). When it says **"ClawFinance is ready!"**, you're done.

### Step 5 — Open the app

Visit **http://localhost:5173** in any browser.

You'll see the ClawFinance dashboard. Click **Settings** in the left sidebar to connect your bank account, investment accounts, or other services.

### Daily use

Once set up, ClawFinance runs in the background. To start it again after rebooting:

```bash
cd openclawpersonalfinance
bash clawfinance/scripts/setup.sh
```

Or if you prefer, just start Docker Compose manually:

```bash
cd openclawpersonalfinance/clawfinance
docker-compose up -d
```

Then visit http://localhost:5173.

### Getting help from the AI

Click the **chat button** (bottom-right corner of the app) and ask anything:

- *"How much did I spend on restaurants last month?"*
- *"Am I on track with my grocery budget?"*
- *"What's the performance of my portfolio this year?"*
- *"Do I owe estimated taxes this quarter?"*

---

## Architecture Overview

```
openclawpersonalfinance/
├── clawfinance/                 ← The finance application
│   ├── api/                     ← Express.js REST API (TypeScript, port 3001)
│   ├── ui/                      ← React + Vite + Tailwind dashboard (port 5173)
│   ├── db/migrations/           ← PostgreSQL schema (migration files)
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

**How the pieces connect:**

```
Browser (port 5173)
    │
    ▼
React UI (Vite / nginx)
    │ REST + WebSocket
    ▼
Express API (port 3001)
    ├── PostgreSQL (port 5432) — stores all your financial data
    ├── Redis (port 6379) — caching & real-time pub/sub
    └── Anthropic API — AI responses for chat & insights

OpenClaw (background daemon)
    ├── Reads .openclaw.json for MCP servers and skills
    ├── Runs cron jobs (bank sync, portfolio sync, etc.)
    └── Talks to the API via HTTP to store results
```

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
cp .env.example clawfinance/.env
```

Then open `clawfinance/.env` in your editor and set **at minimum**:

```env
DB_PASSWORD=pick_a_strong_password_here
DB_ENCRYPTION_KEY=pick_a_32_char_random_string_here
CLAWFINANCE_API_KEY=pick_any_local_secret_here
ANTHROPIC_API_KEY=sk-ant-...   # Required for AI agents
```

> Generate random values with: `openssl rand -base64 32`

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

If you prefer to set things up manually or are troubleshooting:

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
  "version": "1.0.0",
  "db": "ok",
  "redis": "ok",
  "integrations": {
    "anthropic": { "configured": true, "label": "Connected" },
    "plaid": { "configured": false, "label": "Not configured" },
    "snaptrade": { "configured": false, "label": "Not configured" },
    "finnhub": { "configured": false, "label": "Not configured" },
    "azure_doc_intel": { "configured": false, "label": "Not configured" },
    "taxbandits": { "configured": false, "label": "Not configured" },
    "twitter": { "configured": false, "label": "Not configured" },
    "serpapi": { "configured": false, "label": "Not configured" }
  },
  "uptime": 42,
  "timestamp": "2026-02-22T10:00:00.000Z"
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

Alternatively, edit `clawfinance/.env` directly and restart the API (`docker-compose restart api`).

### Anthropic Claude (Required for AI)

All AI features — the chat panel, automated insights, and agent skills — require an Anthropic API key.

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and navigate to **API Keys**
3. Click **Create Key** and copy the value
4. Add to `.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

**Cost:** Usage-based. Personal finance queries typically cost cents per month.

---

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

---

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

---

### Finnhub — Market Data & News

Finnhub provides real-time quotes, company news, earnings calendars, and financial statements.

1. Register at [finnhub.io/register](https://finnhub.io/register)
2. The **free tier** allows 60 API calls/minute — enough for personal use
3. Copy your **API Key** from the dashboard
4. Add to `.env`:
   ```env
   FINNHUB_API_KEY=your_api_key
   ```

---

### SEC EDGAR — No Key Required

The SEC EDGAR API is completely free and public. The `mcp-sec` server works immediately with no configuration. It provides:
- 10-K and 10-Q filings
- Insider transactions (Form 4)
- XBRL financial facts

---

### Azure Document Intelligence — Tax OCR

Extracts structured data from W-2, 1099, K-1, and 1098 tax documents.

1. Sign in to [portal.azure.com](https://portal.azure.com)
2. Search for **Document Intelligence** and create a resource
   - Resource group: create new (e.g., `clawfinance-rg`)
   - Region: any (East US recommended for latency)
   - Pricing tier: **Free (F0)** — up to 500 pages/month
3. After deployment, go to **Keys and Endpoint**
4. Copy **Endpoint** and **Key 1**
5. Add to `.env`:
   ```env
   AZURE_DOC_INTEL_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
   AZURE_DOC_INTEL_KEY=your_key_1
   ```

---

### TaxBandits — Tax Filing

Enables programmatic tax form retrieval and e-filing status.

1. Sign up at [taxbandits.com](https://www.taxbandits.com/signup/)
2. Generate a sandbox API key from the developer portal
3. Add to `.env`:
   ```env
   TAXBANDITS_API_KEY=your_api_key
   ```

---

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

> The free Twitter API tier (v2 Basic) allows 500K tweets/month — sufficient for personal portfolio monitoring.

---

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

## API Reference

All API endpoints (except `/health`) require the `X-API-Key` header matching your `CLAWFINANCE_API_KEY`.

**Base URL:** `http://localhost:3001`

**Authentication header:**
```
X-API-Key: your_clawfinance_api_key
```

**Example request:**
```bash
curl -H "X-API-Key: your_api_key" http://localhost:3001/api/accounts
```

---

### Health & Status

#### `GET /health`

Simple liveness check. **No authentication required.**

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "service": "clawfinance-api"
}
```

---

#### `GET /api/health`

Detailed system health including database, Redis, and integration status. **No authentication required.**

```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "healthy",
  "service": "clawfinance-api",
  "version": "1.0.0",
  "db": "ok",
  "redis": "ok",
  "integrations": {
    "anthropic": { "configured": true, "label": "Connected" },
    "plaid": { "configured": true, "label": "sandbox env" },
    "snaptrade": { "configured": false, "label": "Not configured" },
    "finnhub": { "configured": true, "label": "Connected" },
    "azure_doc_intel": { "configured": false, "label": "Not configured" },
    "taxbandits": { "configured": false, "label": "Not configured" },
    "twitter": { "configured": false, "label": "Not configured" },
    "serpapi": { "configured": false, "label": "Not configured" }
  },
  "uptime": 3600,
  "timestamp": "2026-02-22T10:00:00.000Z"
}
```

`status` is `"healthy"` when both DB and Redis are reachable, `"degraded"` otherwise.

---

### Accounts

#### `GET /api/accounts`

Returns all linked financial accounts.

```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/accounts
```

Response:
```json
[
  {
    "id": "uuid",
    "name": "Chase Checking",
    "type": "checking",
    "institution": "Chase",
    "balance": 4250.00,
    "currency": "USD",
    "last_synced": "2026-02-22T08:00:00Z"
  },
  {
    "id": "uuid",
    "name": "Fidelity Brokerage",
    "type": "investment",
    "institution": "Fidelity",
    "balance": 82400.00,
    "currency": "USD",
    "last_synced": "2026-02-22T08:00:00Z"
  }
]
```

---

### Transactions

#### `GET /api/transactions`

Returns transactions with optional filtering.

**Query parameters:**

| Parameter | Type | Description | Example |
|---|---|---|---|
| `start` | date | Start date (inclusive) | `2026-01-01` |
| `end` | date | End date (inclusive) | `2026-01-31` |
| `category` | string | Filter by category | `Restaurants` |
| `account_id` | string | Filter by account UUID | `uuid` |
| `limit` | integer | Max records to return (default 200) | `50` |

```bash
curl -H "X-API-Key: your_key" \
  "http://localhost:3001/api/transactions?start=2026-01-01&end=2026-01-31&limit=50"
```

Response:
```json
[
  {
    "id": "uuid",
    "account_id": "uuid",
    "date": "2026-01-15",
    "description": "WHOLE FOODS MARKET",
    "amount": -67.42,
    "category": "Groceries",
    "merchant_name": "Whole Foods Market",
    "pending": false
  }
]
```

> Amounts are negative for debits (money leaving) and positive for credits (money coming in).

---

#### `GET /api/transactions/summary`

Returns monthly spending grouped by category.

**Query parameters:**

| Parameter | Type | Description | Example |
|---|---|---|---|
| `month` | string | Month in `YYYY-MM` format | `2026-01` |

```bash
curl -H "X-API-Key: your_key" \
  "http://localhost:3001/api/transactions/summary?month=2026-01"
```

Response:
```json
{
  "month": "2026-01",
  "total_spend": 3842.17,
  "by_category": {
    "Groceries": 412.50,
    "Restaurants": 287.00,
    "Utilities": 180.00,
    "Entertainment": 95.99,
    "Transportation": 143.20
  }
}
```

---

### Budgets

#### `GET /api/budgets`

Returns all budgets with current month's spending and remaining amounts.

```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/budgets
```

Response:
```json
[
  {
    "id": "uuid",
    "category": "Groceries",
    "monthly_limit": 500.00,
    "spent_this_month": 312.50,
    "remaining": 187.50,
    "percent_used": 62.5,
    "status": "on_track"
  },
  {
    "id": "uuid",
    "category": "Restaurants",
    "monthly_limit": 200.00,
    "spent_this_month": 287.00,
    "remaining": -87.00,
    "percent_used": 143.5,
    "status": "over_budget"
  }
]
```

`status` values: `on_track`, `warning` (>80%), `over_budget` (>100%).

---

#### `POST /api/budgets`

Creates a new budget.

**Request body:**

```json
{
  "category": "Groceries",
  "monthly_limit": 500.00
}
```

```bash
curl -X POST \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{"category": "Groceries", "monthly_limit": 500}' \
  http://localhost:3001/api/budgets
```

Response: `201 Created` with the created budget object.

---

#### `PUT /api/budgets/:id`

Updates an existing budget.

**Request body:**

```json
{
  "monthly_limit": 600.00
}
```

```bash
curl -X PUT \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{"monthly_limit": 600}' \
  http://localhost:3001/api/budgets/uuid-here
```

Response: Updated budget object.

---

#### `DELETE /api/budgets/:id`

Deletes a budget.

```bash
curl -X DELETE \
  -H "X-API-Key: your_key" \
  http://localhost:3001/api/budgets/uuid-here
```

Response: `204 No Content`

---

### Net Worth

#### `GET /api/networth`

Returns current net worth and 12-month historical snapshots.

```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/networth
```

Response:
```json
{
  "current": {
    "assets": 125000.00,
    "liabilities": 18500.00,
    "net_worth": 106500.00,
    "as_of": "2026-02-22"
  },
  "history": [
    { "date": "2025-03-01", "net_worth": 89200.00 },
    { "date": "2025-04-01", "net_worth": 91500.00 },
    { "date": "2025-05-01", "net_worth": 94100.00 }
  ]
}
```

---

### Portfolio

#### `GET /api/portfolio`

Returns portfolio summary including total value, gain/loss, and allocation by asset type.

```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/portfolio
```

Response:
```json
{
  "total_value": 82400.00,
  "total_cost_basis": 65000.00,
  "total_gain_loss": 17400.00,
  "total_gain_loss_pct": 26.77,
  "by_asset_type": {
    "stocks": { "value": 61800.00, "pct": 75.0 },
    "etfs": { "value": 14420.00, "pct": 17.5 },
    "bonds": { "value": 4100.00, "pct": 5.0 },
    "cash": { "value": 2080.00, "pct": 2.5 }
  },
  "last_updated": "2026-02-22T08:00:00Z"
}
```

---

#### `GET /api/portfolio/holdings`

Returns all individual positions with per-share details.

Also accessible at `GET /api/holdings`.

```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/portfolio/holdings
```

Response:
```json
[
  {
    "id": "uuid",
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "shares": 10.5,
    "cost_basis_per_share": 145.00,
    "current_price": 178.50,
    "market_value": 1874.25,
    "unrealized_gain_loss": 351.75,
    "unrealized_gain_loss_pct": 23.1,
    "asset_type": "stocks"
  }
]
```

---

### Tax

#### `GET /api/tax/estimate`

Returns federal tax liability estimate for the current tax year.

```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/tax/estimate
```

Response:
```json
{
  "tax_year": 2025,
  "filing_status": "single",
  "estimated_income": 95000.00,
  "estimated_tax": 16200.00,
  "effective_rate": 17.05,
  "marginal_rate": 22.0,
  "quarterly_payment": 4050.00,
  "next_payment_due": "2026-04-15",
  "withholding_ytd": 12000.00,
  "projected_balance_due": 4200.00
}
```

---

#### `GET /api/tax/documents`

Returns list of uploaded tax documents.

```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/tax/documents
```

Response:
```json
[
  {
    "id": "uuid",
    "filename": "w2_2025.pdf",
    "form_type": "W-2",
    "tax_year": 2025,
    "status": "processed",
    "extracted_fields": {
      "employer": "Acme Corp",
      "wages": 95000.00,
      "federal_withheld": 12000.00,
      "state_withheld": 4750.00
    },
    "uploaded_at": "2026-02-01T09:00:00Z"
  }
]
```

---

#### `POST /api/tax/documents/upload`

Uploads a tax document for OCR processing (requires Azure Document Intelligence configured).

```bash
curl -X POST \
  -H "X-API-Key: your_key" \
  -F "file=@/path/to/w2_2025.pdf" \
  http://localhost:3001/api/tax/documents/upload
```

Response: `202 Accepted` — processing is asynchronous. Check status via `GET /api/tax/documents`.

---

#### `GET /api/tax/deductions`

Returns tracked deductions.

```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/tax/deductions
```

Response:
```json
[
  {
    "id": "uuid",
    "category": "Home Office",
    "description": "Dedicated office space 200 sq ft",
    "amount": 2400.00,
    "tax_year": 2025
  }
]
```

---

### Research

#### `GET /api/research/:ticker`

Returns company research including news, SEC filings, and social sentiment.

```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/research/AAPL
```

Response:
```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "last_price": 178.50,
  "news": [
    {
      "headline": "Apple reports record iPhone sales",
      "source": "Reuters",
      "url": "https://...",
      "published_at": "2026-02-20T14:00:00Z",
      "sentiment": "positive"
    }
  ],
  "filings": [
    {
      "form": "10-Q",
      "filed_at": "2026-02-05",
      "description": "Quarterly Report",
      "url": "https://www.sec.gov/..."
    }
  ],
  "insider_activity": [
    {
      "name": "Tim Cook",
      "title": "CEO",
      "transaction_type": "sale",
      "shares": 10000,
      "price": 177.00,
      "date": "2026-02-10"
    }
  ],
  "sentiment": {
    "score": 0.72,
    "label": "bullish",
    "tweet_count_7d": 124500,
    "bull_bear_ratio": 2.57
  }
}
```

---

#### `GET /api/research/portfolio-news`

Returns aggregated news feed for all holdings in the portfolio.

```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/research/portfolio-news
```

Response:
```json
[
  {
    "ticker": "AAPL",
    "headline": "Apple reports record iPhone sales",
    "source": "Reuters",
    "url": "https://...",
    "published_at": "2026-02-20T14:00:00Z",
    "sentiment": "positive"
  }
]
```

---

### Insights

#### `GET /api/insights`

Returns AI-generated insights and alerts.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter: `new`, `viewed`, `dismissed`, `acted_on` |

```bash
# Get only new, unread insights
curl -H "X-API-Key: your_key" "http://localhost:3001/api/insights?status=new"
```

Response:
```json
[
  {
    "id": "uuid",
    "type": "budget_alert",
    "title": "Restaurants budget exceeded",
    "body": "You've spent $287 of your $200 restaurant budget this month.",
    "severity": "warning",
    "status": "new",
    "metadata": { "category": "Restaurants", "overage": 87.00 },
    "created_at": "2026-02-22T09:00:00Z"
  },
  {
    "id": "uuid",
    "type": "insider_sell",
    "title": "CEO sold $1.77M of AAPL",
    "body": "Tim Cook sold 10,000 shares at $177.00 on Feb 10.",
    "severity": "info",
    "status": "new",
    "created_at": "2026-02-22T07:30:00Z"
  }
]
```

Insight types: `budget_alert`, `portfolio_drift`, `insider_sell`, `sentiment_shift`, `unusual_transaction`, `tax_reminder`, `weekly_summary`.

---

#### `PATCH /api/insights/:id`

Updates an insight's status.

**Request body:**

```json
{ "status": "dismissed" }
```

Valid values: `viewed`, `dismissed`, `acted_on`.

```bash
curl -X PATCH \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{"status": "dismissed"}' \
  http://localhost:3001/api/insights/uuid-here
```

Response: Updated insight object.

---

### Chat

#### `POST /api/chat`

Sends a message to the AI assistant. Requires `ANTHROPIC_API_KEY` configured.

**Request body:**

```json
{
  "message": "How much did I spend on restaurants last month?"
}
```

```bash
curl -X POST \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{"message": "How much did I spend on restaurants last month?"}' \
  http://localhost:3001/api/chat
```

Response:
```json
{
  "reply": "In January 2026, you spent $287.00 on restaurants across 12 transactions. Your monthly budget is $200, so you're $87 over. Your most frequent spots were Chipotle (4 visits, $42) and Local Sushi Co (2 visits, $68).",
  "skill_used": "skill-budget",
  "tokens_used": 1240
}
```

---

### WebSocket

ClawFinance broadcasts real-time updates over WebSocket at `ws://localhost:3001/ws`.

**Connection:**
```javascript
const ws = new WebSocket("ws://localhost:3001/ws");
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg.type, msg.data);
};
```

**Event types:**

| Event | Description |
|---|---|
| `insight:new` | A new insight was generated |
| `sync:complete` | A data sync job finished |
| `budget:alert` | A budget threshold was crossed |
| `portfolio:updated` | Portfolio prices refreshed |

---

## Adding a New API Integration

This section walks you through adding a new external data source to ClawFinance end-to-end. Use this as a template when integrating a new financial API.

### Overview of the process

```
1. Add env vars to .env
2. Create an MCP server (clawfinance/mcp-servers/mcp-myapi/)
3. Register MCP server in .openclaw.json
4. Add API routes (clawfinance/api/src/routes/myapi.ts)
5. Mount the route in index.ts
6. Add a UI page (clawfinance/ui/src/pages/MyAPIPage.tsx)
7. Wire the nav link in Sidebar.tsx
8. Optionally create a skill (skills/skill-myapi/)
```

---

### Step 1 — Add environment variables

Open `clawfinance/.env` and add your API key(s):

```env
MYAPI_API_KEY=your_key_here
MYAPI_BASE_URL=https://api.example.com/v1
```

Then add entries to `.env.example` (without real values) so others know what to set:

```env
# MyAPI — description of what this does
# MYAPI_API_KEY=
# MYAPI_BASE_URL=
```

Also add detection to `clawfinance/api/src/routes/health.ts` inside `integrationStatus()`:

```typescript
myapi: {
  configured: check(["MYAPI_API_KEY"]),
  label: check(["MYAPI_API_KEY"]) ? "Connected" : "Not configured",
},
```

---

### Step 2 — Create an MCP server

MCP (Model Context Protocol) servers expose your data source as tools that AI agents can call.

Create the directory:
```bash
mkdir -p clawfinance/mcp-servers/mcp-myapi/src
```

Create `clawfinance/mcp-servers/mcp-myapi/package.json`:
```json
{
  "name": "mcp-myapi",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

Create `clawfinance/mcp-servers/mcp-myapi/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "strict": true
  },
  "include": ["src"]
}
```

Create `clawfinance/mcp-servers/mcp-myapi/src/index.ts`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const apiKey = process.env.MYAPI_API_KEY;
const baseUrl = process.env.MYAPI_BASE_URL ?? "https://api.example.com/v1";

const server = new McpServer({ name: "mcp-myapi", version: "1.0.0" });

// Register a tool the AI can call
server.tool(
  "get_myapi_data",
  "Fetch data from MyAPI for a given symbol",
  { symbol: z.string().describe("The ticker or ID to look up") },
  async ({ symbol }) => {
    if (!apiKey) {
      return { content: [{ type: "text", text: "MYAPI_API_KEY not configured" }] };
    }
    const response = await fetch(`${baseUrl}/data/${symbol}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

Build it:
```bash
cd clawfinance/mcp-servers/mcp-myapi
npm install
npm run build
```

---

### Step 3 — Register MCP server in `.openclaw.json`

Open `.openclaw.json` and add your server to the `mcpServers` block:

```json
{
  "mcpServers": {
    "mcp-myapi": {
      "command": "node",
      "args": ["clawfinance/mcp-servers/mcp-myapi/dist/index.js"],
      "env": {
        "MYAPI_API_KEY": "${MYAPI_API_KEY}",
        "MYAPI_BASE_URL": "${MYAPI_BASE_URL}"
      }
    }
  }
}
```

Restart OpenClaw for it to pick up the new server:
```bash
openclaw restart
```

---

### Step 4 — Add API routes

Create `clawfinance/api/src/routes/myapi.ts`:

```typescript
import { Router } from "express";

const router = Router();

// GET /api/myapi/:symbol
router.get("/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const apiKey = process.env.MYAPI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: "MYAPI_API_KEY not configured" });
  }

  try {
    const response = await fetch(
      `${process.env.MYAPI_BASE_URL}/data/${symbol}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch from MyAPI" });
  }
});

export default router;
```

---

### Step 5 — Mount the route in `index.ts`

Open `clawfinance/api/src/index.ts` and add:

```typescript
import myapiRouter from "./routes/myapi.js";

// After existing route mounts:
app.use("/api/myapi", myapiRouter);
```

Restart the API:
```bash
docker-compose restart api
```

Test it:
```bash
curl -H "X-API-Key: your_key" http://localhost:3001/api/myapi/AAPL
```

---

### Step 6 — Add a UI page

Create `clawfinance/ui/src/pages/MyAPIPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function MyAPIPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/myapi/AAPL").then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">My API Data</h1>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
```

---

### Step 7 — Wire the nav in `App.tsx` and `Sidebar.tsx`

In `clawfinance/ui/src/App.tsx`, add the route:

```tsx
import MyAPIPage from "./pages/MyAPIPage";

// Inside <Routes>:
<Route path="/myapi" element={<MyAPIPage />} />
```

In `clawfinance/ui/src/components/layout/Sidebar.tsx`, add the nav link:

```tsx
{ href: "/myapi", label: "My API", icon: <SomeIcon /> },
```

---

### Step 8 — Create an OpenClaw skill (optional)

Skills let the AI agent route natural language questions to your new data source.

Create `skills/skill-myapi/skill.json`:

```json
{
  "name": "skill-myapi",
  "description": "Look up data from MyAPI by ticker symbol",
  "triggers": ["myapi", "my api data", "look up"],
  "mcpServers": ["mcp-myapi"],
  "prompt": "You have access to MyAPI data via the get_myapi_data tool. When the user asks about data from MyAPI, use the tool to fetch it and summarize the results."
}
```

Skills are auto-discovered from the `skills/` directory when OpenClaw starts.

---

## Adding a New MCP Server

If you want to add a new MCP server without a corresponding UI route (e.g., a read-only data source for AI agents only):

1. Create `clawfinance/mcp-servers/mcp-myserver/` following Step 2 above
2. Build it: `npm install && npm run build`
3. Register in `.openclaw.json` following Step 3 above
4. Optionally, reference it in a skill's `mcpServers` array

The AI can then call its tools automatically when answering relevant questions.

---

## Database Schema

ClawFinance uses PostgreSQL. Migrations run automatically on first start.

| Table | Description |
|---|---|
| `accounts` | Linked bank, investment, and credit accounts |
| `transactions` | All financial transactions with categories |
| `budgets` | Monthly spending budgets per category |
| `holdings` | Investment positions (ticker, quantity, cost basis, market value) |
| `tax_documents` | Uploaded tax documents with OCR-extracted fields |
| `insights` | AI-generated insights and alerts |
| `company_intelligence` | Company research cache (news, filings, sentiment) |
| `net_worth_snapshots` | Daily net worth history |
| `agent_state` | OpenClaw agent persistent state |

### Connecting to the database directly

```bash
docker-compose exec postgres psql -U clawfinance -d clawfinance
```

Useful queries:
```sql
-- Recent transactions
SELECT date, description, amount, category FROM transactions ORDER BY date DESC LIMIT 20;

-- Budget summary
SELECT category, monthly_limit FROM budgets;

-- Current holdings
SELECT ticker, shares, market_value FROM holdings ORDER BY market_value DESC;
```

---

## Development Guide

### Project structure

```
clawfinance/api/src/
├── index.ts            ← Express app entry, route mounts
├── middleware/
│   └── auth.ts         ← X-API-Key header check
├── routes/
│   ├── accounts.ts     ← GET /api/accounts
│   ├── transactions.ts ← GET /api/transactions, /summary
│   ├── budgets.ts      ← CRUD /api/budgets
│   ├── portfolio.ts    ← GET /api/portfolio + /holdings
│   ├── tax.ts          ← GET/POST /api/tax/*
│   ├── research.ts     ← GET /api/research/*
│   ├── insights.ts     ← GET/PATCH /api/insights
│   ├── networth.ts     ← GET /api/networth
│   ├── chat.ts         ← POST /api/chat
│   └── health.ts       ← GET /api/health (detailed)
└── services/
    ├── db.ts           ← pg Pool
    └── websocket.ts    ← WS broadcast helper

clawfinance/ui/src/
├── App.tsx             ← Routes + layout
├── components/layout/
│   ├── Sidebar.tsx     ← Nav links
│   ├── Header.tsx      ← Page title + status
│   └── ChatPanel.tsx   ← Floating AI chat
├── pages/
│   ├── NetWorthDashboard.tsx
│   ├── PortfolioView.tsx
│   ├── TransactionsBudget.tsx
│   ├── TaxCenter.tsx
│   ├── ResearchNews.tsx
│   └── Settings.tsx    ← API key management
└── lib/
    ├── api.ts          ← fetch wrapper
    └── websocket.ts    ← WS client
```

### TypeScript compilation

```bash
# API — type check only
cd clawfinance/api && npx tsc --noEmit

# API — compile to dist/
cd clawfinance/api && npm run build

# MCP servers (build each individually)
cd clawfinance/mcp-servers/mcp-plaid && npm run build
```

### Running tests

```bash
cd clawfinance/api && npm test
```

### Environment variable precedence

Variables are resolved in this order (highest → lowest):

1. Process environment (e.g., variables already exported in your shell)
2. `clawfinance/.env` (for local dev)
3. `~/.openclaw/.env` (for daemon mode)
4. `.openclaw.json` `env` block

---

## Cron Jobs & Automation

Once OpenClaw is running (`openclaw start`), these jobs run automatically:

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

Cron config lives in `.openclaw.json` under the `cron.jobs` key. To add a job:

```json
{
  "cron": {
    "jobs": [
      {
        "name": "my-custom-job",
        "schedule": "0 10 * * *",
        "skill": "skill-myapi",
        "message": "run my custom daily check"
      }
    ]
  }
}
```

### Manual triggers

You can trigger any job on demand via the chat panel or any OpenClaw channel:

```
sync my transactions
check my portfolio
run weekly summary
analyze my spending this month
research AAPL
```

---

## OpenClaw Skills

Skills are AI agent programs that handle specific types of requests. ClawFinance includes six:

| Skill | Description | Sample prompts |
|---|---|---|
| `skill-finance-orchestrator` | Routes requests to the right skill | Any finance question |
| `skill-data-ingestion` | Syncs Plaid + portfolio + news data | "sync my transactions", "update my portfolio" |
| `skill-budget` | Spending analysis & budget management | "am I over budget?", "how much on food this month?" |
| `skill-investment` | Portfolio analysis & tax-loss harvesting | "how is my portfolio doing?", "any tax-loss opportunities?" |
| `skill-tax` | Tax estimation & document processing | "how much do I owe?", "process my W-2" |
| `skill-research` | Company research & sentiment | "research TSLA", "any insider activity on NVDA?" |

Skills live in `skills/` at the repo root and are auto-discovered by OpenClaw.

To add a custom skill, see [Adding a New API Integration — Step 8](#step-8--create-an-openclaw-skill-optional).

---

## Troubleshooting

### API won't start — "DATABASE_URL is required"

Make sure `clawfinance/.env` exists and `DB_PASSWORD` is set:

```bash
bash clawfinance/scripts/validate-env.sh
```

---

### Postgres container exits immediately

Check if port 5432 is already in use (another Postgres instance running locally):

```bash
docker-compose logs postgres
# On Mac/Linux:
lsof -i :5432
# On Windows (Git Bash):
netstat -an | grep 5432
```

If port 5432 is taken, change the host port in `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"   # Use 5433 on the host
```
And update `DB_PORT=5433` in `.env`.

---

### UI shows unstyled / broken layout

Tailwind requires `postcss.config.js`. Check it exists:

```bash
ls clawfinance/ui/postcss.config.js
```

If missing:
```bash
echo 'export default { plugins: { tailwindcss: {}, autoprefixer: {} } }' > clawfinance/ui/postcss.config.js
```

---

### "X-API-Key" error in browser

Verify the Vite proxy is configured in `clawfinance/ui/vite.config.ts`:

```ts
proxy: { "/api": "http://localhost:3001", "/ws": "ws://localhost:3001" }
```

Also check that `CLAWFINANCE_API_KEY` in `.env` matches `VITE_API_KEY` in `.env`, or leave `VITE_API_KEY` unset for open local dev.

---

### MCP server not found by OpenClaw

1. Build the server first: `npm run build`
2. Check `.openclaw.json` references the compiled `dist/index.js` path correctly
3. Restart OpenClaw: `openclaw restart`
4. Check logs: `openclaw logs`

---

### Chat panel not responding

The chat requires `ANTHROPIC_API_KEY` in `.env`. Verify with:

```bash
curl http://localhost:3001/api/health | python3 -m json.tool
```

Look for `"anthropic": { "configured": true }` in the `integrations` block.

---

### Transactions not syncing

1. Confirm `PLAID_CLIENT_ID` and `PLAID_SECRET` are set and correct
2. Check the bank-sync cron job ran: look in the insights table for recent entries
3. Trigger manually in the chat: *"sync my transactions"*
4. Check logs: `docker-compose logs api`

---

### "Could not connect to Redis"

Ensure the Redis container is running:

```bash
docker-compose ps redis
docker-compose up -d redis
```

---

### Port already in use

If you get `EADDRINUSE` errors, find and kill the conflicting process:

```bash
# Mac/Linux:
lsof -ti :3001 | xargs kill
lsof -ti :5173 | xargs kill

# Windows (PowerShell):
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

---

## Security Notes

- **Never commit `.env`** — it's listed in `.gitignore`
- All `/api/*` routes (except `/api/health`) require the `X-API-Key` header
- Sensitive database fields are encrypted using `DB_ENCRYPTION_KEY`
- The UI runs behind nginx in Docker, which handles header stripping before the upstream API
- No financial data is ever sent outside your local network — all AI calls go directly from your machine to Anthropic's API
- Plaid and SnapTrade tokens are stored encrypted in the database
- Use `openssl rand -base64 32` to generate strong random secrets

---

## Features by Phase

### Phase 1 — Foundation

- PostgreSQL database with core tables, Redis, Docker Compose
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

- **Floating chat panel** with AI routing to the appropriate skill
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
