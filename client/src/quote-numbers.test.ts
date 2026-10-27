import { describe, expect, it } from "vitest";
import { normalizeQuoteNumbers, roundQuoteDecimal } from "./quote-numbers";

describe("quote decimal precision", () => {
  it.each([
    [1.005, 1.01],
    [10.075, 10.08],
    [2.675, 2.68],
    [125.5, 125.5],
    [0, 0],
    [999999999999.99, 999999999999.99],
  ])("rounds price %s to %s without losing a cent", (value, expected) => {
    expect(roundQuoteDecimal(value, 2)).toBe(expected);
  });

  it.each([
    [1.2345, 1.235],
    [1.2344, 1.234],
    [0.001, 0.001],
    [5e-4, 0.001],
    [1e-7, 0],
    [999999999.999, 999999999.999],
  ])("rounds quantity %s to %s", (value, expected) => {
    expect(roundQuoteDecimal(value, 3)).toBe(expected);
  });

  it("normalizes the saved payload without mutating the line being edited", () => {
    const line = { description: "Repuesto", quantity: 1.2345, unitPrice: 10.075 };
    const result = normalizeQuoteNumbers(line);
    expect(result).toEqual({ description: "Repuesto", quantity: 1.235, unitPrice: 10.08 });
    expect(line).toEqual({ description: "Repuesto", quantity: 1.2345, unitPrice: 10.075 });
    expect(normalizeQuoteNumbers(result)).toEqual(result);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("rejects non-finite values (%s)", (value) => {
    expect(() => normalizeQuoteNumbers({ quantity: 1, unitPrice: value })).toThrow(RangeError);
    expect(() => normalizeQuoteNumbers({ quantity: value, unitPrice: 1 })).toThrow(RangeError);
  });

  it.each([
    { quantity: 0.0004, unitPrice: 10 },
    { quantity: 0, unitPrice: 10 },
    { quantity: -1, unitPrice: 10 },
    { quantity: 1, unitPrice: -0.001 },
  ])("rejects quantities rounded to zero and negative prices: %j", (line) => {
    expect(() => normalizeQuoteNumbers(line)).toThrow(RangeError);
  });
});
