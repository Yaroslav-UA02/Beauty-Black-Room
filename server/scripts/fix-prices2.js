/**
 * fix-prices2.js — виправляє діапазон 5000-49999 (ділить ще раз на 100)
 * Ці ціни не були виправлені першим скриптом (поріг був 50000)
 * Приклади: 29000 → 290, 18000 → 180, 5500 → 55
 */
require('dotenv').config();
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
}
const db = admin.firestore();

async function fix() {
  console.log('🔍 Завантаження товарів...');
  const snap = await db.collection('products').get();
  const docs = snap.docs.map(d => ({ ref: d.ref, ...d.data() }));

  const toFix = docs.filter(p => p.price >= 5000 && p.price <= 49999);
  console.log(`📦 Знайдено ${toFix.length} товарів з ціною 5000-49999 ₴\n`);

  // Показуємо приклади
  console.log('Приклади ДО виправлення:');
  toFix.slice(0, 10).forEach(p => console.log(`  ${p.price} ₴ → ${Math.round(p.price/100)} ₴ | ${p.name?.substring(0,50)}`));
  console.log('');

  let fixed = 0;
  const BATCH = 400;
  let batch = db.batch();
  let cnt = 0;

  for (const p of toFix) {
    batch.update(p.ref, { price: Math.round(p.price / 100) });
    cnt++; fixed++;
    if (cnt >= BATCH) {
      await batch.commit();
      console.log(`  ✓ ${fixed} записів оновлено...`);
      batch = db.batch();
      cnt = 0;
    }
  }
  if (cnt > 0) await batch.commit();

  console.log(`\n✅ Виправлено ${fixed} товарів`);
  console.log('🎉 Готово!');
  process.exit(0);
}
fix().catch(e => { console.error(e); process.exit(1); });
