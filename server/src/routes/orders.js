import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware, optionalAuthMiddleware, adminMiddleware } from '../middleware/auth.js';
import { generateInvoicePDF } from '../utils/invoice.js';
import { sendOrderConfirmationEmail } from '../utils/mailer.js';
import {
  calculateCheckoutTotal,
  netRevenueSql,
  razorpayFeeSql,
  RAZORPAY_FEE_PERCENT,
  RAZORPAY_FEE_GST_PERCENT
} from '../utils/pricing.js';
import {
  validateOrderItemsStock,
  deleteStalePendingOrders,
  fulfillOrderItemsStock
} from '../utils/orderStock.js';

const router = Router();

// Helper to generate a professional Order ID (Format: SPFW-YYYYMMDD-XXXXX)
function generateOrderNum() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(10000 + Math.random() * 90000); // 5 digits
  return `SPFW-${dateStr}-${rand}`;
}

// Get all orders (admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let baseQuery = `
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'product_id', oi.product_id,
                   'variant_id', oi.variant_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'product_name', p.name,
                   'product_image', p.image_urls[1],
                   'category_name', c.name,
                   'variant_color', pv.color
                 )
               ) FILTER (WHERE oi.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON oi.variant_id = pv.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      baseQuery += ` AND o.order_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      baseQuery += ` AND (LOWER(o.order_id) LIKE $${paramIndex} OR LOWER(o.customer_name) LIKE $${paramIndex} OR LOWER(o.email) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    baseQuery += ` GROUP BY o.id ORDER BY o.created_at DESC`;

    const result = await pool.query(baseQuery, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// Get user orders (history)
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const query = `
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'product_id', oi.product_id,
                   'variant_id', oi.variant_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'product_name', p.name,
                   'product_image', p.image_urls[1],
                   'category_name', c.name,
                   'variant_color', pv.color
                 )
               ) FILTER (WHERE oi.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON oi.variant_id = pv.id
      WHERE o.user_id = $1 AND o.payment_status = 'paid'
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    const result = await pool.query(query, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user orders:', err);
    res.status(500).json({ error: 'Failed to fetch your orders.' });
  }
});

// ─── Admin Orders Management ──────────────────────────────────────────────────

// Get all orders (admin)
router.get('/admin/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let baseQuery = `
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'product_id', oi.product_id,
                   'variant_id', oi.variant_id,
                   'quantity', oi.quantity,
                   'price', oi.price::float,
                   'product_name', p.name,
                   'product_image', p.image_urls[1],
                   'category_name', c.name,
                   'variant_color', pv.color
                 )
               ) FILTER (WHERE oi.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON oi.variant_id = pv.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      baseQuery += ` AND o.order_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      baseQuery += ` AND (LOWER(o.order_id) LIKE $${paramIndex} OR LOWER(o.customer_name) LIKE $${paramIndex} OR LOWER(o.email) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    baseQuery += ` GROUP BY o.id ORDER BY o.created_at DESC`;

    const result = await pool.query(baseQuery, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// Get sales and order analytics (admin)
router.get('/admin/analytics', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const netSql = netRevenueSql('total_amount');
    const feeSql = razorpayFeeSql('total_amount');
    const paidFilter = `payment_status = 'paid'`;

    const revenueAggSql = (dateFilter = '') => `
      SELECT
        COALESCE(SUM(total_amount), 0)::float as gross,
        COALESCE(SUM(${feeSql}), 0)::float as fees,
        COALESCE(SUM(${netSql}), 0)::float as net
      FROM orders
      WHERE ${paidFilter}${dateFilter}
    `;

    // Today's Sales
    const todaySalesRes = await pool.query(revenueAggSql(` AND created_at >= CURRENT_DATE`));
    
    // Weekly Sales (last 7 days)
    const weeklySalesRes = await pool.query(revenueAggSql(` AND created_at >= CURRENT_DATE - INTERVAL '7 days'`));

    // Monthly Sales (last 30 days)
    const monthlySalesRes = await pool.query(revenueAggSql(` AND created_at >= CURRENT_DATE - INTERVAL '30 days'`));

    // Lifetime Sales & Count
    const lifetimeRes = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount), 0)::float as gross,
        COALESCE(SUM(${feeSql}), 0)::float as fees,
        COALESCE(SUM(${netSql}), 0)::float as net,
        COUNT(*)::int as count
      FROM orders
      WHERE ${paidFilter}
    `);

    // Low Stock Count
    const lowStockRes = await pool.query(`
      SELECT COUNT(*)::int as count FROM products WHERE is_active = true AND stock < 5
    `);

    // Pending/Processing orders count
    const pendingOrdersRes = await pool.query(`
      SELECT COUNT(*)::int as count FROM orders WHERE order_status IN ('Pending', 'Ordered', 'Confirmed', 'Packed', 'Shipped')
    `);

    // Sales over time (last 7 days) — net after Razorpay fees
    const netOrderSql = netRevenueSql('o.total_amount');
    const salesOverTimeRes = await pool.query(`
      SELECT TO_CHAR(d.day, 'DD MMM') as month, COALESCE(SUM(${netOrderSql}), 0)::float as revenue
      FROM (
        SELECT GENERATE_SERIES(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) as day
      ) d
      LEFT JOIN orders o ON DATE(o.created_at) = DATE(d.day) AND o.payment_status = 'paid'
      GROUP BY d.day
      ORDER BY d.day ASC
    `);

    // Top Selling products
    const topSellingRes = await pool.query(`
      SELECT p.name, SUM(oi.quantity)::int as orders, p.image_urls[1] as image
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.order_id
      WHERE o.payment_status = 'paid'
      GROUP BY p.id, p.name, p.image_urls[1]
      ORDER BY orders DESC
      LIMIT 5
    `);

    // Category sales breakdown (Pie chart format)
    const categorySalesRes = await pool.query(`
      SELECT c.name, COUNT(DISTINCT o.id)::int as value
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN orders o ON oi.order_id = o.order_id
      WHERE o.payment_status = 'paid'
      GROUP BY c.id, c.name
      ORDER BY value DESC
    `);

    // Add color styling for pie chart slices on frontend
    const colors = ["#C4913A", "#4A90D9", "#2D6A4F", "#D94848", "#8B5CF6", "#EC4899"];
    const formattedCategorySales = categorySalesRes.rows.map((row, i) => ({
      name: row.name,
      value: row.value,
      color: colors[i % colors.length]
    }));

    res.json({
      kpis: {
        todaySales: todaySalesRes.rows[0].net,
        todayGross: todaySalesRes.rows[0].gross,
        todayFees: todaySalesRes.rows[0].fees,
        weeklySales: weeklySalesRes.rows[0].net,
        weeklyGross: weeklySalesRes.rows[0].gross,
        weeklyFees: weeklySalesRes.rows[0].fees,
        monthlySales: monthlySalesRes.rows[0].net,
        monthlyGross: monthlySalesRes.rows[0].gross,
        monthlyFees: monthlySalesRes.rows[0].fees,
        totalRevenue: lifetimeRes.rows[0].net,
        totalGross: lifetimeRes.rows[0].gross,
        totalFees: lifetimeRes.rows[0].fees,
        totalOrders: lifetimeRes.rows[0].count,
        lowStockCount: lowStockRes.rows[0].count,
        pendingOrdersCount: pendingOrdersRes.rows[0].count,
        razorpayFeePercent: RAZORPAY_FEE_PERCENT,
        razorpayFeeGstPercent: RAZORPAY_FEE_GST_PERCENT
      },
      salesData: salesOverTimeRes.rows,
      bestSellers: topSellingRes.rows,
      orderStatusData: formattedCategorySales
    });
  } catch (err) {
    console.error('Error fetching admin analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

// Abandon unpaid checkout (user closed payment without paying)
router.delete('/:orderId/abandon', authMiddleware, async (req, res) => {
  try {
    const orderRes = await pool.query(
      'SELECT * FROM orders WHERE order_id = $1 AND user_id = $2',
      [req.params.orderId, req.user.id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderRes.rows[0];
    if (order.payment_status !== 'pending') {
      return res.status(400).json({ error: 'Only unpaid checkout sessions can be abandoned.' });
    }

    await pool.query('DELETE FROM orders WHERE order_id = $1', [req.params.orderId]);
    res.json({ success: true, message: 'Checkout cancelled.' });
  } catch (err) {
    console.error('Error abandoning checkout:', err);
    res.status(500).json({ error: 'Failed to cancel checkout.' });
  }
});

// Get single order details
router.get('/:orderId', optionalAuthMiddleware, async (req, res) => {
  try {
    const query = `
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'product_id', oi.product_id,
                   'variant_id', oi.variant_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'product_name', p.name,
                   'product_image', p.image_urls[1],
                   'category_name', c.name,
                   'variant_color', pv.color
                 )
               ) FILTER (WHERE oi.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON oi.variant_id = pv.id
      WHERE o.order_id = $1
      GROUP BY o.id
    `;
    const result = await pool.query(query, [req.params.orderId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = result.rows[0];

    // Restrict access: if order is linked to a user, restrict to that user or admin
    if (order.user_id) {
      if (!req.user || (req.user.role === 'user' && order.user_id !== req.user.id)) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    res.json(order);
  } catch (err) {
    console.error('Error fetching single order:', err);
    res.status(500).json({ error: 'Failed to fetch order details.' });
  }
});

// Stream PDF invoice for download
router.get('/:orderId/invoice', optionalAuthMiddleware, async (req, res) => {
  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE order_id = $1', [req.params.orderId]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderRes.rows[0];
    if (order.user_id) {
      if (!req.user || (req.user.role === 'user' && order.user_id !== req.user.id)) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    const itemsQuery = `
      SELECT oi.*, p.name as product_name, pv.color as variant_color
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_variants pv ON oi.variant_id = pv.id
      WHERE oi.order_id = $1
    `;
    const itemsResult = await pool.query(itemsQuery, [order.order_id]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.order_id}.pdf`);

    generateInvoicePDF(order, itemsResult.rows, res);
  } catch (err) {
    console.error('Invoice generation failed:', err);
    res.status(500).json({ error: 'Invoice generation failed.' });
  }
});

