import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
             COALESCE(COUNT(p.id), 0) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// Get all banners
router.get('/banners', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM banners WHERE active = true ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching banners:', err);
    res.status(500).json({ error: 'Failed to fetch banners.' });
  }
});

// Create category (Admin)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, image } = req.body;
    if (!name || !image) {
      return res.status(400).json({ error: 'Name and image are required.' });
    }

    const result = await pool.query(
      'INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING *',
      [name, image]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// Update category (Admin)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, image } = req.body;
    if (!name || !image) {
      return res.status(400).json({ error: 'Name and image are required.' });
    }

    const result = await pool.query(
      'UPDATE categories SET name = $1, image = $2 WHERE id = $3 RETURNING *',
      [name, image, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

// Delete category (Admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('DEBUG - Category Deletion Request:');
    console.log('Category ID:', req.params.id);

    // Check if category exists
    const categoryResult = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    if (categoryResult.rows.length === 0) {
      console.log('ERROR - Category not found:', req.params.id);
      return res.status(404).json({ error: 'Category not found.' });
    }
    const category = categoryResult.rows[0];
    console.log('Category Name:', category.name);

    // Check if category has products (including inactive ones)
    const productCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
      [req.params.id]
    );
    const productCount = parseInt(productCountResult.rows[0].count, 10);
    console.log('Product Count (all):', productCount);

    // Check active products
    const activeProductCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1 AND is_active = true',
      [req.params.id]
    );
    const activeProductCount = parseInt(activeProductCountResult.rows[0].count, 10);
    console.log('Active Product Count:', activeProductCount);

    if (activeProductCount > 0) {
      console.log('ERROR - Category has active products, cannot delete');
      return res.status(400).json({ 
        error: `This category contains ${activeProductCount} active product${activeProductCount > 1 ? 's' : ''} and cannot be deleted.` 
      });
    }

    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [req.params.id]);
    console.log('Delete Query Result:', result.rows[0]);

    if (result.rows.length === 0) {
      console.log('ERROR - Delete failed, no rows returned');
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({ message: 'Category deleted.' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

export default router;
