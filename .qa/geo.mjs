export default async function run(page, ui) {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  await page.locator('button', { hasText: 'Entrar' }).first().click().catch(() => { });
  await page.waitForTimeout(400);
  await page.fill('#loginEmail', 'demo@agrotech.com.br').catch(() => { });
  await page.fill('#loginPassword', 'demo123').catch(() => { });
  await page.locator('button[type=submit]').first().click().catch(() => { });
  await page.waitForTimeout(1500);

  // Abre o modal
  await page.evaluate(() => {
    const card = document.querySelector('.product-card div[onclick^="openProductDetail"]');
    card?.click();
  });
  await page.waitForTimeout(800);

  const geo = await page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll('div')).filter(d =>
      d.style && d.style.position === 'fixed' && d.style.zIndex === '999');
    if (!overlays.length) return { open: false };
    const overlay = overlays[0];
    const card = overlay.firstElementChild;
    const oRect = overlay.getBoundingClientRect();
    const cRect = card.getBoundingClientRect();
    return {
      open: true,
      overlay: { rect: [oRect.x, oRect.y, oRect.width, oRect.height] },
      card: { rect: [cRect.x, cRect.y, cRect.width, cRect.height], display: getComputedStyle(card).display, bg: getComputedStyle(card).backgroundColor },
      cardText: card.innerText.slice(0, 100),
      // O que está no ponto central do overlay?
      topElementAtCenter: (() => {
        const el = document.elementFromPoint(oRect.x + oRect.width / 2, oRect.y + oRect.height / 2);
        return el ? (el.className || el.tagName) + ' :: ' + (el.innerText || '').slice(0, 40) : 'nada';
      })(),
      appContainerStyle: (() => {
        const ac = document.getElementById('app-container');
        const cs = getComputedStyle(ac);
        return { overflow: cs.overflow, backdropFilter: cs.backdropFilter, transform: cs.transform, contain: cs.contain };
      })()
    };
  });

  return geo;
}