// Create order (Checkout endpoint)
router.post('/', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      customer_name, mobile, email, address, city, state, pincode, items, payment_id, razorpay_order_id
    } = req.body;

    if (!customer_name || !mobile || !email || !address || !city || !state || !pincode || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Missing required checkout information.' });
    }

    // Server-side validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.toLowerCase().trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
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

    const userId = req.user ? req.user.id : null;

    await client.query('BEGIN');

    // Remove abandoned checkout attempts (unpaid — never shown to customer)
    await deleteStalePendingOrders(client, userId);

    await validateOrderItemsStock(client, items);

    let computedSubtotal = 0;
    const finalItemsToInsert = [];

    for (const item of items) {
      const prodRes = await client.query(
        'SELECT name, sale_price, is_active FROM products WHERE id = $1',
        [item.product_id]
      );
      if (prodRes.rows.length === 0) {
        throw new Error(`Product ${item.product_id} not found. This item may have been removed by the store owner.`);
      }

      const product = prodRes.rows[0];
      if (!product.is_active) {
        throw new Error(`Product "${product.name}" is no longer available.`);
      }

      let price = parseFloat(product.sale_price);

      if (item.variant_id) {
        const variantRes = await client.query(
          'SELECT sale_price FROM product_variants WHERE id = $1 AND product_id = $2',
          [item.variant_id, item.product_id]
        );
        if (variantRes.rows.length === 0) {
          throw new Error(`Variant ${item.variant_id} not found for product.`);
        }
        if (variantRes.rows[0].sale_price != null) {
          price = parseFloat(variantRes.rows[0].sale_price);
        }
      }

      computedSubtotal += price * item.quantity;

      finalItemsToInsert.push({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        price
      });
    }

    const gstPercentage = 0;
    const gstAmount = 0;
    const checkout = calculateCheckoutTotal(computedSubtotal);
    const { deliveryCharge, weekendDiscount, gatewayCharge, total: finalTotal } = checkout;

    // Generate unique professional order number
    const orderNum = generateOrderNum();

    // Set paid if signature check succeeded or if mock transaction
    const paymentStatus = payment_id ? 'paid' : 'pending';
    const orderStatus = payment_id ? 'Ordered' : 'Pending';
    const confirmedAt = payment_id ? new Date() : null;

    const orderRes = await client.query(
      `INSERT INTO orders (
        order_id, user_id, customer_name, mobile, email, address, city, state, pincode, 
        total_amount, gst_percentage, gst_amount, delivery_charge, weekend_discount, gateway_charge, payment_id, razorpay_order_id, payment_status, order_status, confirmed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
      [
        orderNum, userId, customer_name, mobile, email, address, city, state, pincode,
        finalTotal, gstPercentage, gstAmount, deliveryCharge, weekendDiscount, gatewayCharge, payment_id || null, razorpay_order_id || null, paymentStatus, orderStatus, confirmedAt
      ]
    );

    const savedOrder = orderRes.rows[0];

    // Insert order items
    for (const fit of finalItemsToInsert) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, variant_id, quantity, price) VALUES ($1, $2, $3, $4, $5)',
        [orderNum, fit.product_id, fit.variant_id, fit.quantity, fit.price]
      );
    }

    await client.query('COMMIT');

    // Fetch rich items with name/color for emails & success responses
    const itemsRes = await pool.query(
      `SELECT oi.*, p.name as product_name, pv.color as variant_color
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_variants pv ON oi.variant_id = pv.id
       WHERE oi.order_id = $1`,
      [orderNum]
    );

    // Dispatch confirmation email in the background
    if (paymentStatus === 'paid') {
      sendOrderConfirmationEmail(savedOrder, itemsRes.rows).catch(err => {
        console.error('Email dispatch error on order creation:', err);
      });
    }

    res.status(201).json({ ...savedOrder, items: itemsRes.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Order checkout transaction failed:', err);
    res.status(500).json({ error: err.message || 'Failed to place order.' });
  } finally {
    client.release();
  }
});

// User requests order cancellation (with reason)
router.put('/:orderId/cancel', authMiddleware, async (req, res) => {
  const { reason } = req.body;
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'Cancellation reason is required.' });
  }

  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE order_id = $1', [req.params.orderId]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderRes.rows[0];

    if (order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only cancel your own orders.' });
    }

    if (!['Ordered', 'Confirmed'].includes(order.order_status)) {
      return res.status(400).json({ error: 'Only orders that are placed and paid can be cancelled.' });
    }

    const result = await pool.query(
      `UPDATE orders SET order_status = 'Cancellation Requested', cancellation_reason = $1
       WHERE order_id = $2 RETURNING *`,
      [String(reason).trim(), req.params.orderId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error requesting order cancellation:', err);
    res.status(500).json({ error: 'Failed to submit cancellation request.' });
  }
});

// Admin deletes an order permanently
router.delete('/:orderId', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT order_id FROM orders WHERE order_id = $1', [req.params.orderId]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const orderId = orderRes.rows[0].order_id;

    await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
    await client.query('DELETE FROM orders WHERE order_id = $1', [orderId]);

    await client.query(
      'INSERT INTO audit_logs (admin_id, action) VALUES ($1, $2)',
      [req.user.id, `Deleted order ${orderId}`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Order deleted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting order:', err);
    res.status(500).json({ error: 'Failed to delete order.' });
  } finally {
    client.release();
  }
});

router.put('/:orderId/status', authMiddleware, adminMiddleware, async (req, res) => {
  const status = req.body.status || req.body.order_status;
  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    let timestampCol = null;
    if (status === 'Ordered' || status === 'Confirmed') timestampCol = 'confirmed_at = CURRENT_TIMESTAMP';
    else if (status === 'Packed') timestampCol = 'packed_at = CURRENT_TIMESTAMP';
    else if (status === 'Shipped') timestampCol = 'shipped_at = CURRENT_TIMESTAMP';
    else if (status === 'Delivered') timestampCol = 'delivered_at = CURRENT_TIMESTAMP';
    else if (status === 'Cancelled') timestampCol = 'cancelled_at = CURRENT_TIMESTAMP';

    let query = `UPDATE orders SET order_status = $1`;
    if (timestampCol) {
      query += `, ${timestampCol}`;
    }
    query += ` WHERE order_id = $2 RETURNING *`;

    const result = await pool.query(query, [status, req.params.orderId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = result.rows[0];

    // Audit Log
    await pool.query(
      'INSERT INTO audit_logs (admin_id, action) VALUES ($1, $2)',
      [req.user.id, `Updated order status for ${order.order_id} to "${status}"`]
    );

    res.json(order);
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

export default router;
