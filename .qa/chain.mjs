export default async function run(page, ui) {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('button', { hasText: 'Entrar' }).first().click().catch(() => { });
  await page.waitForTimeout(400);
  await page.fill('#loginEmail', 'demo@agrotech.com.br').catch(() => { });
  await page.fill('#loginPassword', 'demo123').catch(() => { });
  await page.locator('button[type=submit]').first().click().catch(() => { });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.querySelector('.product-card div[onclick^="openProductDetail"]')?.click(); });
  await page.waitForTimeout(1200);

  const chain = await page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll('div')).filter(d =>
      d.style && d.style.position === 'fixed' && d.style.zIndex === '999');
    const card = overlays[0].firstElementChild;
    const img = card.querySelector('img');
    const out = [];
    let el = img;
    while (el && el !== card) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      out.push({
        tag: el.tagName,
        cls: (el.getAttribute('style') || '').slice(0, 70),
        h: Math.round(r.height),
        cssH: cs.height,
        display: cs.display,
        flex: cs.flex,
        alignSelf: cs.alignSelf,
        alignItems: cs.alignItems,
        overflow: cs.overflow
      });
      el = el.parentElement;
    }
    return out;
  });

  return { chain };
}