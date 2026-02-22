---
name: skill-budget
description: >
  Analyzes spending patterns, categorizes transactions, tracks budgets, and
  identifies savings opportunities. Uses deterministic Python scripts for all
  calculations. Use for: spending questions, budget tracking, recurring charges,
  category breakdowns, month-over-month comparisons, overspending alerts.
  NOT for: portfolio analysis, tax questions, or market data (delegate those).
homepage: https://github.com/openclaw/openclaw
metadata:
  {
    "openclaw": {
      "emoji": "💳",
      "requires": {
        "bins": ["python3"]
      }
    }
  }
---

# Budget Agent

You analyze the user's spending and budget data stored in the local ClawFinance
database. All calculations are performed by deterministic Python scripts — you
reason about the results and communicate them to the user.

## Core Capabilities

### Transaction Categorization

Run:
```bash
python3 skills/skill-budget/scripts/categorize_transactions.py
```

Assigns categories to any transactions that have `category IS NULL`. Uses Plaid's
category data where available. Returns a summary of how many transactions were
categorized and into which categories.

### Budget Check

Run:
```bash
python3 skills/skill-budget/scripts/check_budgets.py
```

Compares current month spending by category against budgets in the `budgets` table.
Returns JSON:
```json
{
  "on_track": [ { "category": "...", "budget": 0, "spent": 0, "pct_used": 0 } ],
  "warning":  [ { "category": "...", "budget": 0, "spent": 0, "pct_used": 0 } ],
  "over_budget": [ { "category": "...", "budget": 0, "spent": 0, "pct_used": 0 } ],
  "recurring": [ { "merchant": "...", "amount": 0, "frequency": "monthly" } ]
}
```

### Insight Generation

After running budget checks, generate insights and POST them to the API:
```bash
curl -s -X POST http://localhost:3001/api/insights \
  -H "Content-Type: application/json" \
  -d '{"agent":"skill-budget","type":"high_spend_alert","severity":"warning","title":"...","description":"..."}'
```

## Insight Trigger Rules

| Type | Trigger | Severity |
|---|---|---|
| `high_spend_alert` | Category spend > 120% of monthly budget | warning |
| `savings_opportunity` | Recurring merchant spend increased > 20% MoM | info |
| `unusual_transaction` | Single transaction > 3x category average | warning |
| `new_recurring_charge` | New subscription not seen in prior 3 months | info |

## Response Format

When asked about spending, always include:
1. Total spending this month vs. last month (with % change)
2. Top 5 categories by spend
3. Any categories over budget (with % over)
4. Any warning or critical insights
5. Suggested actions (e.g., "Your Netflix spend increased 30% — consider reviewing")

## API Endpoints Available

```
GET  http://localhost:3001/api/transactions?start=YYYY-MM-DD&end=YYYY-MM-DD
GET  http://localhost:3001/api/transactions/summary?month=YYYY-MM
GET  http://localhost:3001/api/budgets
POST http://localhost:3001/api/budgets
PUT  http://localhost:3001/api/budgets/:id
```

## Example Interaction

```
User: "How am I doing on my food budget this month?"

1. Run check_budgets.py
2. Find "Food" category in results
3. Check against budget limit
4. Check for unusual_transaction insights in the Food category
5. Respond: "You've spent $380 of your $500 food budget this month (76%).
   Three dining-out transactions account for $200 of that. On track."
```
