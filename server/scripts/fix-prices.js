/**
 * fix-prices.js
 * Виправляє ціни в Firestore: ділить всі на 100
 * (скрапер зберігав "1 415,00 ₴" як 141500 замість 1415)
 *
 * Запуск: node server/scripts/fix-prices.js
 */

require('dotenv').config();
const admin = require('firebase-admin');

/* ── Ініціалізація Firebase ── */
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function fixPrices() {
  console.log('🔍 Завантаження товарів...');
  const snap = await db.collection('products').get();
  const total = snap.docs.length;
  console.log(`📦 Знайдено ${total} товарів\n`);

  let fixed = 0;
  let skipped = 0;
  let zeroed = 0;

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const oldPrice = data.price;

    /* Пропускаємо нульові та вже правильні ціни (менше 10000) */
    if (!oldPrice || oldPrice <= 0) {
      zeroed++;
      continue;
    }

    /* Якщо ціна вже виглядає правильно (менше 50000 грн) — не чіпаємо */
    if (oldPrice < 50000) {
      skipped++;
      continue;
    }

    /* Ціна завелика — ділимо на 100 */
    const newPrice = Math.round(oldPrice / 100);
    batch.update(docSnap.ref, { price: newPrice });
    batchCount++;
    fixed++;

    /* Коміт кожні 400 записів (ліміт Firestore batch) */
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  ✓ Збережено ${fixed} записів...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  /* Останній батч */
  if (batchCount > 0) await batch.commit();

  console.log('\n═══════════════════════════════');
  console.log(`✅ Виправлено:  ${fixed} товарів`);
  console.log(`⏭  Пропущено:  ${skipped} товарів (ціна вже правильна)`);
  console.log(`⭕ Без ціни:   ${zeroed} товарів`);
  console.log(`📦 Всього:     ${total} товарів`);
  console.log('═══════════════════════════════\n');
  console.log('🎉 Готово! Ціни виправлено.');
  process.exit(0);
}

fixPrices().catch(err => {
  console.error('❌ Помилка:', err.message);
  process.exit(1);
});
