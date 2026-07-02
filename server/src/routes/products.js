import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

// Helper to generate slugs
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Get all products (public)
router.get('/', async (req, res) => {
  try {
    const { category, search, sort, featured, page = 1, limit = 12, min_price, max_price, fabric, work_type, color, occasion } = req.query;
    
    let baseQuery = `
      SELECT p.*, c.name as category_name, 
             AVG(r.rating) as rating, 
             COUNT(DISTINCT r.id) as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.is_active = true
    `;
    
    const params = [];
    let paramIndex = 1;

    // Apply category filter (by name or by ID)
    if (category) {
      // Check if it's a UUID or name
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(category);
      if (isUUID) {
        baseQuery += ` AND p.category_id = $${paramIndex}`;
        params.push(category);
      } else {
        baseQuery += ` AND LOWER(c.name) = LOWER($${paramIndex})`;
        params.push(category);
      }
      paramIndex++;
    }

    if (search) {
      baseQuery += ` AND (LOWER(p.name) LIKE $${paramIndex} OR LOWER(p.description) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    if (featured === 'true') {
      baseQuery += ` AND p.featured = true`;
    }

    if (min_price) {
      baseQuery += ` AND p.sale_price >= $${paramIndex}`;
      params.push(parseFloat(min_price));
      paramIndex++;
    }

    if (max_price) {
      baseQuery += ` AND p.sale_price <= $${paramIndex}`;
      params.push(parseFloat(max_price));
      paramIndex++;
    }

    if (fabric) {
      baseQuery += ` AND LOWER(p.fabric) = LOWER($${paramIndex})`;
      params.push(fabric);
      paramIndex++;
    }

    if (work_type) {
      baseQuery += ` AND LOWER(p.work_type) = LOWER($${paramIndex})`;
      params.push(work_type);
      paramIndex++;
    }

    if (color) {
      baseQuery += ` AND LOWER(p.color) = LOWER($${paramIndex})`;
      params.push(color);
      paramIndex++;
    }

    if (occasion) {
      baseQuery += ` AND LOWER(p.occasion) = LOWER($${paramIndex})`;
      params.push(occasion);
      paramIndex++;
    }

    baseQuery += ` GROUP BY p.id, c.name`;

    // Sorting
    if (sort === 'price_low') {
      baseQuery += ` ORDER BY p.sale_price ASC`;
    } else if (sort === 'price_high') {
      baseQuery += ` ORDER BY p.sale_price DESC`;
    } else if (sort === 'newest') {
      baseQuery += ` ORDER BY p.created_at DESC`;
    } else {
      baseQuery += ` ORDER BY p.created_at DESC`; // Default
    }

    // Pagination
    const offset = (Number(page) - 1) * Number(limit);
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    const productsResult = await pool.query(baseQuery, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT p.id) 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;
    const countParams = [];
    let countParamIndex = 1;

    if (category) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(category);
      if (isUUID) {
        countQuery += ` AND p.category_id = $${countParamIndex}`;
        countParams.push(category);
      } else {
        countQuery += ` AND LOWER(c.name) = LOWER($${countParamIndex})`;
        countParams.push(category);
      }
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (LOWER(p.name) LIKE $${countParamIndex} OR LOWER(p.description) LIKE $${countParamIndex})`;
      countParams.push(`%${search.toLowerCase()}%`);
      countParamIndex++;
    }

    if (featured === 'true') {
      countQuery += ` AND p.featured = true`;
    }

    if (min_price) {
      countQuery += ` AND p.sale_price >= $${countParamIndex}`;
      countParams.push(parseFloat(min_price));
      countParamIndex++;
    }

    if (max_price) {
      countQuery += ` AND p.sale_price <= $${countParamIndex}`;
      countParams.push(parseFloat(max_price));
      countParamIndex++;
    }

    if (fabric) {
      countQuery += ` AND LOWER(p.fabric) = LOWER($${countParamIndex})`;
      countParams.push(fabric);
      countParamIndex++;
    }

    if (work_type) {
      countQuery += ` AND LOWER(p.work_type) = LOWER($${countParamIndex})`;
      countParams.push(work_type);
      countParamIndex++;
    }

    if (color) {
      countQuery += ` AND LOWER(p.color) = LOWER($${countParamIndex})`;
      countParams.push(color);
      countParamIndex++;
    }

    if (occasion) {
      countQuery += ` AND LOWER(p.occasion) = LOWER($${countParamIndex})`;
      countParams.push(occasion);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    // Fetch variants for these products
    const productIds = productsResult.rows.map(p => p.id);
    let variantsMap = {};
    if (productIds.length > 0) {
      const variantsResult = await pool.query(
        'SELECT * FROM product_variants WHERE product_id = ANY($1)',
        [productIds]
      );
      variantsResult.rows.forEach(v => {
        if (!variantsMap[v.product_id]) {
          variantsMap[v.product_id] = [];
        }
        variantsMap[v.product_id].push(v);
      });
    }

    const withVariants = productsResult.rows.map(p => ({
      ...p,
      rating: parseFloat(p.rating),
      reviewCount: parseInt(p.review_count, 10),
      variants: variantsMap[p.id] || []
    }));

    res.json({
      products: withVariants,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// Get low stock products (Admin)
router.get('/admin/low-stock', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const productsResult = await pool.query(`
      SELECT p.id, p.name, p.slug, p.stock, c.name as category_name, p.sale_price::float as sale_price
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true AND p.stock < 5
      ORDER BY p.stock ASC
    `);
    
    const variantsResult = await pool.query(`
      SELECT pv.id, pv.color, pv.stock, p.name as product_name, p.slug as product_slug
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE p.is_active = true AND pv.stock < 5
      ORDER BY pv.stock ASC
    `);
    
    res.json({
      products: productsResult.rows,
      variants: variantsResult.rows
    });
  } catch (err) {
    console.error('Error fetching low stock:', err);
    res.status(500).json({ error: 'Failed to fetch low stock alert.' });
  }
});

// Get product by ID explicitly
router.get('/id/:id', async (req, res) => {
  try {
    const productQuery = `
      SELECT p.*, c.name as category_name,
             AVG(r.rating)::float as rating, 
             COUNT(DISTINCT r.id)::int as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.id = $1 AND p.is_active = true
      GROUP BY p.id, c.name
    `;
    const productResult = await pool.query(productQuery, [req.params.id]);
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = productResult.rows[0];

    // Fetch variants
    const variantsResult = await pool.query('SELECT * FROM product_variants WHERE product_id = $1', [product.id]);
    
    // Fetch reviews
    const reviewsResult = await pool.query('SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC', [product.id]);

    // Fetch similar products
    const similarQuery = `
      SELECT p.*, c.name as category_name,
             AVG(r.rating)::float as rating, 
             COUNT(DISTINCT r.id)::int as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.category_id = $1 AND p.id != $2 AND p.is_active = true
      GROUP BY p.id, c.name
      LIMIT 4
    `;
    const similarResult = await pool.query(similarQuery, [product.category_id, product.id]);

    res.json({
      ...product,
      rating: parseFloat(product.rating),
      reviewCount: parseInt(product.review_count, 10),
      variants: variantsResult.rows,
      reviews: reviewsResult.rows,
      similar: similarResult.rows,
    });
  } catch (err) {
    console.error('Error fetching product by ID:', err);
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

// Get product by slug explicitly
router.get('/slug/:slug', async (req, res) => {
  try {
    const productQuery = `
      SELECT p.*, c.name as category_name,
             AVG(r.rating)::float as rating, 
             COUNT(DISTINCT r.id)::int as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.slug = $1 AND p.is_active = true
      GROUP BY p.id, c.name
    `;
    const productResult = await pool.query(productQuery, [req.params.slug]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = productResult.rows[0];

    // Fetch variants
    const variantsResult = await pool.query('SELECT * FROM product_variants WHERE product_id = $1', [product.id]);

    // Fetch reviews
    const reviewsResult = await pool.query('SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC', [product.id]);

    // Fetch similar
    const similarQuery = `
      SELECT p.*, c.name as category_name,
             AVG(r.rating)::float as rating, 
             COUNT(DISTINCT r.id)::int as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.category_id = $1 AND p.id != $2 AND p.is_active = true
      GROUP BY p.id, c.name
      LIMIT 4
    `;
    const similarResult = await pool.query(similarQuery, [product.category_id, product.id]);

    res.json({
      ...product,
      rating: parseFloat(product.rating),
      reviewCount: parseInt(product.review_count, 10),
      variants: variantsResult.rows,
      reviews: reviewsResult.rows,
      similar: similarResult.rows,
    });
  } catch (err) {
    console.error('Error fetching product by slug:', err);
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

// Combined ID or Slug lookup
router.get('/:idOrSlug', async (req, res) => {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.idOrSlug);
  try {
    const queryField = isUUID ? 'p.id = $1' : 'p.slug = $1';
    const productQuery = `
      SELECT p.*, c.name as category_name,
             AVG(r.rating)::float as rating, 
             COUNT(DISTINCT r.id)::int as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE ${queryField} AND p.is_active = true
      GROUP BY p.id, c.name
    `;
    const productResult = await pool.query(productQuery, [req.params.idOrSlug]);
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = productResult.rows[0];

    // Fetch variants
    const variantsResult = await pool.query('SELECT * FROM product_variants WHERE product_id = $1', [product.id]);
    
    // Fetch reviews
    const reviewsResult = await pool.query('SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC', [product.id]);

    // Fetch similar products
    const similarQuery = `
      SELECT p.*, c.name as category_name,
             AVG(r.rating)::float as rating, 
             COUNT(DISTINCT r.id)::int as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.category_id = $1 AND p.id != $2 AND p.is_active = true
      GROUP BY p.id, c.name
      LIMIT 4
    `;
    const similarResult = await pool.query(similarQuery, [product.category_id, product.id]);

    res.json({
      ...product,
      rating: parseFloat(product.rating),
      reviewCount: parseInt(product.review_count, 10),
      variants: variantsResult.rows,
      reviews: reviewsResult.rows,
      similar: similarResult.rows,
    });
  } catch (err) {
    console.error('Error fetching product details:', err);
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

// Add product (Admin)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      name, description, category_id, original_price, sale_price, stock, featured, image_urls, image_public_ids,
      fabric, occasion, work_type, blouse_included, length, care_instructions, color, weight, blouse, variants
    } = req.body;

    if (!name || !description || !category_id || !sale_price || !image_urls) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Auto-generate slug and check for uniqueness
    let productSlug = slugify(name + '-' + (color || 'default'));
    const slugCheck = await client.query('SELECT id FROM products WHERE slug = $1', [productSlug]);
    if (slugCheck.rows.length > 0) {
      productSlug = slugify(name + '-' + (color || 'default') + '-' + Math.random().toString(36).substring(2, 7));
    }


    const productResult = await client.query(
      `INSERT INTO products (
        name, slug, description, category_id, original_price, sale_price, stock, featured, image_urls, image_public_ids,
        fabric, occasion, work_type, blouse_included, length, care_instructions, color, weight, blouse
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [
        name, productSlug, description, category_id, original_price || null, sale_price, stock || 0, featured || false, image_urls, image_public_ids || [],
        fabric, occasion, work_type, blouse_included !== undefined ? blouse_included : true, length, care_instructions, color, weight, blouse
      ]
    );

    const product = productResult.rows[0];

    // Seed variants if provided
    if (variants && Array.isArray(variants)) {
      for (const variant of variants) {
        await client.query(
          'INSERT INTO product_variants (product_id, color, stock, original_price, sale_price, image_urls, image_public_ids) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            product.id,
            variant.color,
            variant.stock || 0,
            variant.original_price ?? null,
            variant.sale_price ?? null,
            variant.image_urls || [],
            variant.image_public_ids || []
          ]
        );
      }
    }

    // Audit initial stock history
    await client.query(
      'INSERT INTO stock_history (product_id, old_stock, new_stock, reason, changed_by) VALUES ($1, $2, $3, $4, $5)',
      [product.id, 0, stock || 0, 'product_created', req.user.id]
    );

    // Audit Log
    await client.query(
      'INSERT INTO audit_logs (admin_id, action) VALUES ($1, $2)',
      [req.user.id, `Created product "${name}" (ID: ${product.id})`]
    );

    await client.query('COMMIT');
    res.status(201).json(product);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product.' });
  } finally {
    client.release();
  }
});

// Update product (Admin)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      name, description, category_id, original_price, sale_price, stock, featured, image_urls, image_public_ids,
      fabric, occasion, work_type, blouse_included, length, care_instructions, color, weight, blouse, is_active, variants
    } = req.body;

    // Fetch current product to check stock changes
    const currentRes = await client.query('SELECT stock, name FROM products WHERE id = $1', [req.params.id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const currentProduct = currentRes.rows[0];

    const productResult = await client.query(
      `UPDATE products SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        category_id = COALESCE($3, category_id),
        original_price = COALESCE($4, original_price),
        sale_price = COALESCE($5, sale_price),
        stock = COALESCE($6, stock),
        featured = COALESCE($7, featured),
        image_urls = COALESCE($8, image_urls),
        image_public_ids = COALESCE($9, image_public_ids),
        fabric = COALESCE($10, fabric),
        occasion = COALESCE($11, occasion),
        work_type = COALESCE($12, work_type),
        blouse_included = COALESCE($13, blouse_included),
        length = COALESCE($14, length),
        care_instructions = COALESCE($15, care_instructions),
        color = COALESCE($16, color),
        weight = COALESCE($17, weight),
        blouse = COALESCE($18, blouse),
        is_active = COALESCE($19, is_active)
      WHERE id = $20 RETURNING *`,
      [
        name, description, category_id, original_price, sale_price, stock, featured, image_urls, image_public_ids,
        fabric, occasion, work_type, blouse_included, length, care_instructions, color, weight, blouse, is_active, req.params.id
      ]
    );

    const updatedProduct = productResult.rows[0];

    // Log stock changes
    if (stock !== undefined && stock !== currentProduct.stock) {
      await client.query(
        'INSERT INTO stock_history (product_id, old_stock, new_stock, reason, changed_by) VALUES ($1, $2, $3, $4, $5)',
        [req.params.id, currentProduct.stock, stock, 'admin_adjustment', req.user.id]
      );
    }

    // Sync variants if provided
    if (variants && Array.isArray(variants)) {
      // For simplicity, wipe and re-create variants, or sync. Let's do delete and re-insert:
      await client.query('DELETE FROM product_variants WHERE product_id = $1', [req.params.id]);
      for (const variant of variants) {
        await client.query(
          'INSERT INTO product_variants (product_id, color, stock, original_price, sale_price, image_urls, image_public_ids) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            req.params.id,
            variant.color,
            variant.stock || 0,
            variant.original_price ?? null,
            variant.sale_price ?? null,
            variant.image_urls || [],
            variant.image_public_ids || []
          ]
        );
      }
    }

    // Audit Log
    await client.query(
      'INSERT INTO audit_logs (admin_id, action) VALUES ($1, $2)',
      [req.user.id, `Updated product "${updatedProduct.name}" (ID: ${updatedProduct.id})`]
    );

    await client.query('COMMIT');
    res.json(updatedProduct);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product.' });
  } finally {
    client.release();
  }
});

// Soft Delete product (Admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update is_active = false for soft deletes
    const result = await client.query(
      'UPDATE products SET is_active = false WHERE id = $1 RETURNING name',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const name = result.rows[0].name;

    // Audit Log
    await client.query(
      'INSERT INTO audit_logs (admin_id, action) VALUES ($1, $2)',
      [req.user.id, `Soft deleted product "${name}" (ID: ${req.params.id})`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Product deleted successfully (soft delete).' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error soft deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product.' });
  } finally {
    client.release();
  }
});

export default router;
