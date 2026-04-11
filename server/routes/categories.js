const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const { verifyToken } = require('../middleware/auth');

const COLLECTION = 'categories';

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection(COLLECTION).orderBy('order').get();
    const categories = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categories (тільки адмін)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, slug, image, order } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name і slug обовʼязкові' });
    const data = { name, slug, image: image || '', order: order || 0 };
    const ref = await db.collection(COLLECTION).add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categories/:id (тільки адмін)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    await ref.update(req.body);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categories/:id (тільки адмін)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
