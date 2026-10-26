// Isolated Chromium checks against the generated app on loopback, never a hosted load test.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_PACKAGE_PATH || "playwright",
);
const base = "http://127.0.0.1:4335";
const evidence = fileURLToPath(
  new URL("../../.private/browser-review", import.meta.url),
);
const pdfDir = fileURLToPath(new URL("../../.private/browser-review", import.meta.url));
await mkdir(pdfDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BINARY,
});
const observations = {
  scope:
    "headless Chromium emulation, generated native app, synthetic loopback fixture",
  layouts: [],
  checks: {},
  eventResponseStatuses: [],
  consoleErrors: [],
};
try {
  for (const width of [360, 390, 430, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => observations.consoleErrors.push(e.message));
    page.on("response", (r) => {
      if (new URL(r.url()).pathname.endsWith("/events"))
        observations.eventResponseStatuses.push(r.status());
    });
    await page.goto(
      base +
        "/etf?utm_source=demo&utm_medium=ad&utm_campaign=etf_compare&ad_variant=a",
    );
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heroActions: document.querySelectorAll(".hero > .action").length,
      buttonHeight: document
        .querySelector(".hero > .action")
        .getBoundingClientRect().height,
    }));
    assert.equal(layout.width, width);
    assert.equal(layout.scrollWidth, width);
    assert.equal(layout.heroActions, 1);
    assert(layout.buttonHeight >= 48);
    observations.layouts.push(layout);
    await page.screenshot({
      path: evidence + `product-${width}-2026-10-26.jpg`,
      type: "jpeg",
      quality: 85,
    });
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator(".skip-link")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    observations.checks.keyboardSkipLink = true;
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => observations.consoleErrors.push(e.message));
  page.on("response", (r) => {
    if (new URL(r.url()).pathname.endsWith("/events"))
      observations.eventResponseStatuses.push(r.status());
  });
  await page.goto(
    base +
      "/etf?utm_source=demo&utm_medium=ad&utm_campaign=etf_compare&ad_variant=b",
  );
  const input = page.locator("#worksheet-email");
  const submit = page.locator("form button");
  await input.fill("reader@example.org");
  await submit.click();
  await page.waitForFunction(() =>
    document
      .getElementById("form-status")
      .textContent.includes("@example.test"),
  );
  assert.equal(await input.inputValue(), "reader@example.org");
  assert.equal(await page.locator("#worksheet-access").count(), 0);
  assert.equal(
    await page
      .locator("#form-status")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  observations.checks.validationRetainsInputAndFocus = true;
  await page
    .locator("#contact-step")
    .screenshot({
      path: evidence + "product-error-390-2026-10-26.jpg",
      type: "jpeg",
      quality: 85,
    });
  await input.fill("reader@example.test");
  await page.locator('[name="_token"]').evaluate((el) => {
    el.value = "intentionally-invalid";
  });
  await submit.click();
  await page.waitForFunction(() =>
    document
      .getElementById("form-status")
      ?.textContent.includes("Formulář jsme obnovili"),
  );
  assert.equal(await input.inputValue(), "reader@example.test");
  assert.equal(await page.locator("#worksheet-access").count(), 0);
  observations.checks.nativeCsrfRefreshPreservesInputAndRequiresRetry = true;
  await submit.click();
  await page.waitForFunction(
    () => document.querySelector("form")?.getAttribute("aria-busy") === "true",
  );
  assert.equal(await submit.isDisabled(), true);
  assert.equal(await page.locator("#worksheet-access").count(), 0);
  await page
    .locator("#contact-step")
    .screenshot({
      path: evidence + "product-pending-390-2026-10-26.jpg",
      type: "jpeg",
      quality: 85,
    });
  await page.waitForFunction(
    () =>
      document
        .getElementById("form-status")
        ?.textContent.includes("nepodařilo"),
    { timeout: 15000 },
  );
  assert.equal(await input.inputValue(), "reader@example.test");
  assert.equal(await page.locator("#worksheet-access").count(), 0);
  assert.equal(await submit.isEnabled(), true);
  observations.checks.timeoutRetainsInputWithoutUnlock = true;
  await page.waitForTimeout(2500);
  await submit.click();
  await page.locator("#worksheet-access").waitFor();
  assert.equal(
    await page
      .locator("#contact-step")
      .innerText()
      .then((s) => s.includes("reader@example.test")),
    false,
  );
  observations.checks.lostResponseRetryRecoversWithoutDisclosingAddress = true;
  await page
    .locator("#contact-step")
    .screenshot({
      path: evidence + "product-accepted-390-2026-10-26.jpg",
      type: "jpeg",
      quality: 85,
    });
  await page.locator("#worksheet-access").click();
  await page.locator("[data-print-worksheet]").waitFor();
  assert.equal(await page.locator(".question").count(), 6);
  await page.evaluate(() => {
    window.__printObserved = false;
    window.addEventListener(
      "beforeprint",
      () => {
        window.__printObserved = true;
      },
      { once: true },
    );
  });
  await page.locator("[data-print-worksheet]").click();
  assert.equal(await page.evaluate(() => window.__printObserved), true);
  observations.checks.printActionInvokesBrowserPrint = true;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.pdf({
    path: pdfDir + "assignment-b-worksheet.pdf",
    format: "A4",
    printBackground: true,
    displayHeaderFooter: false,
    preferCSSPageSize: true,
  });
  observations.checks.browserPrintPdfGenerated = true;
  await context.close();
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 360, height: 844 },
  });
  const noJsPage = await noJs.newPage();
  await noJsPage.goto(base + "/etf");
  await noJsPage.locator("#worksheet-email").fill("nojs@example.org");
  await noJsPage.locator("form button").click();
  assert.equal(
    await noJsPage.locator("#worksheet-email").inputValue(),
    "nojs@example.org",
  );
  assert.equal(await noJsPage.locator("#worksheet-access").count(), 0);
  await noJsPage.locator("#worksheet-email").focus();
  await noJsPage.keyboard.press("ControlOrMeta+A");
  await noJsPage.keyboard.type("nojs@example.test");
  await noJsPage.keyboard.press("Tab");
  assert.equal(
    await noJsPage
      .locator("form button")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await noJsPage.keyboard.press("Enter");
  observations.checks.keyboardOnlyFormSubmission = true;
  await noJsPage.locator("#worksheet-access").click();
  assert.equal(await noJsPage.locator(".question").count(), 6);
  observations.checks.noJsValidationAcceptanceAndResource = true;
  await noJs.close();
  assert.deepEqual(observations.consoleErrors, []);
  assert(observations.eventResponseStatuses.length > 0);
  assert(observations.eventResponseStatuses.every((status) => status === 204));
  await writeFile(
    evidence + "browser-product-2026-10-26.json",
    JSON.stringify(observations, null, 2) + "\n",
  );
  process.stdout.write(JSON.stringify(observations) + "\n");
} finally {
  await browser.close();
}
