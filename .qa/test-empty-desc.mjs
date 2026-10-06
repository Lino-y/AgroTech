export default async function run(page, ui) {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Login
  await page.locator('button', { hasText: 'Entrar' }).first().click().catch(() => { });
  await page.waitForTimeout(400);
  await page.fill('#loginEmail', 'demo@agrotech.com.br').catch(() => { });
  await page.fill('#loginPassword', 'demo123').catch(() => { });
  await page.locator('button[type=submit]').first().click().catch(() => { });
  await page.waitForTimeout(1500);

  // Lista os produtos que existem no catálogo renderizado
  const products = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.product-card')).map(c => ({
      title: c.getAttribute('data-title'),
      cat: c.getAttribute('data-category')
    }));
  });

  // Tenta abrir "Café Pilão" (o produto sem unit/location no db.json)
  const opened = await page.evaluate((names) => {
    const cards = Array.from(document.querySelectorAll('.product-card'));
    const target = cards.find(c => (c.getAttribute('data-title') || '').includes('Caf'));
    if (!target) return { found: false, names };
    const clickable = target.querySelector('[onclick^="openProductDetail"]') || target.querySelector('[onclick]');
    clickable?.click();
    return { found: true, clickedTitle: target.getAttribute('data-title') };
  }, products);

  await page.waitForTimeout(800);

  const modalText = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('div')).filter(d =>
      d.style && d.style.position === 'fixed' && d.style.zIndex === '999'
    );
    return dialogs.length ? dialogs[0].innerText : 'MODAL NAO ABERTO';
  });

  return { products, opened, modalText };
}