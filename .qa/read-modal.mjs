export default async function run(page, ui) {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  await page.locator('button', { hasText: 'Entrar' }).first().click().catch(() => { });
  await page.waitForTimeout(400);
  await page.fill('#loginEmail', 'demo@agrotech.com.br').catch(() => { });
  await page.fill('#loginPassword', 'demo123').catch(() => { });
  await page.locator('button[type=submit]').first().click().catch(() => { });
  await page.waitForTimeout(1500);

  // Clica no card pelo DOM diretamente
  await page.evaluate(() => {
    const card = document.querySelector('.product-card [onclick^="openProductDetail"]')
      || document.querySelector('.product-card div[onclick]');
    card?.click();
  });
  await page.waitForTimeout(900);

  const modalText = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('div')).filter(d =>
      d.style && d.style.position === 'fixed' && d.style.zIndex === '999'
    );
    return dialogs.length ? dialogs[0].innerText : 'MODAL NAO ABERTO';
  });

  return { modalText };
}