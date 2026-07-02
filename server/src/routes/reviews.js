import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

// Get reviews for a product (public)
router.get('/product/:productId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC',
      [req.params.productId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting product reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// Add review
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { product_id, rating, review } = req.body;
    
    if (!product_id || !rating || !review) {
      return res.status(400).json({ error: 'Product ID, rating, and review text are required.' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    const result = await pool.query(
      'INSERT INTO reviews (product_id, user_id, rating, review, user_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [product_id, req.user.id, rating, review, req.user.name]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding review:', err);
    res.status(500).json({ error: 'Failed to add review.' });
  }
});

// Get logged-in user's reviews
router.get('/my-reviews', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, p.name as product_name, p.image_urls[1] as product_image, p.slug as product_slug
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user reviews:', err);
    res.status(500).json({ error: 'Failed to fetch your reviews.' });
  }
});

// Get all reviews (admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, p.name as product_name
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching all reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// Update own review (or admin)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { rating, review } = req.body;

    if (!rating || !review) {
      return res.status(400).json({ error: 'Rating and review text are required.' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    const existing = await pool.query(
      'SELECT user_id FROM reviews WHERE id = $1',
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    const isOwner = existing.rows[0].user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only edit your own reviews.' });
    }

    const result = await pool.query(
      'UPDATE reviews SET rating = $1, review = $2 WHERE id = $3 RETURNING *',
      [rating, review, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating review:', err);
    res.status(500).json({ error: 'Failed to update review.' });
  }
});

// Delete review (owner or admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT user_id FROM reviews WHERE id = $1',
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    const isOwner = existing.rows[0].user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own reviews.' });
    }

    await pool.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);

    res.json({ success: true, message: 'Review deleted successfully.' });
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ error: 'Failed to delete review.' });
  }
});

export default router;
