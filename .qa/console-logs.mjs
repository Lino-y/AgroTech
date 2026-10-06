export default async function run(page, ui) {
  const logs = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const probe = await page.evaluate(() => ({
    state: typeof window.state,
    nav: typeof window.navigateTo,
    open: typeof window.openProductDetail,
    // procura QUALQUER propriedade global que comece com ver
    customGlobals: Object.getOwnPropertyNames(window).filter(k =>
      ['state', 'navigateTo', 'openProductDetail', 'addToCart', 'handleLogin', 'applyCategoryFilter'].includes(k)
    ),
    bodyStart: document.body.innerText.slice(0, 80)
  }));

  return { logs, probe };
}