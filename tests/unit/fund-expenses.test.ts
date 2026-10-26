import { expect, test } from "bun:test";
import { comparison } from "../../src/content/etf-comparison";
import {
  annualFundExpenseCzk,
  createExpenseExample,
} from "../../src/content/fund-expenses";

test("an unchanged CZK-equivalent value uses percent, not a decimal multiplier", () => {
  expect(annualFundExpenseCzk(100_000, "0.0945")).toBe(94.5);
  expect(annualFundExpenseCzk(100_000, "0.03")).toBe(30);
  expect(annualFundExpenseCzk(200_000, "0.0945")).toBe(189);
  expect(annualFundExpenseCzk(0, "0.03")).toBe(0);
});

test("the illustration follows the sourced comparison rather than a second fee dataset", () => {
  const example = createExpenseExample(comparison);
  expect(example.valueCzk).toBe(100_000);
  expect(example.funds.map(({ ticker, annualCzk }) => ({ ticker, annualCzk })))
    .toEqual([{ ticker: "SPY", annualCzk: 94.5 }, { ticker: "VOO", annualCzk: 30 }]);
  expect(example.funds.map(({ source }) => source))
    .toEqual(comparison.funds.map(fund => fund.expense.source));
  const changed = structuredClone(comparison);
  changed.funds[1]!.expense.value = "0.04";
  expect(createExpenseExample(changed).funds[1]!.annualCzk).toBe(40);
});

test("invalid illustration inputs fail instead of publishing a plausible amount", () => {
  for (const value of [-1, Infinity, NaN])
    expect(() => annualFundExpenseCzk(value, "0.03")).toThrow();
  for (const rate of ["", "-0.03", "0.03%", "NaN", "Infinity"])
    expect(() => annualFundExpenseCzk(100_000, rate)).toThrow();
});
