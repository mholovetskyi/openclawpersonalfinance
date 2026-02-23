import { describe, it, expect } from "vitest";
import {
  mapAccountType,
  mapAccountSubtype,
  normalizeTransaction,
  type FlinksTransaction,
} from "../connectors/flinks.js";

describe("Flinks Connector — mapping helpers", () => {
  describe("mapAccountType", () => {
    it("maps Operations to depository", () => {
      expect(mapAccountType("Operations")).toBe("depository");
    });

    it("maps Credits to credit", () => {
      expect(mapAccountType("Credits")).toBe("credit");
    });

    it("maps Investments to investment", () => {
      expect(mapAccountType("Investments")).toBe("investment");
    });

    it("maps Loans to loan", () => {
      expect(mapAccountType("Loans")).toBe("loan");
    });

    it("maps Mortgages to mortgage", () => {
      expect(mapAccountType("Mortgages")).toBe("mortgage");
    });

    it("defaults unknown categories to depository", () => {
      expect(mapAccountType("SomethingElse")).toBe("depository");
    });
  });

  describe("mapAccountSubtype", () => {
    it("maps Chequing to checking", () => {
      expect(mapAccountSubtype("Chequing")).toBe("checking");
    });

    it("maps Savings to savings", () => {
      expect(mapAccountSubtype("Savings")).toBe("savings");
    });

    it("maps CreditCard to credit_card", () => {
      expect(mapAccountSubtype("CreditCard")).toBe("credit_card");
    });

    it("maps RRSP to rrsp", () => {
      expect(mapAccountSubtype("RRSP")).toBe("rrsp");
    });

    it("maps TFSA to tfsa", () => {
      expect(mapAccountSubtype("TFSA")).toBe("tfsa");
    });

    it("lowercases unknown types", () => {
      expect(mapAccountSubtype("UnknownType")).toBe("unknowntype");
    });
  });

  describe("normalizeTransaction", () => {
    it("normalizes a debit transaction (money out)", () => {
      const tx: FlinksTransaction = {
        Id: "tx-001",
        Date: "2026-02-15T00:00:00",
        Debit: 45.99,
        Balance: 1000,
        Description: "Grocery Store",
      };

      const result = normalizeTransaction(tx, "acc-123");

      expect(result.account_id).toBe("acc-123");
      expect(result.amount).toBe(45.99);
      expect(result.date).toBe("2026-02-15");
      expect(result.name).toBe("Grocery Store");
      expect(result.api_source).toBe("flinks");
      expect(result.external_id).toBe("flinks_tx-001");
      expect(result.pending).toBe(false);
    });

    it("normalizes a credit transaction (money in) as negative", () => {
      const tx: FlinksTransaction = {
        Id: "tx-002",
        Date: "2026-02-14T00:00:00",
        Credit: 2500.00,
        Balance: 3500,
        Description: "Payroll",
      };

      const result = normalizeTransaction(tx, "acc-123");

      expect(result.amount).toBe(-2500.00);
      expect(result.name).toBe("Payroll");
    });

    it("handles transaction with both debit and credit", () => {
      const tx: FlinksTransaction = {
        Id: "tx-003",
        Date: "2026-01-01T00:00:00",
        Debit: 100,
        Credit: 25,
        Balance: 900,
        Description: "Partial refund",
      };

      const result = normalizeTransaction(tx, "acc-456");

      // 100 - 25 = 75 net debit
      expect(result.amount).toBe(75);
    });

    it("handles transaction with neither debit nor credit", () => {
      const tx: FlinksTransaction = {
        Id: "tx-004",
        Date: "2026-03-01T00:00:00",
        Balance: 500,
        Description: "Balance adjustment",
      };

      const result = normalizeTransaction(tx, "acc-789");

      expect(result.amount).toBe(0);
    });
  });
});
