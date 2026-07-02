import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

// ─── Profile Management ──────────────────────────────────────────────────────

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, mobile, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, mobile } = req.body;
    if (!name || !mobile) {
      return res.status(400).json({ error: 'Name and mobile are required.' });
    }

    const result = await pool.query(
      'UPDATE users SET name = $1, mobile = $2 WHERE id = $3 RETURNING id, name, email, mobile, role, created_at',
      [name, mobile, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ─── Customer Address Book ───────────────────────────────────────────────────

// Get all addresses for logged-in user
router.get('/addresses', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching addresses:', err);
    res.status(500).json({ error: 'Failed to fetch addresses.' });
  }
});

// Create address
router.post('/addresses', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, mobile, address, city, state, pincode, is_default } = req.body;
    if (!name || !mobile || !address || !city || !state || !pincode) {
      return res.status(400).json({ error: 'Missing required address fields.' });
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile.trim())) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(pincode.trim())) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit pincode.' });
    }

    if (address.trim().length < 10) {
      return res.status(400).json({ error: 'Please enter a full shipping address (at least 10 characters).' });
    }

    const cityStateRegex = /^[a-zA-Z\s]{2,50}$/;
    if (!cityStateRegex.test(city.trim())) {
      return res.status(400).json({ error: 'Please enter a valid city name (letters and spaces only).' });
    }

    if (!cityStateRegex.test(state.trim())) {
      return res.status(400).json({ error: 'Please enter a valid state name (letters and spaces only).' });
    }

    await client.query('BEGIN');

    // If setting default, unset other defaults
    if (is_default) {
      await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    }

    // Check if this is the user's first address, make it default if so
    const countCheck = await client.query('SELECT COUNT(*) FROM addresses WHERE user_id = $1', [req.user.id]);
    const setAsDefault = parseInt(countCheck.rows[0].count, 10) === 0 ? true : !!is_default;

    const result = await client.query(
      `INSERT INTO addresses (user_id, name, mobile, address, city, state, pincode, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, name, mobile, address, city, state, pincode, setAsDefault]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating address:', err);
    res.status(500).json({ error: 'Failed to save address.' });
  } finally {
    client.release();
  }
});

// Update address
router.put('/addresses/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, mobile, address, city, state, pincode, is_default } = req.body;
    if (!name || !mobile || !address || !city || !state || !pincode) {
      return res.status(400).json({ error: 'Missing required address fields.' });
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile.trim())) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(pincode.trim())) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit pincode.' });
    }

    if (address.trim().length < 10) {
      return res.status(400).json({ error: 'Please enter a full shipping address (at least 10 characters).' });
    }

    const cityStateRegex = /^[a-zA-Z\s]{2,50}$/;
    if (!cityStateRegex.test(city.trim())) {
      return res.status(400).json({ error: 'Please enter a valid city name (letters and spaces only).' });
    }

    if (!cityStateRegex.test(state.trim())) {
      return res.status(400).json({ error: 'Please enter a valid state name (letters and spaces only).' });
    }

    await client.query('BEGIN');

    if (is_default) {
      await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    }

    const result = await client.query(
      `UPDATE addresses SET 
        name = $1, mobile = $2, address = $3, city = $4, state = $5, pincode = $6, is_default = $7
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [name, mobile, address, city, state, pincode, !!is_default, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Address not found.' });
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating address:', err);
    res.status(500).json({ error: 'Failed to update address.' });
  } finally {
    client.release();
  }
});

// Delete address
router.delete('/addresses/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found.' });
    }

    res.json({ message: 'Address deleted successfully.' });
  } catch (err) {
    console.error('Error deleting address:', err);
    res.status(500).json({ error: 'Failed to delete address.' });
  }
});

// ─── Cart Management ─────────────────────────────────────────────────────────

// Get user's cart
router.get('/cart', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.product_id, c.variant_id, c.quantity,
             p.name as product_name, 
             p.image_urls[1] as product_image,
             p.sale_price::float as sale_price, 
             p.original_price::float as original_price,
             v.color as variant_color, 
             COALESCE(v.stock, p.stock)::int as stock
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN product_variants v ON c.variant_id = v.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
    `, [req.user.id]);
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ error: 'Failed to fetch cart.' });
  }
});

// Add to cart
router.post('/cart', authMiddleware, async (req, res) => {
  try {
    const { product_id, variant_id, quantity = 1 } = req.body;
    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required.' });
    }

    // Verify stock availability
    let stockAvailable = 0;
    if (variant_id) {
      const variantRes = await pool.query('SELECT stock FROM product_variants WHERE id = $1 AND product_id = $2', [variant_id, product_id]);
      if (variantRes.rows.length === 0) {
        return res.status(404).json({ error: 'Product variant not found.' });
      }
      stockAvailable = variantRes.rows[0].stock;
    } else {
      const productRes = await pool.query('SELECT stock FROM products WHERE id = $1', [product_id]);
      if (productRes.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found.' });
      }
      stockAvailable = productRes.rows[0].stock;
    }

    // Check if item already in cart
    let checkQuery = `
      SELECT id, quantity FROM cart_items 
      WHERE user_id = $1 AND product_id = $2 AND 
      (variant_id = $3 OR (variant_id IS NULL AND $3 IS NULL))
    `;
    const check = await pool.query(checkQuery, [req.user.id, product_id, variant_id || null]);
    
    if (check.rows.length > 0) {
      const itemId = check.rows[0].id;
      const newQty = check.rows[0].quantity + quantity;
      if (newQty > stockAvailable) {
        return res.status(400).json({ error: `Cannot add more items. Only ${stockAvailable} in stock.` });
      }
      const updateRes = await pool.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING *',
        [newQty, itemId]
      );
      return res.json(updateRes.rows[0]);
    } else {
      if (quantity > stockAvailable) {
        return res.status(400).json({ error: `Cannot add item. Only ${stockAvailable} in stock.` });
      }
      const insertRes = await pool.query(
        `INSERT INTO cart_items (user_id, product_id, variant_id, quantity)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.user.id, product_id, variant_id || null, quantity]
      );
      return res.status(201).json(insertRes.rows[0]);
    }
  } catch (err) {
    console.error('Error adding to cart:', err);
    res.status(500).json({ error: 'Failed to add to cart.' });
  }
});

