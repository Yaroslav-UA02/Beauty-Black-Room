const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
const auth = admin.auth();

module.exports = { admin, db, bucket, auth };
