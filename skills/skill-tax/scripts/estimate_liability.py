#!/usr/bin/env python3
"""
estimate_liability.py — Deterministic federal + state tax liability estimation.

Reads all tax documents for the current year from the database, applies
2026 federal brackets, and returns a JSON tax summary. Never uses LLM math.
"""
import os, sys, json
from datetime import date

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print(json.dumps({"status": "error", "message": "pip install psycopg2-binary"}))
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print(json.dumps({"status": "error", "message": "DATABASE_URL not set"}))
    sys.exit(1)

FILING_STATUS = os.environ.get("FILING_STATUS", "single")
TAX_TABLES_PATH = os.path.join(os.path.dirname(__file__), "tax_tables_2026.json")

def d(v) -> float:
    return float(v) if v is not None else 0.0

def calc_tax_from_brackets(income: float, brackets: list) -> float:
    tax = 0.0
    for bracket in brackets:
        lo = bracket["min"]
        hi = bracket["max"] if bracket["max"] is not None else float("inf")
        rate = bracket["rate"]
        if income <= lo:
            break
        taxable_in_bracket = min(income, hi) - lo
        tax += taxable_in_bracket * rate
    return tax

def main():
    with open(TAX_TABLES_PATH) as f:
        tables = json.load(f)

    brackets = tables["federal_brackets"].get(FILING_STATUS, tables["federal_brackets"]["single"])
    ltcg_rates = tables["long_term_capital_gains_rates"].get(FILING_STATUS, tables["long_term_capital_gains_rates"]["single"])
    std_deduction = tables["standard_deduction"].get(FILING_STATUS, tables["standard_deduction"]["single"])

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    year = date.today().year

    # Aggregate income from tax documents
    cur.execute("""
        SELECT form_type,
               COALESCE(SUM((extracted_data->>'wages_tips_other_compensation')::numeric), 0) AS w2_wages,
               COALESCE(SUM((extracted_data->>'interest_income')::numeric), 0)              AS interest,
               COALESCE(SUM((extracted_data->>'ordinary_dividends')::numeric), 0)           AS dividends,
               COALESCE(SUM((extracted_data->>'net_proceeds')::numeric), 0)                 AS proceeds,
               COALESCE(SUM((extracted_data->>'cost_basis')::numeric), 0)                   AS cost_basis,
               COALESCE(SUM(total_tax_withheld), 0)                                         AS withheld
        FROM tax_documents
        WHERE year = %s
        GROUP BY form_type
    """, [year])
    rows = {r["form_type"]: r for r in cur.fetchall()}

    w2_wages     = d(rows.get("W-2",      {}).get("w2_wages", 0))
    interest     = d(rows.get("1099-INT", {}).get("interest", 0))
    dividends    = d(rows.get("1099-DIV", {}).get("dividends", 0))
    gross_1099b  = d(rows.get("1099-B",   {}).get("proceeds", 0))
    basis_1099b  = d(rows.get("1099-B",   {}).get("cost_basis", 0))
    capital_gains = max(gross_1099b - basis_1099b, 0)   # simplified: all treated as LTCG
    total_withheld = sum(d(r.get("withheld", 0)) for r in rows.values())

    # Estimated payments
    cur.execute("""
        SELECT COALESCE(SUM(amount_paid), 0) AS total_es
        FROM estimated_tax_payments WHERE year = %s
    """, [year])
    es_row = cur.fetchone()
    total_estimated_payments = d(es_row["total_es"]) if es_row else 0.0

    # Deductions
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0) AS itemized FROM deductions WHERE year = %s
    """, [year])
    ded_row = cur.fetchone()
    itemized = d(ded_row["itemized"]) if ded_row else 0.0
    deduction = max(itemized, std_deduction)

    gross_income = w2_wages + interest + dividends
    taxable_income = max(gross_income - deduction, 0)

    # Federal ordinary income tax
    federal_tax = calc_tax_from_brackets(taxable_income, brackets)

    # LTCG tax (simplified: all capital gains treated as long-term)
    ltcg_tax = calc_tax_from_brackets(capital_gains, ltcg_rates)

    # NIIT (3.8% on net investment income above threshold)
    niit_threshold = tables["niit_threshold"].get(FILING_STATUS, 200000)
    niit = max(gross_income + capital_gains - niit_threshold, 0) * tables["net_investment_income_tax_rate"]

    total_federal = federal_tax + ltcg_tax + niit

    # Effective and marginal rates
    total_income = gross_income + capital_gains
    effective_rate = total_federal / total_income * 100 if total_income > 0 else 0.0
    marginal_rate = 0.0
    for b in reversed(brackets):
        if taxable_income > b["min"]:
            marginal_rate = b["rate"] * 100
            break

    balance_due = total_federal - total_withheld - total_estimated_payments

    cur.close()
    conn.close()

    # Quarterly payment schedule
    q_dates = {1:"April 15",2:"June 16",3:"September 15",4:"January 15"}
    q_amount = total_federal / 4
    today = date.today()
    quarters_remaining = sum(1 for q in [date(year,4,15),date(year,6,16),date(year,9,15),date(year+1,1,15)] if q >= today)

    print(json.dumps({
        "status": "ok",
        "year": year,
        "filing_status": FILING_STATUS,
        "income": {
            "w2_wages": round(w2_wages, 2),
            "interest": round(interest, 2),
            "dividends": round(dividends, 2),
            "capital_gains": round(capital_gains, 2),
            "gross_income": round(gross_income + capital_gains, 2),
        },
        "deduction": {"amount": round(deduction, 2), "type": "itemized" if itemized > std_deduction else "standard"},
        "taxable_income": round(taxable_income, 2),
        "tax": {
            "federal_ordinary": round(federal_tax, 2),
            "ltcg": round(ltcg_tax, 2),
            "niit": round(niit, 2),
            "total_federal": round(total_federal, 2),
        },
        "effective_rate_pct": round(effective_rate, 2),
        "marginal_rate_pct": round(marginal_rate, 1),
        "withholding": round(total_withheld, 2),
        "estimated_payments_paid": round(total_estimated_payments, 2),
        "balance_due": round(balance_due, 2),
        "quarterly_payment": round(q_amount, 2),
        "quarters_remaining": quarters_remaining,
    }))

if __name__ == "__main__":
    main()