// Update cart item quantity
router.put('/cart/:id', authMiddleware, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity === undefined || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1.' });
    }

    // Get cart item details to check stock
    const itemRes = await pool.query('SELECT product_id, variant_id, quantity FROM cart_items WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    const { product_id, variant_id, quantity: currentQty } = itemRes.rows[0];

    // Check stock
    let stockAvailable = 0;
    if (variant_id) {
      const variantRes = await pool.query('SELECT stock FROM product_variants WHERE id = $1', [variant_id]);
      stockAvailable = variantRes.rows[0]?.stock || 0;
    } else {
      const productRes = await pool.query('SELECT stock FROM products WHERE id = $1', [product_id]);
      stockAvailable = productRes.rows[0]?.stock || 0;
    }

    // Allow decreasing quantity even when item is now out of stock
    if (quantity > currentQty && quantity > stockAvailable) {
      return res.status(400).json({ error: `Cannot set quantity to ${quantity}. Only ${stockAvailable} available in stock.` });
    }

    const result = await pool.query(
      'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [quantity, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating cart item:', err);
    res.status(500).json({ error: 'Failed to update cart item.' });
  }
});

// Clear entire cart (e.g. after successful checkout)
router.delete('/cart', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Cart cleared.' });
  } catch (err) {
    console.error('Error clearing cart:', err);
    res.status(500).json({ error: 'Failed to clear cart.' });
  }
});

// Remove single cart item
router.delete('/cart/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }
    res.json({ message: 'Cart item removed.' });
  } catch (err) {
    console.error('Error removing cart item:', err);
    res.status(500).json({ error: 'Failed to remove cart item.' });
  }
});

// ─── Wishlist Management ─────────────────────────────────────────────────────

// Get user's wishlist
router.get('/wishlist', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.id, w.product_id,
             p.name as product_name, 
             p.image_urls[1] as product_image,
             p.sale_price::float as sale_price, 
             p.original_price::float as original_price
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
    `, [req.user.id]);
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    res.status(500).json({ error: 'Failed to fetch wishlist.' });
  }
});

// Toggle product in wishlist
router.post('/wishlist', authMiddleware, async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required.' });
    }

    const check = await pool.query(
      'SELECT id FROM wishlists WHERE user_id = $1 AND product_id = $2',
      [req.user.id, product_id]
    );

    if (check.rows.length > 0) {
      await pool.query(
        'DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2',
        [req.user.id, product_id]
      );
      return res.json({ message: 'Product removed from wishlist.', toggled: 'removed' });
    } else {
      const result = await pool.query(
        'INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2) RETURNING *',
        [req.user.id, product_id]
      );
      return res.status(201).json({ message: 'Product added to wishlist.', toggled: 'added', item: result.rows[0] });
    }
  } catch (err) {
    console.error('Error toggling wishlist:', err);
    res.status(500).json({ error: 'Failed to toggle wishlist.' });
  }
});

// Remove product from wishlist
router.delete('/wishlist/:product_id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2 RETURNING *',
      [req.user.id, req.params.product_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found in wishlist.' });
    }
    res.json({ message: 'Product removed from wishlist.' });
  } catch (err) {
    console.error('Error removing from wishlist:', err);
    res.status(500).json({ error: 'Failed to remove from wishlist.' });
  }
});

// ─── Customer Details (Admin) ────────────────────────────────────────────────

// Get all customers (admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.mobile, u.created_at,
             COUNT(DISTINCT o.id)::int as total_orders, 
             COALESCE(SUM(o.total_amount), 0)::float as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id AND o.payment_status = 'paid'
      WHERE u.role = 'user'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing customers:', err);
    res.status(500).json({ error: 'Failed to list customers.' });
  }
});

// ─── Admin Users List ────────────────────────────────────────────────────────

// Get all users for admin
router.get('/admin/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, mobile, role, created_at FROM users ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing all users:', err);
    res.status(500).json({ error: 'Failed to list all users.' });
  }
});

// Delete customer (admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const customer = userRes.rows[0];
    if (customer.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts cannot be deleted.' });
    }

    await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);

    await client.query(
      'INSERT INTO audit_logs (admin_id, action) VALUES ($1, $2)',
      [req.user.id, `Deleted customer "${customer.name}" (${customer.email})`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Customer deleted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting customer:', err);
    res.status(500).json({ error: 'Failed to delete customer.' });
  } finally {
    client.release();
  }
});

// Get customer details (admin)
router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userRes = await pool.query('SELECT id, name, email, mobile, role, created_at FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = userRes.rows[0];

    const ordersRes = await pool.query(`
      SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC
    `, [user.id]);

    const totalSpent = ordersRes.rows
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + parseFloat(o.total_amount), 0);

    res.json({
      ...user,
      orders: ordersRes.rows,
      totalOrders: ordersRes.rows.length,
      totalSpent
    });
  } catch (err) {
    console.error('Error fetching customer details:', err);
    res.status(500).json({ error: 'Failed to fetch customer details.' });
  }
});

export default router;
