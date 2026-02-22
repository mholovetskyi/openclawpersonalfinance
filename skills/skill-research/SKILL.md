---
name: skill-research
description: >
  Deep company research combining SEC filings, financial data, Twitter sentiment,
  alternative data signals, and AI synthesis. Use for: stock analysis, earnings
  research, insider activity, competitive intelligence, sentiment tracking.
  NOT for: budget/spending questions (delegate to skill-budget) or tax advice.
homepage: https://github.com/openclaw/openclaw
metadata:
  {
    "openclaw": {
      "emoji": "🔬",
      "requires": {
        "bins": ["python3", "curl"]
      }
    }
  }
---

# Research Agent

You conduct deep, multi-source research on companies for the user's investment
portfolio. All data gathering is via MCP tools; all synthesis is done by you.

## Core Capabilities

### Company Intelligence Report

Gather from all sources, then synthesize:

1. **Financials** via `mcp-finnhub`: `get_quote`, `get_company_profile`, `get_financials`
2. **SEC filings** via `mcp-sec`: `get_company_filings` (10-K, 10-Q), `get_insider_transactions`, `get_company_facts`
3. **News sentiment** via `mcp-finnhub`: `get_company_news` (last 7 days)
4. **Twitter sentiment** via `mcp-twitter`: `get_sentiment_score`
5. **Alt data signals** via `mcp-altdata`: `get_google_trends`, `get_app_store_ranking`

Then persist via script:
```bash
python3 skills/skill-research/scripts/fetch_company_intel.py --ticker TICKER
```

### Sentiment Analysis

```bash
python3 skills/skill-research/scripts/analyze_sentiment.py --ticker TICKER --days 30
```

Reads `company_news` and `sentiment_snapshots` tables. Returns trend + key topics.

### Portfolio Research Sweep

For every holding in the portfolio, run a lightweight check:
- Any new SEC filings in last 7 days?
- Any insider sells > $1M?
- Sentiment score shifted > 0.3 in 7 days?
- Earnings in next 14 days?

Post alerts as insights:
```bash
curl -s -X POST http://localhost:3001/api/insights \
  -H "Content-Type: application/json" \
  -d '{"agent":"skill-research","type":"research_alert","severity":"info","title":"...","description":"..."}'
```

## Insight Trigger Rules

| Type | Trigger | Severity |
|---|---|---|
| `insider_sell_alert` | Insider sells > $500K in Form 4 | warning |
| `earnings_upcoming` | Earnings date within 7 days | info |
| `sentiment_shift` | Composite score moves > 0.35 in 7 days | warning |
| `sec_filing_alert` | New 8-K or 10-K filed | info |
| `alt_data_signal` | Google Trends spike > 2x 30-day average | info |

## Response Format

For a company deep-dive, always include:
1. **1-paragraph executive summary** (business + current valuation)
2. **Key metrics**: P/E, revenue growth, margins from latest 10-Q
3. **Recent catalysts**: news + SEC filings last 30 days
4. **Insider activity**: any Form 4 sells/buys last 90 days
5. **Sentiment snapshot**: Twitter + news composite score
6. **Alt data signals**: trends, app ranking, hiring velocity
7. **Risk factors**: from 10-K risk section summary
8. **Investment thesis**: bull case vs. bear case (2–3 points each)

## API Endpoints Available

```
GET  http://localhost:3001/api/research/:ticker
GET  http://localhost:3001/api/research/portfolio-news
GET  http://localhost:3001/api/research/sentiment/:ticker
```

## Example Interaction

```
User: "Give me a deep dive on NVDA"

1. Call get_quote, get_company_profile, get_financials (Finnhub)
2. Call get_company_filings (last 10-K + 10-Q), get_insider_transactions (SEC)
3. Call get_company_news (last 7 days, Finnhub)
4. Call get_sentiment_score (Twitter, 24h)
5. Call get_google_trends ("NVDA stock", 3-month)
6. Run fetch_company_intel.py to persist
7. Synthesize and respond with full report
```
