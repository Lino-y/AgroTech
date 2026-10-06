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

  // Abre o detalhe via snapshot+ref (mais confiável)
  const snap = await ui.snapshot();
  // Clica no primeiro elemento clicável dentro do card — o título do produto
  const titleMatch = snap.match(/@(e\d+) \S+ "Ração Bovinos Corte 30kg"/);
  let opened = 'pelos refs não achei título';
  if (titleMatch) {
    await ui.click(titleMatch[1]).catch(e => { opened = 'erro click: ' + e.message; });
    await page.waitForTimeout(800);
  }

  // Lê TODO o texto do modal
  const modal = await page.evaluate(() => {
    // acha o container fixed do modal
    const dialogs = Array.from(document.querySelectorAll('div')).filter(d =>
      d.style && d.style.position === 'fixed' && d.style.zIndex === '999'
    );
    if (!dialogs.length) return { open: false, bodyText: document.body.innerText.slice(-400) };
    return { open: true, text: dialogs[0].innerText };
  });

  return { opened, snapHasTitle: !!titleMatch, modal };
}