const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const { verifyToken } = require('../middleware/auth');

const COLLECTION = 'products';

// GET /api/products — всі товари
router.get('/', async (req, res) => {
  try {
    const { category, limit = 50 } = req.query;
    let query = db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(Number(limit));
    if (category) query = query.where('category', '==', category);
    const snap = await query.get();
    const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id — один товар
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products — створити товар (тільки адмін)
router.post('/', verifyToken, async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id — оновити товар (тільки адмін)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    if (updates.price) updates.price = Number(updates.price);
    await ref.update(updates);
    res.json({ id: req.params.id, ...doc.data(), ...updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id — видалити товар (тільки адмін)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
