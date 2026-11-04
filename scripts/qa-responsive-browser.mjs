// Headless Chrome, fresh profile: never connects a wallet or signs transactions.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const loadPlaywright = createRequire(import.meta.url);
const { chromium } = loadPlaywright(process.env.ZINC_QA_PLAYWRIGHT || "playwright");
const base = process.env.ZINC_QA_URL || "http://127.0.0.1:3000";
const output = path.resolve("data", `responsive-qa-${Date.now()}`);
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  try {
    const context = await browser.newContext({ reducedMotion: "no-preference" });
    const page = await context.newPage();
    const routes = ["/", "/campaigns", "/campaigns/new", "/campaigns/7", "/rights/campaign%3A7%3Aright%3A0", "/nfts", "/earnings", "/transactions", "/settings"];
    for (const width of process.argv.includes("--motion-only") ? [] : [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of routes) {
        const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
        assert.equal(response.status(), 200, `${width} ${route}: HTTP status`);
        await page.locator("#zinc-content").waitFor();
        await page.waitForTimeout(route === "/" ? 2500 : 500);
        const measurements = await page.evaluate(() => {
          const nav = document.querySelector('[aria-label="Mobile navigation"]');
          const bounds = nav.getBoundingClientRect();
          return { width: innerWidth, contentWidth: document.documentElement.scrollWidth,
            navVisible: getComputedStyle(nav).display !== "none", navBottom: bounds.bottom,
            navHeight: bounds.height, links: nav.querySelectorAll("a").length,
            bottomSpace: parseFloat(getComputedStyle(document.querySelector('header').parentElement).paddingBottom) };
        });
        await page.screenshot({ path: path.join(output, `${width}-${route === "/" ? "overview" : route.replace(/[^a-zA-Z0-9]/g, "_")}.png`), fullPage: true });
        if ((width === 320 || width === 390) && route === "/") await page.screenshot({ path: path.join(output, `${width}-overview-viewport.png`) });
        assert.ok(measurements.contentWidth <= width + 1, `${width} ${route}: page overflows to ${measurements.contentWidth}px`);
        assert.equal(measurements.navVisible, width < 768, `${width} ${route}: navigation breakpoint`);
        if (width < 768) {
          assert.equal(measurements.links, 6);
          assert.ok(measurements.navHeight <= 80, `${width} ${route}: navigation too tall (${measurements.navHeight}px)`);
          assert.ok(Math.abs(measurements.navBottom - 844) <= 1, "phone navigation stays at bottom");
          assert.ok(measurements.bottomSpace >= measurements.navHeight, "content clears bottom navigation");
        }
        results.push({ width, route, ...measurements });
        fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ status: "RUNNING", results }, null, 2));
        console.log(`PASS: ${width}px ${route}`);
      }
    }
    // This isolated fixture imports the real NFT card with production CSS.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:3102/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.getElementById("summary")?.dataset.status, undefined, { timeout: 30_000 });
    assert.equal(await page.locator("#summary").getAttribute("data-status"), "PASS", await page.locator("#outcome").textContent());
    const dot = page.locator(".zinc-right-electron").first();
    const first = await dot.evaluate(el => getComputedStyle(el).offsetDistance);
    await page.waitForTimeout(500);
    const second = await dot.evaluate(el => getComputedStyle(el).offsetDistance);
    assert.notEqual(first, second, "NFT dot moves along its orbit");
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await dot.evaluate(el => getComputedStyle(el).animationName), "none", "reduced motion stops dot");
    assert.equal(await page.locator(".zinc-right-orbits").first().evaluate(el => getComputedStyle(el).animationName), "none");
    await page.screenshot({ path: path.join(output, "390-nft-motion-reduced.png"), fullPage: true });
    fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ status: "PASS", results, motion: "orbit movement and reduced-motion stop passed", capturedAt: new Date().toISOString(), walletConnected: false }, null, 2));
    console.log(`PASS: ${results.length} responsive route checks, orbit movement and reduced motion. Evidence: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { fs.writeFileSync(path.join(output, "failure.txt"), String(error.stack)); console.error(error); process.exitCode = 1; });
