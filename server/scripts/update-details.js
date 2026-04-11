/**
 * update-details.js
 * Оновлює кожен товар у Firestore:
 *   — опис (description)
 *   — повна галерея фото
 *   — для парфумів: об'єми з цінами (volumes), діапазон цін (priceMin/priceMax)
 *
 * Запуск: node server/scripts/update-details.js
 * Puppeteer має бути в devDependencies (npm install puppeteer --save-dev)
 */

require('dotenv').config();
const admin = require('firebase-admin');
const puppeteer = require('puppeteer');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
}
const db = admin.firestore();

const DELAY_MS = 900;
const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Парсинг ціни: "1 050,00 ₴" → 1050 ────────────────────────
function parsePrice(text) {
  const clean = String(text).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return Math.round(parseFloat(clean) || 0);
}

// ─── Отримати деталі однієї сторінки ────────────────────────────
async function getDetails(page, url, isPerfume) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
    await delay(700);

    return await page.evaluate((isPerfume) => {
      // --- Опис ---
      const descEl = document.querySelector(
        '.woocommerce-product-details__short-description, .nasa-short-description, [class*="short-description"]'
      );
      const description = descEl ? descEl.innerText.replace(/\s+/g, ' ').trim().slice(0, 1000) : '';

      // --- Галерея ---
      const images = [];
      document.querySelectorAll(
        '.woocommerce-product-gallery img, .nasa-product-gallery img, [class*="product-gallery"] img'
      ).forEach(img => {
        const src = img.getAttribute('data-large_image') || img.getAttribute('data-src') || img.src || '';
        if (src && src.includes('upload') && !images.includes(src)) images.push(src);
      });

      // --- Варіації з JSON (тільки для парфумів) ---
      let volumes = [];
      let priceMin = 0;
      let priceMax = 0;

      if (isPerfume) {
        // Зчитуємо лейбли з select
        const labelMap = {};
        document.querySelectorAll('.variations select option').forEach(opt => {
          if (opt.value && opt.value !== '') {
            labelMap[decodeURIComponent(opt.value)] = opt.textContent.trim();
          }
        });

        // JSON варіацій з WooCommerce
        const form = document.querySelector('form.variations_form');
        if (form) {
          try {
            const vars = JSON.parse(form.getAttribute('data-product_variations') || '[]');
            vars.forEach(v => {
              const slug = decodeURIComponent(Object.values(v.attributes || {})[0] || '');
              const label = labelMap[slug] || slug;
              const price = v.display_price || 0;
              if (label && price > 0) {
                volumes.push({ label: label.replace(/\s+/g, ' ').trim(), price });
              }
            });
            // Сортуємо: спочатку великі флакони (дорожчі), потім розлив
            volumes.sort((a, b) => b.price - a.price);
            const prices = volumes.map(v => v.price);
            if (prices.length > 0) {
              priceMin = Math.min(...prices);
              priceMax = Math.max(...prices);
            }
          } catch {}
        }

        // Якщо варіацій немає — беремо ціну зі сторінки
        if (volumes.length === 0) {
          const priceEl = document.querySelector('.price .woocommerce-Price-amount');
          if (priceEl) {
            const txt = priceEl.textContent.replace(/\s/g,'').replace(',','.').replace(/[^\d.]/g,'');
            priceMin = priceMax = Math.round(parseFloat(txt) || 0);
          }
        }
      }

      return { description, images, volumes, priceMin, priceMax };
    }, isPerfume);

  } catch (err) {
    return null;
  }
}

// ─── MAIN ────────────────────────────────────────────────────────
async function main() {
  console.log('📥 Завантаження товарів з Firestore...');
  const snap = await db.collection('products').get();
  const products = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const withUrl = products.filter(p => p.sourceUrl);
  console.log(`📦 Всього: ${products.length} | Мають URL: ${withUrl.length}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  let updated = 0;
  let failed = 0;
  let noChange = 0;
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;

  const flush = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  for (let i = 0; i < withUrl.length; i++) {
    const p = withUrl[i];
    const isPerfume = p.category === 'perfumes';
    process.stdout.write(`\r  ${i + 1}/${withUrl.length}  ${p.name?.slice(0, 55).padEnd(55)}`);

    const details = await getDetails(page, p.sourceUrl, isPerfume);
    if (!details) { failed++; await delay(DELAY_MS); continue; }

    const update = {};

    // Оновлюємо опис якщо порожній
    if (details.description && (!p.description || p.description.length < 10)) {
      update.description = details.description;
    }

    // Оновлюємо фото якщо нові знайшлись
    if (details.images.length > 0) {
      update.images = details.images;
    }

    // Для парфумів — об'єми і ціни
    if (isPerfume) {
      if (details.volumes.length > 0) update.volumes = details.volumes;
      if (details.priceMin > 0) update.priceMin = details.priceMin;
      if (details.priceMax > 0) update.priceMax = details.priceMax;
      // Встановлюємо основну ціну як мінімальну (для сортування)
      if (details.priceMin > 0) update.price = details.priceMin;
    }

    if (Object.keys(update).length === 0) { noChange++; await delay(DELAY_MS); continue; }

    batch.update(p.ref, update);
    batchCount++;
    updated++;

    if (batchCount >= BATCH_SIZE) {
      await flush();
      console.log(`\n  💾 Збережено ${updated} записів...`);
    }

    await delay(DELAY_MS);
  }

  await flush();
  await browser.close();

  console.log(`\n\n═══════════════════════════════`);
  console.log(`✅ Оновлено:     ${updated} товарів`);
  console.log(`⏭  Без змін:     ${noChange} товарів`);
  console.log(`❌ Помилок:      ${failed} товарів`);
  console.log(`📦 Всього:       ${withUrl.length} товарів`);
  console.log(`═══════════════════════════════`);
  console.log('🎉 Готово!');
  process.exit(0);
}

main().catch(err => { console.error('\n❌ Критична помилка:', err.message); process.exit(1); });
