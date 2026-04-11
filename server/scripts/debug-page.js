const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Завантажуємо сторінку...');
  await page.goto('https://www.black-room.com.ua/product-category/oblychchya/', {
    waitUntil: 'networkidle2', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 2000));

  const debug = await page.evaluate(() => {
    // Скільки посилань на /product/
    const productLinks = document.querySelectorAll('a[href*="/product/"]');

    // Перші 3 посилання
    const links = Array.from(productLinks).slice(0, 5).map(a => ({
      href: a.href,
      text: a.textContent.trim().slice(0, 60),
      parentTag: a.parentElement?.tagName,
      parentClass: a.parentElement?.className?.slice(0, 80),
    }));

    // Які теги є на сторінці з product
    const allTags = {};
    document.querySelectorAll('[class*="product"]').forEach(el => {
      const key = el.tagName + '.' + (el.className || '').split(' ')[0];
      allTags[key] = (allTags[key] || 0) + 1;
    });

    // HTML першого product елемента
    const firstProduct = document.querySelector('li.product, .product-item, article.product, .woocommerce-LoopProduct-link');
    const firstHTML = firstProduct ? firstProduct.outerHTML.slice(0, 500) : 'НЕ ЗНАЙДЕНО';

    // Заголовок сторінки
    const title = document.title;

    return { productLinksCount: productLinks.length, links, allTags, firstHTML, title };
  });

  console.log('\n=== ДІАГНОСТИКА ===');
  console.log('Заголовок:', debug.title);
  console.log('Посилань на /product/:', debug.productLinksCount);
  console.log('\nПерші посилання:');
  debug.links.forEach(l => console.log(' -', l.href, '|', l.text, '| parent:', l.parentTag, l.parentClass));
  console.log('\nКласи з "product":');
  Object.entries(debug.allTags).slice(0, 15).forEach(([k, v]) => console.log(` ${k}: ${v}`));
  console.log('\nПерший product HTML:');
  console.log(debug.firstHTML);

  await browser.close();
}

main().catch(console.error);
