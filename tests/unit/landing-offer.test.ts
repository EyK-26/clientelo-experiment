import { expect, test } from "bun:test";
import { EtaViewEngine, ViewRenderer } from "@getstrata/core/view";
import { comparison } from "../../src/content/etf-comparison";
import { worksheet } from "../../src/content/worksheet";

const views = new ViewRenderer(
  new EtaViewEngine(new URL("../../views", import.meta.url).pathname),
  "layouts/etf-content.eta",
);

test("public preview contains sourced worked answers and the offer without unlocking the resource", async () => {
  const response = await views.render("etf-comparison.eta", {
    data: comparison, worksheet, qualification: false, contactEnabled: false,
    date: (value: string | null) => value ?? "datum neuvedeno",
    layout: { title: "Preview" },
  });
  const html = await response.text();
  for (const fund of comparison.funds) {
    expect(html).toContain(fund.cusip.value);
    expect(html).toContain(comparison.sources[fund.expense.source]!.url);
  }
  for (const question of worksheet.questions) expect(html).toContain(question.title);
  expect(html).toContain("94,50");
  expect(html).toContain("30,00");
  expect(html).not.toContain("<form");
  expect(html).not.toContain('id="worksheet-access"');
});

test("demo admission stays explicit beside the form and the useful preview comes first", async () => {
  const response = await views.render("etf-comparison.eta", {
    data: comparison, worksheet, qualification: true, contactEnabled: true,
    email: "", error: "", resource: "", action: "/etf", csrfToken: "fixture",
    date: (value: string | null) => value ?? "datum neuvedeno",
    layout: { title: "Synthetic demo" },
  });
  const html = await response.text();
  expect(html.indexOf("94,50")).toBeLessThan(html.indexOf("<form"));
  expect(html.slice(html.indexOf('id="contact-step"'))).toContain("@example.test");
  expect(html).toContain('id="demo-details"');
  expect(html).not.toContain('id="worksheet-access"');
});
