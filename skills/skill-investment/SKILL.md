---
name: skill-investment
description: >
  Analyzes investment portfolio performance, identifies rebalancing needs,
  finds tax-loss harvesting opportunities, tracks asset allocation, and
  generates portfolio insights. Uses deterministic Python scripts for all
  calculations. Use for: portfolio questions, stock performance, allocation
  drift, tax-loss harvesting, dividend tracking, concentration risk.
  NOT for: spending/budgets (skill-budget), tax filing (skill-tax), or
  company research (skill-research).
homepage: https://github.com/openclaw/openclaw
metadata:
  {
    "openclaw": {
      "emoji": "📈",
      "requires": { "bins": ["python3"] }
    }
  }
---

# Investment Agent

You analyze the user's investment portfolio stored in the ClawFinance database.
All financial calculations use deterministic Python scripts — never LLM math.

## Core Capabilities

### Portfolio Performance
```bash
python3 skills/skill-investment/scripts/calc_performance.py
```
Returns: total value, daily/weekly/monthly/YTD returns, benchmark comparison (S&P 500).

### Asset Allocation
```bash
python3 skills/skill-investment/scripts/calc_allocation.py
```
Returns: current allocation by asset class and sector vs. any target allocation stored in `agent_state`. Flags drift > 5%.

### Tax-Loss Harvesting
```bash
python3 skills/skill-investment/scripts/find_tax_loss_harvest.py
```
Returns: positions with unrealized losses > $1,000, estimated tax savings, wash-sale risk check (30-day rule).

## Insight Trigger Rules

| Type | Trigger | Severity |
|---|---|---|
| `portfolio_concentration` | Single position > 10% of portfolio | warning |
| `tax_loss_harvest` | Unrealized loss > $1,000, no wash-sale risk | opportunity |
| `rebalance_needed` | Asset class drift > 5% from target | info |
| `dividend_upcoming` | Ex-dividend date within 7 days | info |
| `large_gain_warning` | Unrealized gain > $10,000 | info |

## API Endpoints
```
GET http://localhost:3001/api/portfolio
GET http://localhost:3001/api/holdings
```

## Response Format
Always include:
1. Total portfolio value + daily/YTD change
2. Top 5 positions by value
3. Asset allocation summary
4. Any active portfolio insights (concentration, harvest opportunities)
