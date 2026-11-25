// Clicks through nav tabs like a real user (full page loads), then uses SPA tabs (client-side navigation).
async function clickTabs(page, vuContext, events, test) {
  const step = test?.step ?? (async (_n, fn) => fn());
  await step("home", async () => { await page.goto("/"); await page.waitForLoadState("load"); });
  await page.waitForTimeout(300);
  await step("news", async () => { await page.click("#t-news"); await page.waitForURL("**/news"); await page.waitForLoadState("load"); });
  await page.waitForTimeout(300);
  await step("sport", async () => { await page.click("#t-sport"); await page.waitForURL("**/sport"); await page.waitForLoadState("load"); });
  await page.waitForTimeout(300);
  await step("search", async () => { await page.click("#t-search"); await page.waitForURL("**/search**"); await page.waitForLoadState("load"); });
  await page.waitForTimeout(300);
  await step("app", async () => { await page.click("#t-app"); await page.waitForURL("**/app"); await page.waitForLoadState("load"); });
  await page.waitForTimeout(300);
  await step("app_reports_tab", async () => { await page.click("#tab-a"); await page.waitForURL("**/app/reports"); });
  await page.waitForTimeout(300);
  await step("app_settings_tab", async () => { await page.click("#tab-b"); await page.waitForURL("**/app/settings"); });
  await page.waitForTimeout(300);
  // Give LCP/CLS/INP a chance to flush via visibility change before the VU ends
  await page.goto("about:blank");
}
// Same flow without steps
async function clickTabsNoSteps(page, vuContext, events) { return clickTabs(page, vuContext, events, undefined); }
// A flow with a failing assertion
const { expect } = require("@playwright/test");
async function failingAssertion(page) {
  await page.goto("/news");
  await expect(page.locator("h1")).toHaveText("Weather", { timeout: 1000 });
}
module.exports = { clickTabs, clickTabsNoSteps, failingAssertion };
