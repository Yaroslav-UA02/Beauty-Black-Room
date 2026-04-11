const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const COLLECTION = 'products';

// GET /api/products
router.get('/', asyncHandler(async (req, res) => {
  const { category, limit = 50 } = req.query;
  let query = db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(Number(limit));
  if (category) query = query.where('category', '==', category);
  const snap = await query.get();
  res.json(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}));

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await db.collection(COLLECTION).doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  res.json({ id: doc.id, ...doc.data() });
}));

// POST /api/products (тільки адмін)
router.post('/', verifyToken, asyncHandler(async (req, res) => {
  const { name, price, category, description, images, inStock, featured } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'name, price, category — обовʼязкові поля' });
  }
  const data = {
    name,
    price: Number(price),
    category,
    description: description || '',
    images: images || [],
    inStock: inStock !== false,
    featured: featured || false,
    createdAt: new Date().toISOString(),
  };
  const ref = await db.collection(COLLECTION).add(data);
  res.status(201).json({ id: ref.id, ...data });
}));

// PUT /api/products/:id (тільки адмін)
router.put('/:id', verifyToken, asyncHandler(async (req, res) => {
  const ref = db.collection(COLLECTION).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  const updates = { ...req.body, updatedAt: new Date().toISOString() };
  if (updates.price) updates.price = Number(updates.price);
  await ref.update(updates);
  res.json({ id: req.params.id, ...doc.data(), ...updates });
}));

// DELETE /api/products/:id (тільки адмін)
router.delete('/:id', verifyToken, asyncHandler(async (req, res) => {
  const ref = db.collection(COLLECTION).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  await ref.delete();
  res.json({ success: true });
}));

module.exports = router;
