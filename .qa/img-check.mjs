export default async function run(page, ui) {
  const failedImgs = [];
  page.on('requestfailed', (r) => { if (r.resourceType() === 'image') failedImgs.push(r.url()); });
  const imgResponses = [];
  page.on('response', (r) => { if (r.request().resourceType() === 'image') imgResponses.push({ url: r.url().slice(0, 80), status: r.status() }); });

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
    document.querySelector('.product-card div[onclick^="openProductDetail"]')?.click();
  });
  await page.waitForTimeout(1500);

  const imgInfo = await page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll('div')).filter(d =>
      d.style && d.style.position === 'fixed' && d.style.zIndex === '999');
    if (!overlays.length) return { open: false };
    const card = overlays[0].firstElementChild;
    const img = card.querySelector('img');
    const box = card.querySelector('div > div'); // container da imagem
    return {
      open: true,
      hasImgTag: !!img,
      imgSrc: img?.getAttribute('src')?.slice(0, 90),
      imgComplete: img?.complete,
      imgNaturalW: img?.naturalWidth,
      imgRect: img ? (r => [r.x, r.y, r.width, r.height])(img.getBoundingClientRect()) : null,
      boxHTML: box ? box.outerHTML.slice(0, 400) : 'sem box'
    };
  });

  return { failedImgs, imgResponses, imgInfo };
}