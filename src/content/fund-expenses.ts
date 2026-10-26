import type { Comparison } from "./etf-comparison";

const money = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Static illustration at unchanged value and exchange rate, not a return forecast. */
export function annualFundExpenseCzk(valueCzk: number, annualPercent: string): number {
  if (!Number.isFinite(valueCzk) || valueCzk < 0 || !/^\d+(?:\.\d+)?$/.test(annualPercent))
    throw new RangeError("Invalid fund-expense illustration");
  const result = valueCzk * Number(annualPercent) / 100;
  if (!Number.isFinite(result)) throw new RangeError("Invalid fund-expense illustration");
  return Math.round((result + Number.EPSILON) * 100) / 100;
}

export function createExpenseExample(data: Comparison, valueCzk = 100_000) {
  return {
    valueCzk,
    valueLabel: money.format(valueCzk),
    funds: data.funds.map(fund => {
      const annualCzk = annualFundExpenseCzk(valueCzk, fund.expense.value);
      return {
        ticker: fund.ticker,
        annualCzk,
        annualLabel: money.format(annualCzk),
        rateLabel: fund.expense.value.replace(".", ",") + " %",
        source: fund.expense.source,
        asOf: fund.expense.asOf,
      };
    }),
  };
}
