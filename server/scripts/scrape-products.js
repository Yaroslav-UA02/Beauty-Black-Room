require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const admin = require('firebase-admin');
const puppeteer = require('puppeteer');

// Init Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}
const db = admin.firestore();

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BASE_URL = 'https://www.black-room.com.ua';
const DELAY_MS = 2000;

const CATEGORY_MAP = [
  { name: 'Обличчя',  firestoreId: 'face',     url: '/product-category/oblychchya/' },
  { name: 'Волосся',  firestoreId: 'hair',     url: '/product-category/volossya/' },
  { name: 'Тіло',     firestoreId: 'body',     url: '/product-category/tilo/' },
  { name: 'Чоловіки', firestoreId: 'men',      url: '/product-category/choloviky/' },
  { name: 'Парфуми',  firestoreId: 'perfumes', url: '/product-category/parfume/' },
  { name: 'Дім',      firestoreId: 'home',     url: '/product-category/dim/' },
  { name: 'Діти',     firestoreId: 'kids',     url: '/product-category/dity/' },
  { name: 'Розпродаж',firestoreId: 'sale',     url: '/sale/' },
];
// ─────────────────────────────────────────────────────────────────────────────

const delay = ms => new Promise(r => setTimeout(r, ms));

async function scrapeCategory(page, cat) {
  console.log(`\n📂 Категорія: ${cat.name}`);
  const allProducts = [];
  let pageNum = 1;
  let pageUrl = `${BASE_URL}${cat.url}`;

  while (pageUrl) {
    console.log(`  📄 Сторінка ${pageNum}: ${pageUrl}`);
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(1000);

      const { products, nextUrl } = await page.evaluate(() => {
        const items = [];

        // Картки товарів — li.product-warp-item
        const cards = document.querySelectorAll('li.product-warp-item');

        for (const card of cards) {
          // Посилання з назвою — в .product-info-wrap
          const infoWrap = card.querySelector('.product-info-wrap');
          if (!infoWrap) continue;

          const titleLink = infoWrap.querySelector('a[href*="/product/"]');
          if (!titleLink) continue;

          const href = titleLink.href;
          const name = titleLink.textContent.trim();
          if (!name || name.length < 3) continue;

          // Фото — в .product-img-wrap
          const imgWrap = card.querySelector('.product-img-wrap');
          const img = imgWrap ? imgWrap.querySelector('img') : null;
          const image = img ? (img.getAttribute('data-src') || img.src || '') : '';

          // Ціна
          const priceEl = card.querySelector('.woocommerce-Price-amount, .price ins .amount, .price .amount');
          const priceText = priceEl ? priceEl.textContent.trim() : '0';
          const price = parseInt(priceText.replace(/[^\d]/g, ''), 10) || 0;

          // Бренд
          const brandEl = card.querySelector('a[href*="/product-brand/"]');
          const brand = brandEl ? brandEl.textContent.trim() : '';

          // В наявності
          const productDiv = card.querySelector('.product');
          const outOfStock = productDiv ?
            productDiv.className.includes('outofstock') : false;

          items.push({ name, price, image, brand, href, outOfStock });
        }

        // Наступна сторінка
        const nextEl = document.querySelector('a.next, .next > a, .nasa-pagination a.next');
        const nextUrl = nextEl ? nextEl.href : null;

        return { products: items, nextUrl };
      });

      console.log(`     Знайдено: ${products.length} товарів`);

      for (const p of products) {
        allProducts.push({
          name: p.name,
          price: p.price,
          category: cat.firestoreId,
          images: p.image ? [p.image] : [],
          inStock: !p.outOfStock,
          featured: false,
          brand: p.brand,
          description: '',
          sourceUrl: p.href,
          createdAt: new Date().toISOString(),
        });
      }

      pageUrl = nextUrl || null;
      pageNum++;
      await delay(DELAY_MS);

    } catch (err) {
      console.error(`  ❌ Помилка: ${err.message}`);
      break;
    }
  }

  return allProducts;
}

async function scrapeProductDetails(page, product) {
  try {
    await page.goto(product.sourceUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(800);

    const details = await page.evaluate(() => {
      // Опис
      const descEl = document.querySelector('.woocommerce-product-details__short-description, .product-description, [class*="short-description"]');
      const description = descEl ? descEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 600) : '';

      // Всі фото з галереї
      const images = [];
      document.querySelectorAll('.woocommerce-product-gallery img, .product-gallery img, figure img').forEach(img => {
        const src = img.getAttribute('data-large_image') || img.getAttribute('data-src') || img.src;
        if (src && src.includes('wp-content') && !images.includes(src)) images.push(src);
      });

      // Бренд
      const brandEl = document.querySelector('a[href*="/product-brand/"]');
      const brand = brandEl ? brandEl.textContent.trim() : '';

      return { description, images, brand };
    });

    if (details.description) product.description = details.description;
    if (details.images.length > 0) product.images = details.images;
    if (details.brand && !product.brand) product.brand = details.brand;

  } catch (err) {
    // Не критично — продовжуємо без деталей
  }
  return product;
}

async function saveToFirestore(products) {
  const batchSize = 400;
  let saved = 0;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = db.batch();
    products.slice(i, i + batchSize).forEach(p => {
      batch.set(db.collection('products').doc(), p);
    });
    await batch.commit();
    saved += Math.min(batchSize, products.length - i);
    console.log(`  💾 Збережено ${saved}/${products.length}`);
  }
}

async function saveCategories() {
  console.log('\n📁 Зберігаємо категорії...');
  const batch = db.batch();
  CATEGORY_MAP.forEach((cat, i) => {
    batch.set(db.collection('categories').doc(cat.firestoreId),
      { name: cat.name, slug: cat.firestoreId, order: i }, { merge: true });
  });
  await batch.commit();
  console.log('✅ Категорії збережено');
}

async function main() {
  console.log('🚀 Починаємо імпорт товарів з black-room.com.ua');
  console.log('ℹ️  Скрипт тільки ЧИТАЄ дані — старий сайт не зачіпається\n');

  await saveCategories();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  const allProducts = [];

  for (const cat of CATEGORY_MAP) {
    const products = await scrapeCategory(page, cat);
    allProducts.push(...products);
    console.log(`  ✅ ${cat.name}: ${products.length} товарів`);
  }

  console.log(`\n📊 Всього знайдено: ${allProducts.length} товарів`);

  if (allProducts.length > 0) {
    // Деталі для перших 150 товарів
    const limit = Math.min(150, allProducts.length);
    console.log(`🔍 Завантажуємо деталі (${limit} товарів)...`);
    for (let i = 0; i < limit; i++) {
      process.stdout.write(`\r  ${i + 1}/${limit} — ${allProducts[i].name.slice(0, 50)}`);
      allProducts[i] = await scrapeProductDetails(page, allProducts[i]);
      await delay(800);
    }
    console.log('\n');
  }

  await browser.close();

  if (allProducts.length > 0) {
    console.log('💾 Зберігаємо у Firestore...');
    await saveToFirestore(allProducts);
    console.log(`\n✅ Готово! Імпортовано ${allProducts.length} товарів`);
  } else {
    console.log('\n⚠️  Товарів не знайдено — перевір підключення до інтернету');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Критична помилка:', err.message);
  process.exit(1);
});
