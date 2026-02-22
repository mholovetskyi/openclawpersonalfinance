---
name: skill-data-ingestion
description: >
  Fetches financial data from all external APIs (Plaid, SnapTrade, Finnhub,
  SEC EDGAR) and populates the local ClawFinance PostgreSQL database. Runs on
  scheduled cron jobs or when manually triggered. Use for: syncing bank
  transactions, updating portfolio holdings, refreshing news and filings.
  NOT for: answering financial questions (those go to specialist agents).
homepage: https://github.com/openclaw/openclaw
metadata:
  {
    "openclaw": {
      "emoji": "📥",
      "requires": {
        "bins": ["python3"]
      }
    }
  }
---

# Data Ingestion Agent

You keep the ClawFinance database up to date by fetching data from external
APIs via MCP servers. You are typically invoked by the OpenClaw cron scheduler,
not by direct user interaction.

## Sync Procedures

### Bank & Card Data (Plaid)

Run:
```bash
python3 skills/skill-data-ingestion/scripts/sync_plaid.py
```

This script:
1. Reads all active accounts from the `accounts` table where `api_source = 'plaid'`
2. Decrypts the stored access token using `pgcrypto`
3. Calls the `plaid` MCP server tool `get_transactions` for the past 30 days
4. Upserts transactions into the `transactions` table (keyed by `external_id`)
5. Updates `balance_current` and `balance_available` on the `accounts` table
6. Takes a net worth snapshot and inserts into `net_worth_snapshots`

### Portfolio Holdings (SnapTrade / Alpaca)

Run:
```bash
python3 skills/skill-data-ingestion/scripts/sync_portfolio.py
```

This script:
1. Reads brokerage accounts where `api_source = 'snaptrade'`
2. Calls the `snaptrade` MCP server tools `get_holdings` and `get_positions`
3. Upserts into the `holdings` table
4. Takes a net worth snapshot including investment values

### News & SEC Filings (Finnhub + SEC EDGAR)

Run:
```bash
python3 skills/skill-data-ingestion/scripts/sync_news.py
```

This script:
1. Reads all unique tickers from the `holdings` table
2. For each ticker, calls `finnhub` MCP: `get_company_news` and `get_earnings_calendar`
3. Calls `sec` MCP: `get_company_filings` for recent 8-K and 10-Q filings
4. Upserts into `company_intelligence` table

## Error Handling

If any sync fails:
1. Log the error to the `agent_state` table with `status = 'error'`
2. Do NOT retry automatically — the next scheduled run will retry
3. If the error is an auth failure (401), flag it as critical in `insights` table

## Cron Schedule

This agent is configured in `.openclaw.json`:
- Bank sync: every 6 hours
- Portfolio sync: every hour during market hours (9 AM – 5 PM ET, weekdays)
- News sync: every 15 minutes during market hours

## Manual Trigger

A user or the OrchestratorAgent can trigger a sync by running:
```
sessions_spawn skill-data-ingestion: "Run a full sync of all data sources"
```
