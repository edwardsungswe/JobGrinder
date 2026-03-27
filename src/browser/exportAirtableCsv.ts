import { rename } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Download, type Locator, type Page } from "playwright";
import type { AppEnv } from "../types/config.js";
import { ensureDir } from "../utils/fs.js";
import type { Logger } from "../utils/logger.js";

async function clickFirstVisible(locators: Locator[]): Promise<boolean> {
  for (const locator of locators) {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ timeout: 5_000 });
        return true;
      }
    }
  }

  return false;
}

async function waitForGridToolbar(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    const text = document.body.innerText.toLowerCase();
    return text.includes("hide fields") && text.includes("filter") && text.includes("sort");
  }, undefined, { timeout: 20_000 });
}

function menuButtonLocators(page: Page): Locator[] {
  return [
    page.getByText("...", { exact: true }),
    page.getByRole("button", { name: /view options|more actions|expand|share and sync/i }),
    page.locator("[aria-label*='More']"),
    page.locator("[data-testid*='more']"),
    page.locator("button").filter({ hasText: /^\.\.\.$/ }),
    page.locator("button:has-text('...')"),
    page.locator("div").filter({ hasText: /^\.\.\.$/ }),
    page.locator("button").filter({ has: page.locator("svg") }),
  ];
}

function downloadActionLocators(page: Page): Locator[] {
  return [
    page.getByRole("menuitem", { name: /download csv/i }),
    page.getByRole("button", { name: /download csv/i }),
    page.getByText(/download csv/i, { exact: false }),
    page.locator("[data-testid*='download']").filter({ hasText: /csv/i }),
  ];
}

async function exportCsv(page: Page, logger: Logger): Promise<Download> {
  logger.info("Opening Airtable export menu");
  const opened = await clickFirstVisible(menuButtonLocators(page));
  if (!opened) {
    throw new Error("Could not find Airtable menu button for CSV export.");
  }

  await page.waitForTimeout(400);
  logger.info("Clicking Download CSV");
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  const clicked = await clickFirstVisible(downloadActionLocators(page));
  if (!clicked) {
    throw new Error("Could not find Airtable CSV download action.");
  }
  const download = await downloadPromise;
  logger.info("CSV download started");
  return download;
}

async function ensureLoggedIn(context: BrowserContext, page: Page): Promise<void> {
  await page.goto("https://airtable.com", { waitUntil: "domcontentloaded" });
  if (!page.url().includes("login")) {
    return;
  }

  console.log("Complete Airtable login in the opened browser, then press Enter here to continue.");
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });
  await context.storageState();
}

export async function exportAirtableCsv(params: {
  cwd: string;
  env: AppEnv;
  logger: Logger;
}): Promise<string> {
  const downloadDir = path.resolve(params.cwd, params.env.JOBGRINDER_DOWNLOAD_DIR);
  const profileDir = path.resolve(params.cwd, params.env.JOBGRINDER_PLAYWRIGHT_PROFILE);
  const rawDir = path.resolve(params.cwd, "data", "raw");

  await ensureDir(downloadDir);
  await ensureDir(profileDir);
  await ensureDir(rawDir);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: params.env.JOBGRINDER_HEADLESS,
    acceptDownloads: true,
    downloadsPath: downloadDir,
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await ensureLoggedIn(context, page);
    params.logger.info("Opening Airtable view");
    await page.goto(params.env.JOBGRINDER_AIRTABLE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    params.logger.info("Waiting for grid toolbar");
    await waitForGridToolbar(page);

    const download = await exportCsv(page, params.logger);
    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error("Playwright download path was not available.");
    }

    const targetPath = path.join(rawDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-airtable-export.csv`);
    await rename(downloadPath, targetPath);
    params.logger.info("CSV export completed", { targetPath });
    return targetPath;
  } finally {
    await context.close();
  }
}
