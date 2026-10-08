import puppeteer, { type Browser, type Page } from "puppeteer-core";

export const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
export const WIDGET = "https://turnigo-widget.lodesiko12.workers.dev";
export const PANEL = "https://turnigo-panel.lodesiko12.workers.dev";

export const MOBILE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
export const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2 };

export async function launch(opts: { headless?: boolean; userDataDir?: string } = {}): Promise<Browser> {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: opts.headless ?? true,
    userDataDir: opts.userDataDir,
    defaultViewport: null,
    protocolTimeout: 60_000,
    args: ["--no-first-run", "--no-default-browser-check"],
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Clic en el primer elemento clicable cuyo texto contiene `text`. */
export async function clickText(page: Page, text: string, selector = "button, a, [role=button], label, li, div"): Promise<boolean> {
  const ok = await page.evaluate(
    (t, sel) => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter(
        (e) => e.offsetParent !== null && (e.innerText || "").trim().toLowerCase().includes(t.toLowerCase()),
      );
      // el más interno (menos texto) para no pulsar un contenedor
      els.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);
      if (!els[0]) return false;
      els[0].click();
      return true;
    },
    text,
    selector,
  );
  await sleep(700);
  return ok;
}

export async function shot(page: Page, file: string, opts: { fullPage?: boolean } = {}) {
  await sleep(500);
  await page.screenshot({ path: file, fullPage: opts.fullPage ?? false });
  console.log("  ✓", file);
}

export async function dump(page: Page) {
  return page.evaluate(() => ({
    url: location.href,
    text: document.body.innerText.slice(0, 1500),
    buttons: Array.from(document.querySelectorAll<HTMLElement>("button, a, [role=button], select, input"))
      .filter((e) => e.offsetParent !== null)
      .map((e) => `${e.tagName.toLowerCase()}:${(e as HTMLInputElement).type ?? ""}:${(e.innerText || (e as HTMLInputElement).placeholder || e.getAttribute("aria-label") || "").trim().slice(0, 40)}`)
      .slice(0, 60),
  }));
}

/** Clic en el n-ésimo botón visible cuyo texto cumple la expresión regular. */
export async function clickRegex(page: Page, re: RegExp, nth = 0): Promise<boolean> {
  const ok = await page.evaluate(
    (src, flags, n) => {
      const rx = new RegExp(src, flags);
      const els = Array.from(document.querySelectorAll<HTMLElement>("button")).filter(
        (e) => e.offsetParent !== null && rx.test((e.innerText || "").trim()),
      );
      if (!els[n]) return false;
      els[n].click();
      return true;
    },
    re.source,
    re.flags,
    nth,
  );
  await sleep(900);
  return ok;
}

export async function typeInto(page: Page, placeholderOrLabel: string, value: string) {
  const handle = await page.evaluateHandle((t) => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"));
    return inputs.find((i) => (i.placeholder || "").includes(t) || (i.closest("label")?.textContent || "").includes(t)) ?? null;
  }, placeholderOrLabel);
  const el = handle.asElement();
  if (el) await (el as unknown as { type: (v: string) => Promise<void> }).type(value);
}
