/**
 * update-descriptions.js — описи + фото для всіх НЕ-парфумів
 * Пропускає товари що вже мають опис.
 * Записує кожні 50 товарів.
 */
require('dotenv').config();
const admin = require('firebase-admin');
const puppeteer = require('puppeteer');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
}
const db = admin.firestore();
const delay = ms => new Promise(r => setTimeout(r, ms));

async function getDesc(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(400);
    return await page.evaluate(() => {
      const descEl = document.querySelector('.woocommerce-product-details__short-description, .nasa-short-description, [class*="short-description"]');
      const description = descEl ? descEl.innerText.replace(/\s+/g, ' ').trim().slice(0, 900) : '';
      const images = [];
      document.querySelectorAll('.woocommerce-product-gallery img, .nasa-product-gallery img, [class*="product-gallery"] img').forEach(img => {
        const src = img.getAttribute('data-large_image') || img.getAttribute('data-src') || img.src || '';
        if (src && src.includes('upload') && !images.includes(src)) images.push(src);
      });
      return { description, images };
    });
  } catch { return null; }
}

async function main() {
  console.log('📥 Завантаження товарів (не парфуми)...');
  const snap = await db.collection('products').get();
  const products = snap.docs
    .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter(p => p.sourceUrl && p.category !== 'perfumes' && (!p.description || p.description.length < 10));
  console.log(`📦 Без опису: ${products.length} товарів\n`);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  let updated = 0, failed = 0;
  let batch = db.batch();
  let cnt = 0;

  const flush = async () => {
    if (cnt > 0) { await batch.commit(); batch = db.batch(); cnt = 0; }
  };

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    process.stdout.write(`\r  ${i+1}/${products.length}  ${p.name?.slice(0,50).padEnd(50)}`);

    const d = await getDesc(page, p.sourceUrl);
    if (!d) { failed++; await delay(400); continue; }

    const update = {};
    if (d.description) update.description = d.description;
    if (d.images.length > 0) update.images = d.images;

    if (Object.keys(update).length > 0) {
      batch.update(p.ref, update);
      cnt++; updated++;
      if (cnt >= 50) { await flush(); console.log(`\n  💾 ${updated} збережено...`); }
    }
    await delay(500);
  }

  await flush();
  await browser.close();
  console.log(`\n\n✅ Оновлено: ${updated} | Помилок: ${failed}`);
  process.exit(0);
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
