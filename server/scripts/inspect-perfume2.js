require('dotenv').config();
const puppeteer = require('puppeteer');

// Шукаємо парфум з нотками — спробуємо кілька
const TEST_URLS = [
  'https://www.black-room.com.ua/product/absinth-nasomatto/',
  'https://www.black-room.com.ua/product/afternoon-swim-louis-vuitton/',
];

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  for (const url of TEST_URLS) {
    console.log(`\n═══ ${url} ═══`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1000));

      const info = await page.evaluate(() => {
        // 1. Детально про nasa-current-note
        const noteEls = document.querySelectorAll('.nasa-current-note, [class*="nasa-note"], [class*="current-note"]');
        const noteDetails = [];
        noteEls.forEach(el => {
          noteDetails.push({
            class: el.className,
            html: el.outerHTML.slice(0, 300),
            hasImg: el.querySelectorAll('img').length > 0,
          });
        });

        // 2. Вся структура tab-а з описом
        const tabs = [];
        document.querySelectorAll('.woocommerce-tabs .woocommerce-tab, ul.tabs li, .nasa-tab-item').forEach(tab => {
          tabs.push({ class: tab.className, text: tab.textContent.trim().slice(0, 50) });
        });

        // 3. Варіації — повна структура
        const varSelect = document.querySelector('.variations select, .nasa-variations select');
        let varHTML = '';
        if (varSelect) varHTML = varSelect.outerHTML.slice(0, 500);

        // 4. Ціна варіації
        const varPriceEl = document.querySelector('.woocommerce-variation-price .woocommerce-Price-amount, .woo-variation-price .woocommerce-Price-amount');
        const varPrice = varPriceEl ? varPriceEl.textContent.trim() : '';

        // 5. Перший range ціни
        const priceRangeEl = document.querySelector('.price .woocommerce-Price-amount, .nasa-price-wrap .woocommerce-Price-amount');
        const priceRange = priceRangeEl ? priceRangeEl.textContent.trim() : '';

        // 6. Всі imgs на сторінці з alt що містить назви
        const imgs = [];
        document.querySelectorAll('img[alt]').forEach(img => {
          const alt = img.alt.toLowerCase();
          if (alt.includes('нот') || alt.includes('note') || alt.includes('arom') || alt.includes('мандарин') || alt.includes('bergamot') || alt.includes('ванил')) {
            imgs.push({ alt: img.alt, src: img.src?.slice(-60), class: img.className });
          }
        });

        // 7. Повна структура additional info tab
        const addInfo = document.querySelector('#tab-additional_information, .woocommerce-Tabs-panel--additional_information');
        const addInfoHTML = addInfo ? addInfo.innerText.slice(0, 400) : '';

        // 8. Пошук "нотки" текстово в сторінці
        const bodyText = document.body.innerText;
        const notkyIdx = bodyText.toLowerCase().indexOf('нотк');
        const notkyContext = notkyIdx >= 0 ? bodyText.slice(Math.max(0, notkyIdx-20), notkyIdx+200) : 'не знайдено';

        return { noteDetails, tabs, varHTML, varPrice, priceRange, imgs, addInfoHTML, notkyContext };
      });

      console.log('\n🎵 nasa-current-note елементи:', info.noteDetails.length);
      info.noteDetails.forEach((n, i) => console.log(`  [${i}] class:${n.class}\n    hasImg:${n.hasImg}\n    html:${n.html}`));

      console.log('\n📑 Вкладки:', info.tabs.map(t => t.text).join(' | '));
      console.log('\n📦 Варіація select HTML:', info.varHTML || '❌');
      console.log('\n💰 Ціна варіації:', info.varPrice || '❌');
      console.log('\n💰 Ціна (перша):', info.priceRange || '❌');
      console.log('\n🖼  Imgs з нотками в alt:', info.imgs);
      console.log('\n📋 Additional info tab:', info.addInfoHTML || '❌');
      console.log('\n🔍 Контекст "нотк" в тексті:', info.notkyContext);

    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  await browser.close();
  process.exit(0);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
