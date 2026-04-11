require('dotenv').config();
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
}
const db = admin.firestore();

async function check() {
  const snap = await db.collection('products').get();
  const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Групуємо по діапазонах цін
  const ranges = {
    'Без ціни (0)': products.filter(p => !p.price || p.price <= 0),
    '1 — 49 ₴': products.filter(p => p.price >= 1 && p.price <= 49),
    '50 — 499 ₴': products.filter(p => p.price >= 50 && p.price <= 499),
    '500 — 4999 ₴': products.filter(p => p.price >= 500 && p.price <= 4999),
    '5000 — 19999 ₴': products.filter(p => p.price >= 5000 && p.price <= 19999),
    '20000 — 49999 ₴': products.filter(p => p.price >= 20000 && p.price <= 49999),
    '50000+ ₴ (підозрілі)': products.filter(p => p.price >= 50000),
  };

  console.log('\n═══ РОЗПОДІЛ ЦІН ═══');
  for (const [range, items] of Object.entries(ranges)) {
    console.log(`${range}: ${items.length} товарів`);
  }

  console.log('\n═══ ПІДОЗРІЛІ ЦІНИ (>50000 або <50 але >0) ═══');
  const suspicious = products.filter(p => p.price >= 50000 || (p.price > 0 && p.price < 50));
  suspicious.slice(0, 30).forEach(p => {
    console.log(`  ${p.price} ₴ | ${p.name?.substring(0,60)}`);
  });
  console.log(`  ... всього підозрілих: ${suspicious.length}`);

  console.log('\n═══ ПРИКЛАДИ НОРМАЛЬНИХ ЦІН ═══');
  const normal = products.filter(p => p.price >= 50 && p.price <= 49999);
  normal.slice(0, 15).forEach(p => {
    console.log(`  ${p.price} ₴ | ${p.name?.substring(0,60)}`);
  });

  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
