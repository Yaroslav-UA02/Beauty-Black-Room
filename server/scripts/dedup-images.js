/**
 * dedup-images.js
 * Прибирає дублікати фото у товарів:
 *   — видаляє thumbnails (URL з -150x150, -100x100 тощо)
 *   — якщо той самий базовий файл є у кількох версіях — залишає найбільшу
 *   — видаляє абсолютні дублікати
 *   — видаляє маленькі іконки (нотки аромату)
 *
 * Запуск: node server/scripts/dedup-images.js
 */
require('dotenv').config();
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
}
const db = admin.firestore();

// Розмір з URL: "-300x300.jpg" → {w: 300, h: 300}
function parseSizeFromUrl(url) {
  const m = url.match(/-(\d+)x(\d+)(\.\w+)?(\?.*)?$/);
  return m ? { w: +m[1], h: +m[2] } : null;
}

// Базовий URL без суфікса розміру: "image-300x300.jpg" → "image.jpg"
function baseUrl(url) {
  return url.replace(/-\d+x\d+(\.\w+)(\?.*)?$/, '$1').split('?')[0];
}

// Чи є URL маленькою іконкою (≤ 200px в URL)
function isSmallIcon(url) {
  const size = parseSizeFromUrl(url);
  if (!size) return false;
  return size.w <= 200 || size.h <= 200;
}

// Дедублікація масиву картинок
function deduplicateImages(images) {
  if (!images || images.length === 0) return [];

  // 1. Прибираємо точні дублікати
  const unique = [...new Set(images.map(u => u.split('?')[0]))];

  // 2. Групуємо по базовому URL
  const groups = new Map(); // baseUrl → [url, ...]
  unique.forEach(url => {
    const key = baseUrl(url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(url);
  });

  // 3. З кожної групи вибираємо найкращий URL
  const result = [];
  for (const [, urls] of groups) {
    if (urls.length === 1) {
      // Якщо лишилась одна — перевіряємо чи не іконка
      if (!isSmallIcon(urls[0])) result.push(urls[0]);
      continue;
    }

    // Якщо кілька — шукаємо оригінал (без суфікса розміру) або найбільший
    const original = urls.find(u => !parseSizeFromUrl(u));
    if (original) { result.push(original); continue; }

    // Сортуємо за шириною — беремо найбільший
    const sorted = urls
      .map(u => ({ url: u, size: parseSizeFromUrl(u) }))
      .filter(x => x.size)
      .sort((a, b) => b.size.w - a.size.w);

    if (sorted.length > 0 && sorted[0].size.w >= 200) {
      result.push(sorted[0].url);
    }
  }

  return result;
}

async function main() {
  console.log('📥 Завантаження всіх товарів...');
  const snap = await db.collection('products').get();
  const products = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  console.log(`📦 Всього: ${products.length}\n`);

  let toUpdate = 0;
  let totalRemoved = 0;
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let cnt = 0;

  const flush = async () => {
    if (cnt > 0) { await batch.commit(); batch = db.batch(); cnt = 0; }
  };

  // Статистика
  const examples = [];

  for (const p of products) {
    const imgs = p.images;
    if (!imgs || imgs.length <= 1) continue;

    const cleaned = deduplicateImages(imgs);
    const removed = imgs.length - cleaned.length;

    if (removed === 0) continue; // Нічого не змінилось

    totalRemoved += removed;
    toUpdate++;

    if (examples.length < 5) {
      examples.push({
        name: p.name?.slice(0, 50),
        before: imgs.length,
        after: cleaned.length,
        removed,
      });
    }

    batch.update(p.ref, { images: cleaned });
    cnt++;

    if (cnt >= BATCH_SIZE) {
      await flush();
      console.log(`  💾 ${toUpdate} товарів оброблено...`);
    }
  }

  await flush();

  console.log('═══════════════════════════════');
  console.log(`✅ Оновлено товарів:    ${toUpdate}`);
  console.log(`🗑  Видалено дублікатів: ${totalRemoved}`);
  console.log('═══════════════════════════════\n');

  if (examples.length > 0) {
    console.log('Приклади (до → після):');
    examples.forEach(e => {
      console.log(`  ${e.before} → ${e.after} фото (-${e.removed}) | ${e.name}`);
    });
  }

  console.log('\n🎉 Готово!');
  process.exit(0);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
