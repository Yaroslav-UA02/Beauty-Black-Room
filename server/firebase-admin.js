const admin = require('firebase-admin');

if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Production (Railway/Render): credentials з env змінної (base64 JSON)
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')
    );
    credential = admin.credential.cert(serviceAccount);
  } else {
    // Local: читаємо з файлу
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
const auth = admin.auth();

module.exports = { admin, db, bucket, auth };
