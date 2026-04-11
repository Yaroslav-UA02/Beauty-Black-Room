const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const COLLECTION = 'categories';

// GET /api/categories
router.get('/', asyncHandler(async (req, res) => {
  const snap = await db.collection(COLLECTION).orderBy('order').get();
  res.json(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}));

// POST /api/categories (тільки адмін)
router.post('/', verifyToken, asyncHandler(async (req, res) => {
  const { name, slug, image, order } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name і slug обовʼязкові' });
  const data = { name, slug, image: image || '', order: order || 0 };
  const ref = await db.collection(COLLECTION).add(data);
  res.status(201).json({ id: ref.id, ...data });
}));

// PUT /api/categories/:id (тільки адмін)
router.put('/:id', verifyToken, asyncHandler(async (req, res) => {
  const ref = db.collection(COLLECTION).doc(req.params.id);
  await ref.update(req.body);
  res.json({ id: req.params.id, ...req.body });
}));

// DELETE /api/categories/:id (тільки адмін)
router.delete('/:id', verifyToken, asyncHandler(async (req, res) => {
  await db.collection(COLLECTION).doc(req.params.id).delete();
  res.json({ success: true });
}));

module.exports = router;
