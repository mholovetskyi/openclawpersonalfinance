#!/usr/bin/env python3
"""
extract_tax_doc.py — Calls Azure Doc Intelligence MCP to extract tax document data.

Usage:
  python3 extract_tax_doc.py --file /path/to/w2.pdf --form W-2 [--year 2025]
"""
import os, sys, json, argparse
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

SUPPORTED_FORMS = ["W-2","1099-INT","1099-DIV","1099-B","1099-MISC","1040"]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="Path to PDF or image")
    parser.add_argument("--form", required=True, choices=SUPPORTED_FORMS)
    parser.add_argument("--year", type=int, default=date.today().year - 1,
                        help="Tax year (default: prior year)")
    args = parser.parse_args()

    # NOTE: In production, this script would call the mcp-azure-doc-intel MCP server
    # via OpenClaw's MCP tool interface. Here we return a stub response for local
    # testing without an Azure subscription.
    extracted_data = {
        "_note": "This is a stub. Connect Azure Doc Intelligence to extract real data.",
        "_file": args.file,
    }
    total_income = 0.0
    total_withheld = 0.0
    issuer_name = "Unknown Issuer"

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Upsert tax document
    cur.execute("""
        INSERT INTO tax_documents
          (year, form_type, issuer_name, file_path, extracted_data, total_income, total_tax_withheld)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, [args.year, args.form, issuer_name, args.file,
          json.dumps(extracted_data), total_income, total_withheld])
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    print(json.dumps({
        "status": "ok",
        "document_id": str(row["id"]),
        "form_type": args.form,
        "year": args.year,
        "extracted_data": extracted_data,
        "message": f"{args.form} for {args.year} saved. Connect Azure Doc Intelligence for real extraction.",
    }))

if __name__ == "__main__":
    main()
