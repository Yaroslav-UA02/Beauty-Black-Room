/**
 * scrape-missing.js
 * Скрапить каталог black-room.com.ua і додає тільки ті товари,
 * яких ще немає у Firestore (порівнює по назві).
 *
 * Запуск: node server/scripts/scrape-missing.js
 */

require('dotenv').config();
const admin = require('firebase-admin');
const puppeteer = require('puppeteer');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
}
const db = admin.firestore();

const BASE_URL = 'https://www.black-room.com.ua';
const DELAY_MS = 1200;
const delay = ms => new Promise(r => setTimeout(r, ms));

const CATEGORY_MAP = [
  { name: 'Обличчя',   firestoreId: 'face',     url: '/product-category/oblychchya/' },
  { name: 'Волосся',   firestoreId: 'hair',     url: '/product-category/volossya/' },
  { name: 'Тіло',      firestoreId: 'body',     url: '/product-category/tilo/' },
  { name: 'Чоловіки',  firestoreId: 'men',      url: '/product-category/choloviky/' },
  { name: 'Парфуми',   firestoreId: 'perfumes', url: '/product-category/parfume/' },
  { name: 'Дім',       firestoreId: 'home',     url: '/product-category/dim/' },
  { name: 'Діти',      firestoreId: 'kids',     url: '/product-category/dity/' },
  { name: 'Розпродаж', firestoreId: 'sale',     url: '/sale/' },
];

// Правильний парсинг ціни: "1 050,00 ₴" → 1050
function parsePrice(text) {
  const clean = String(text).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return Math.round(parseFloat(clean) || 0);
}

// ─── Скрапинг однієї категорії ────────────────────────────────────
async function scrapeCategory(page, cat) {
  const all = [];
  let pageUrl = `${BASE_URL}${cat.url}`;
  let pageNum = 1;

  while (pageUrl) {
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(800);

      const { items, nextUrl } = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('li.product-warp-item').forEach(card => {
          const infoWrap = card.querySelector('.product-info-wrap');
          if (!infoWrap) return;
          const titleLink = infoWrap.querySelector('a[href*="/product/"]');
          if (!titleLink) return;

          const name = titleLink.textContent.trim();
          if (!name || name.length < 3) return;

          const imgWrap = card.querySelector('.product-img-wrap');
          const img = imgWrap?.querySelector('img');
          const image = img ? (img.getAttribute('data-src') || img.src || '') : '';

          // Ціна — перший .woocommerce-Price-amount
          const priceEl = card.querySelector('.woocommerce-Price-amount');
          const priceText = priceEl ? priceEl.textContent.trim() : '0';

          const brandEl = card.querySelector('a[href*="/product-brand/"]');
          const brand = brandEl ? brandEl.textContent.trim() : '';

          const outOfStock = card.querySelector('.product')?.className?.includes('outofstock') || false;

          items.push({ name, priceText, image, brand, href: titleLink.href, outOfStock });
        });

        const nextEl = document.querySelector('a.next, .next > a, .nasa-pagination a.next');
        return { items, nextUrl: nextEl ? nextEl.href : null };
      });

      all.push(...items);
      console.log(`    Стор.${pageNum}: ${items.length} товарів`);

      pageUrl = nextUrl;
      pageNum++;
      await delay(DELAY_MS);

    } catch (err) {
      console.error(`  ❌ Сторінка ${pageNum}: ${err.message}`);
      break;
    }
  }

  return all;
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('📥 Завантаження існуючих товарів з Firestore...');
  const snap = await db.collection('products').get();

  // Нормалізована назва для порівняння
  const normalize = s => s?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
  const existingNames = new Set(snap.docs.map(d => normalize(d.data().name)));
  console.log(`  ✅ Знайдено у Firestore: ${existingNames.size} товарів\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  const newProducts = [];

  for (const cat of CATEGORY_MAP) {
    console.log(`\n📂 ${cat.name} (${BASE_URL}${cat.url})`);
    const items = await scrapeCategory(page, cat);

    const missing = items.filter(p => !existingNames.has(normalize(p.name)));
    console.log(`  📊 Всього на сайті: ${items.length} | Вже є: ${items.length - missing.length} | Нових: ${missing.length}`);

    missing.forEach(p => {
      newProducts.push({
        name: p.name,
        price: parsePrice(p.priceText),
        category: cat.firestoreId,
        images: p.image ? [p.image] : [],
        inStock: !p.outOfStock,
        featured: false,
        brand: p.brand || '',
        description: '',
        sourceUrl: p.href,
        createdAt: new Date().toISOString(),
      });
    });
  }

  await browser.close();

  console.log(`\n\n📊 Знайдено нових товарів: ${newProducts.length}`);

  if (newProducts.length === 0) {
    console.log('✅ Всі товари вже є у Firestore! Нічого додавати.');
    process.exit(0);
  }

  // Показуємо приклади
  console.log('\nПриклади нових товарів:');
  newProducts.slice(0, 10).forEach(p => {
    console.log(`  [${p.category}] ${p.price} ₴ | ${p.name.slice(0, 60)}`);
  });

  console.log('\n💾 Зберігаємо у Firestore...');
  const BATCH = 400;
  let saved = 0;
  for (let i = 0; i < newProducts.length; i += BATCH) {
    const batch = db.batch();
    newProducts.slice(i, i + BATCH).forEach(p => {
      batch.set(db.collection('products').doc(), p);
    });
    await batch.commit();
    saved += Math.min(BATCH, newProducts.length - i);
    console.log(`  💾 ${saved}/${newProducts.length} збережено`);
  }

  console.log(`\n✅ Додано ${newProducts.length} нових товарів!`);
  console.log('ℹ️  Тепер запусти update-details.js щоб отримати описи та фото для нових товарів');
  process.exit(0);
}

main().catch(err => { console.error('\n❌ Критична помилка:', err.message); process.exit(1); });
