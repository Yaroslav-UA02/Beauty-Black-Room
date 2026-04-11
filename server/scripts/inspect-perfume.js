/**
 * inspect-perfume.js — досліджує HTML структуру сторінки парфуму
 * Запуск: node server/scripts/inspect-perfume.js
 */
require('dotenv').config();
const puppeteer = require('puppeteer');

// Тестова сторінка парфуму
const TEST_URL = 'https://www.black-room.com.ua/product-category/parfume/';

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  // Спочатку знаходимо посилання на перший парфум
  console.log('🔍 Відкриваємо каталог парфумів...');
  await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  const perfumeUrl = await page.evaluate(() => {
    const link = document.querySelector('li.product-warp-item .product-info-wrap a[href*="/product/"]');
    return link ? link.href : null;
  });

  if (!perfumeUrl) {
    console.log('❌ Не знайдено жодного парфуму'); await browser.close(); process.exit(1);
  }
  console.log(`\n📄 Тестова сторінка: ${perfumeUrl}\n`);

  await page.goto(perfumeUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));

  const info = await page.evaluate(() => {
    const result = {};

    // --- Опис ---
    const descSelectors = [
      '.woocommerce-product-details__short-description',
      '.product-description',
      '[class*="short-description"]',
      '.product_description',
      '.nasa-short-description',
    ];
    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        result.description = { selector: sel, text: el.innerText.trim().slice(0, 200) };
        break;
      }
    }

    // --- Повний опис ---
    const fullDescSelectors = [
      '#tab-description .woocommerce-Tabs-panel--description',
      '.woocommerce-Tabs-panel--description',
      '#tab-description',
      '.product-tab-content',
    ];
    for (const sel of fullDescSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        result.fullDescription = { selector: sel, text: el.innerText.trim().slice(0, 200) };
        break;
      }
    }

    // --- Нотки аромату (всі можливі варіанти) ---
    const noteSelectors = [
      '[class*="note"]',
      '[class*="accord"]',
      '[class*="pyramid"]',
      '[class*="ingred"]',
      '[class*="fragrance"]',
      '[class*="scent"]',
      '.nasa-accordion',
      '.product-accords',
    ];
    result.notesSearch = [];
    noteSelectors.forEach(sel => {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        result.notesSearch.push({
          selector: sel,
          count: els.length,
          sample: els[0].className + ' | ' + els[0].innerText?.trim().slice(0, 80),
          hasImages: els[0].querySelectorAll('img').length > 0,
        });
      }
    });

    // --- Варіації/об'єми ---
    const variations = [];
    document.querySelectorAll('.variations select option').forEach(opt => {
      if (opt.value) variations.push({ value: opt.value, text: opt.textContent.trim() });
    });
    result.variations = variations;

    // Також перевіряємо кнопки варіацій
    const varButtons = [];
    document.querySelectorAll('[data-attribute_value], .variable-item').forEach(el => {
      varButtons.push({ class: el.className, text: el.textContent.trim().slice(0, 50), attr: el.getAttribute('data-attribute_value') });
    });
    result.varButtons = varButtons.slice(0, 10);

    // --- Ціни ---
    const prices = [];
    document.querySelectorAll('.woocommerce-Price-amount').forEach(el => {
      prices.push(el.textContent.trim());
    });
    result.prices = prices;

    // --- Всі класи у body (для пошуку специфічних елементів) ---
    const allClasses = new Set();
    document.querySelectorAll('*').forEach(el => {
      el.className?.toString().split(' ').forEach(c => { if (c.length > 3) allClasses.add(c); });
    });
    // Шукаємо класи зі словами notes/accord/fragrance/pyramid/ingred
    result.relevantClasses = [...allClasses].filter(c =>
      /note|accord|pyramid|fragrance|ingred|scent|aroma|parfum/i.test(c)
    ).slice(0, 30);

    // --- Зображення галереї ---
    const imgs = [];
    document.querySelectorAll('.woocommerce-product-gallery img, .product-gallery img, [class*="gallery"] img').forEach(img => {
      const src = img.getAttribute('data-large_image') || img.getAttribute('data-src') || img.src;
      if (src && src.includes('upload') && !imgs.includes(src)) imgs.push(src);
    });
    result.galleryImages = imgs.length;

    return result;
  });

  console.log('═══ РЕЗУЛЬТАТИ ІНСПЕКЦІЇ ═══\n');
  console.log('📝 Опис:', info.description || '❌ не знайдено');
  console.log('\n📄 Повний опис:', info.fullDescription || '❌ не знайдено');
  console.log('\n🌸 Пошук ноток аромату:');
  if (info.notesSearch.length === 0) {
    console.log('  ❌ Нічого не знайдено');
  } else {
    info.notesSearch.forEach(n => {
      console.log(`  [${n.selector}] count:${n.count} hasImgs:${n.hasImages}`);
      console.log(`    → ${n.sample}`);
    });
  }
  console.log('\n🔑 Релевантні CSS-класи:', info.relevantClasses.join(', ') || '❌ немає');
  console.log('\n📦 Варіації (select):', info.variations.length ? info.variations : '❌ немає');
  console.log('\n🔘 Кнопки варіацій:', info.varButtons.length ? info.varButtons : '❌ немає');
  console.log('\n💰 Ціни на сторінці:', info.prices);
  console.log('\n🖼  Фото галереї:', info.galleryImages);

  await browser.close();
  process.exit(0);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
