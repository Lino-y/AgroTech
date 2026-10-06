export default async function run(page, ui) {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Trabalhar pelo DOM (compartilhado). Clicar em "Entrar"
  const tab = page.locator('button', { hasText: 'Entrar' }).first();
  await tab.click().catch(() => { });
  await page.waitForTimeout(500);

  // Preencher login demo
  await page.fill('#loginEmail', 'demo@agrotech.com.br').catch(() => { });
  await page.fill('#loginPassword', 'demo123').catch(() => { });
  await page.locator('button[type=submit]').first().click().catch(() => { });
  await page.waitForTimeout(1500);

  const afterLogin = await page.evaluate(() => document.body.innerText.slice(0, 120));

  // Clicar no primeiro produto do catálogo
  const firstCard = page.locator('.product-card').first();
  const hasCard = await firstCard.count();
  if (hasCard) {
    await firstCard.click({ position: { x: 20, y: 60 } }).catch(() => { });
    await page.waitForTimeout(800);
  }

  // Ler o DOM da descrição (compartilhado entre mundos)
  const domDesc = await page.evaluate(() => {
    const h4 = Array.from(document.querySelectorAll('h4'))
      .find(h => h.textContent.includes('DESCRIÇÃO'));
    if (!h4) return { found: false, bodySnip: document.body.innerText.slice(0, 200) };
    return { found: true, desc: h4.parentElement.querySelector('p')?.textContent };
  });

  return { afterLogin, hasCard, domDesc };
}