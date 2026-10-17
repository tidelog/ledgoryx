import { describe, expect, it } from "vitest";

import { importCSV } from "./csv";

describe("Ledgoryx CSV financial integrity", () => {
  it("rejects unexpected columns", () => {
    const csv = [
      "id,reference,amount,currency,untrusted",
      "p1,INV-001,100.00,GBP,payload",
    ].join("\n");

    expect(() => importCSV(csv, "payments")).toThrow(
      "Unsupported CSV columns: untrusted",
    );
  });

  it("rejects multiple unexpected columns", () => {
    const csv = [
      "id,reference,amount,currency,notes,metadata",
      "p1,INV-001,100.00,GBP,test,test",
    ].join("\n");

    expect(() => importCSV(csv, "payments")).toThrow(
      "Unsupported CSV columns: notes, metadata",
    );
  });

  it("accepts valid decimal amount columns", () => {
    const csv = [
      "id,reference,amount,currency",
      "p1,INV-001,100.25,GBP",
    ].join("\n");

    const result = importCSV(csv, "payments");

    expect(result.success).toBe(true);
    expect(result.records[0].amountMinor).toBe(10025);
  });

  it("accepts valid integer minor-unit columns", () => {
    const csv = [
      "id,reference,amount_minor,currency",
      "p1,INV-001,-10025,GBP",
    ].join("\n");

    const result = importCSV(csv, "payments");

    expect(result.success).toBe(true);
    expect(result.records[0].amountMinor).toBe(-10025);
  });

  it("continues rejecting duplicate transaction IDs", () => {
    const csv = [
      "id,reference,amount,currency",
      "p1,INV-001,100.00,GBP",
      "p1,INV-002,200.00,GBP",
    ].join("\n");

    const result = importCSV(csv, "payments");

    expect(result.success).toBe(false);
    expect(result.invalidRows).toBe(1);
    expect(
      result.errors.some(
        (error) =>
          error.field === "id" &&
          error.message === "Duplicate ID",
      ),
    ).toBe(true);
  });

  it("does not allow both amount representations", () => {
    const csv = [
      "id,reference,amount,amount_minor,currency",
      "p1,INV-001,100.00,10000,GBP",
    ].join("\n");

    expect(() => importCSV(csv, "payments")).toThrow(
      "Exactly one of amount or amount_minor is required",
    );
  });
});
