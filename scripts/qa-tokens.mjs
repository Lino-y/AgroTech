// QA descartável: valida tokens nos 3 viewports (RNF01). Uso:
// node <skill>/browser.mjs http://localhost:3001 --script scripts/qa-tokens.mjs
export default async function run(page) {
  const results = [];
  for (const size of [{ w: 360 }, { w: 430 }, { w: 1280 }]) {
    await page.setViewportSize({ width: size.w, height: 800 });
    await page.reload();
    await page.waitForTimeout(400);
    const nav = await page.evaluate(() => {
      const el = document.querySelector('nav');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    results.push({ viewport: size.w, nav });
  }
  return results;
}
