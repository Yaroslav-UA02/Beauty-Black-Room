/**
 * update-perfumes.js — оновлює ТІЛЬКИ парфуми (276 шт.)
 * Додає: volumes, priceMin, priceMax, description, images
 * Запуск: node server/scripts/update-perfumes.js
 */
require('dotenv').config();
const admin = require('firebase-admin');
const puppeteer = require('puppeteer');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
}
const db = admin.firestore();

const delay = ms => new Promise(r => setTimeout(r, ms));

async function getDetails(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await delay(600);

    return await page.evaluate(() => {
      // Опис
      const descEl = document.querySelector(
        '.woocommerce-product-details__short-description, .nasa-short-description, [class*="short-description"]'
      );
      const description = descEl ? descEl.innerText.replace(/\s+/g, ' ').trim().slice(0, 1000) : '';

      // Галерея
      const images = [];
      document.querySelectorAll('.woocommerce-product-gallery img, .nasa-product-gallery img, [class*="product-gallery"] img').forEach(img => {
        const src = img.getAttribute('data-large_image') || img.getAttribute('data-src') || img.src || '';
        if (src && src.includes('upload') && !images.includes(src)) images.push(src);
      });

      // Варіації (JSON)
      let volumes = [], priceMin = 0, priceMax = 0;
      const labelMap = {};
      document.querySelectorAll('.variations select option').forEach(opt => {
        if (opt.value) labelMap[decodeURIComponent(opt.value)] = opt.textContent.trim();
      });
      const form = document.querySelector('form.variations_form');
      if (form) {
        try {
          const vars = JSON.parse(form.getAttribute('data-product_variations') || '[]');
          vars.forEach(v => {
            const slug = decodeURIComponent(Object.values(v.attributes || {})[0] || '');
            const label = labelMap[slug] || slug;
            const price = v.display_price || 0;
            if (label && price > 0) volumes.push({ label: label.trim(), price });
          });
          volumes.sort((a, b) => b.price - a.price);
          if (volumes.length) {
            priceMin = Math.min(...volumes.map(v => v.price));
            priceMax = Math.max(...volumes.map(v => v.price));
          }
        } catch {}
      }

      // Якщо немає варіацій — одна ціна
      if (!volumes.length) {
        const priceEl = document.querySelector('.price .woocommerce-Price-amount');
        if (priceEl) {
          const txt = priceEl.textContent.replace(/\s/g,'').replace(',','.').replace(/[^\d.]/g,'');
          priceMin = priceMax = Math.round(parseFloat(txt) || 0);
        }
      }

      return { description, images, volumes, priceMin, priceMax };
    });
  } catch {
    return null;
  }
}

async function main() {
  console.log('📥 Завантаження парфумів...');
  const snap = await db.collection('products').where('category', '==', 'perfumes').get();
  const perfumes = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() })).filter(p => p.sourceUrl);
  console.log(`🌸 Знайдено ${perfumes.length} парфумів\n`);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  let updated = 0, failed = 0;
  const BATCH_SIZE = 50; // Записуємо кожні 50
  let batch = db.batch();
  let cnt = 0;

  const flush = async () => {
    if (cnt > 0) { await batch.commit(); batch = db.batch(); cnt = 0; }
  };

  for (let i = 0; i < perfumes.length; i++) {
    const p = perfumes[i];
    process.stdout.write(`\r  ${i+1}/${perfumes.length}  ${p.name?.slice(0,50).padEnd(50)}`);

    const d = await getDetails(page, p.sourceUrl);
    if (!d) { failed++; await delay(500); continue; }

    const update = {};
    if (d.description && (!p.description || p.description.length < 10)) update.description = d.description;
    if (d.images.length > 0) update.images = d.images;
    if (d.volumes.length > 0) update.volumes = d.volumes;
    if (d.priceMin > 0) { update.priceMin = d.priceMin; update.priceMax = d.priceMax; update.price = d.priceMin; }

    if (Object.keys(update).length > 0) {
      batch.update(p.ref, update);
      cnt++; updated++;
      if (cnt >= BATCH_SIZE) { await flush(); console.log(`\n  💾 ${updated} збережено...`); }
    }

    await delay(600);
  }

  await flush();
  await browser.close();

  console.log(`\n\n✅ Оновлено: ${updated} парфумів`);
  console.log(`❌ Помилок: ${failed}`);
  console.log('🎉 Готово! Відкрий будь-який парфум на сайті.');
  process.exit(0);
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
