import { Router } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import pool from '../config/db.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { sendOrderConfirmationEmail } from '../utils/mailer.js';
import { DELIVERY_CHARGE } from '../utils/pricing.js';
import { fulfillOrderItemsStock } from '../utils/orderStock.js';

const router = Router();

async function sendConfirmationEmailForRazorpayOrder(rzpOrderId) {
  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE razorpay_order_id = $1', [rzpOrderId]);
    if (orderRes.rows.length === 0) {
      console.warn('[Payment] No order found for confirmation email:', rzpOrderId);
      return;
    }

    const order = orderRes.rows[0];
    const itemsRes = await pool.query(
      `SELECT oi.*, p.name as product_name, pv.color as variant_color
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_variants pv ON oi.variant_id = pv.id
       WHERE oi.order_id = $1`,
      [order.order_id]
    );

    await sendOrderConfirmationEmail(order, itemsRes.rows);
  } catch (err) {
    console.error('[Payment] Failed to send order confirmation email:', err);
  }
}

async function clearCartForRazorpayOrder(rzpOrderId) {
  const orderRes = await pool.query(
    'SELECT user_id FROM orders WHERE razorpay_order_id = $1',
    [rzpOrderId]
  );
  const userId = orderRes.rows[0]?.user_id;
  if (userId) {
    await pool.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
  }
}

async function completeOrderPayment(razorpayOrderId, paymentId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      'SELECT * FROM orders WHERE razorpay_order_id = $1 FOR UPDATE',
      [razorpayOrderId]
    );

    if (orderRes.rows.length === 0) {
      throw new Error('Order not found for this payment.');
    }

    const order = orderRes.rows[0];

    if (order.payment_status === 'paid') {
      await client.query('COMMIT');
      return order;
    }

    const itemsRes = await client.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.order_id]
    );

    await fulfillOrderItemsStock(client, itemsRes.rows, order.user_id);

    const updatedRes = await client.query(
      `UPDATE orders
       SET payment_status = 'paid', payment_id = $1, order_status = 'Ordered', confirmed_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [paymentId, order.id]
    );

    await client.query('COMMIT');
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Rate limiting for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 15,
  message: { error: 'Too many payment requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize Razorpay client
const rzpKeyId = process.env.RAZORPAY_KEY_ID;
const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

let razorpay = null;
if (rzpKeyId && rzpKeySecret && !rzpKeyId.includes('placeholder')) {
  razorpay = new Razorpay({
    key_id: rzpKeyId,
    key_secret: rzpKeySecret,
  });
  console.log('Razorpay payment gateway initialized.');
} else {
  console.warn('Razorpay keys not configured — payments will use mock mode.');
}

// Create Razorpay Order
router.post('/create-order', authMiddleware, paymentLimiter, async (req, res) => {
  try {
    const { amount, order_id } = req.body;
    if (!order_id || amount === undefined) {
      return res.status(400).json({ error: 'Order ID and amount are required.' });
    }

    // Fetch order from database to verify amount and ownership
    const orderRes = await pool.query(
      'SELECT total_amount, user_id, payment_status FROM orders WHERE order_id = $1',
      [order_id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const dbOrder = orderRes.rows[0];

    if (dbOrder.payment_status !== 'pending') {
      return res.status(400).json({ error: 'This order is no longer awaiting payment.' });
    }

    // Verify ownership
    if (String(dbOrder.user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized order access.' });
    }

    // Verify amount (convert total_amount to paisa)
    const expectedAmountPaisa = Math.round(parseFloat(dbOrder.total_amount) * 100);
    if (Math.abs(expectedAmountPaisa - amount) > 10) { // allow 10 paisa rounding difference
      return res.status(400).json({ error: 'Order amount mismatch.' });
    }

    // Validate that all products in the order still exist and are active
    const orderItemsRes = await pool.query(
      'SELECT product_id FROM order_items WHERE order_id = $1',
      [order_id]
    );

    for (const item of orderItemsRes.rows) {
      const prodRes = await pool.query(
        'SELECT id, is_active FROM products WHERE id = $1',
        [item.product_id]
      );
      if (prodRes.rows.length === 0) {
        return res.status(400).json({ error: 'One or more products in your order are no longer available. Please contact support.' });
      }
      if (!prodRes.rows[0].is_active) {
        return res.status(400).json({ error: 'One or more products in your order are no longer available. Please contact support.' });
      }
    }

    // Delivery charge included in order total (no GST)
    const deliveryCharge = DELIVERY_CHARGE;

    let razorpayOrder = null;

    if (razorpay) {
      try {
        const options = {
          amount: expectedAmountPaisa,
          currency: 'INR',
          receipt: ('rcpt_' + order_id).slice(0, 40),
          notes: {
            user_id: req.user.id,
            order_id: order_id,
            delivery_charge: deliveryCharge.toFixed(2)
          }
        };

        const order = await razorpay.orders.create(options);
        razorpayOrder = {
          key: rzpKeyId,
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          delivery_charge: deliveryCharge,
          is_mock: false
        };

        await pool.query(
          'UPDATE orders SET razorpay_order_id = $1 WHERE order_id = $2',
          [order.id, order_id]
        );
      } catch (rzpErr) {
        const rzpMessage = rzpErr?.error?.description || rzpErr?.message || 'Unknown Razorpay error';
        console.error('Razorpay order creation failed:', rzpMessage);

        // Fall back to mock payment so checkout still works while keys are being fixed
        const mockOrderId = 'order_mock_' + Math.random().toString(36).substring(7);
        razorpayOrder = {
          key: rzpKeyId,
          id: mockOrderId,
          amount: expectedAmountPaisa,
          currency: 'INR',
          delivery_charge: deliveryCharge,
          is_mock: true,
          razorpay_error: rzpMessage
        };

        await pool.query(
          'UPDATE orders SET razorpay_order_id = $1 WHERE order_id = $2',
          [mockOrderId, order_id]
        );
      }
    } else {
      console.warn('Razorpay is not configured or uses placeholder keys. Returning simulated mock order.');
      const mockOrderId = 'order_mock_' + Math.random().toString(36).substring(7);
      razorpayOrder = {
        key: 'rzp_test_placeholder_key_id',
        id: mockOrderId,
        amount: expectedAmountPaisa,
        currency: 'INR',
        delivery_charge: deliveryCharge,
        is_mock: true
      };

      // Update order with razorpay_order_id
      await pool.query(
        'UPDATE orders SET razorpay_order_id = $1 WHERE order_id = $2',
        [mockOrderId, order_id]
      );
    }

    return res.json(razorpayOrder);
  } catch (err) {
    console.error('Payment order creation failed:', err);
    const message = err?.error?.description || err?.message || 'Failed to create payment order.';
    res.status(500).json({ error: message });
  }
});

// Verify Payment signature
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    
    // Mock verify support
    if (razorpay_order_id && razorpay_order_id.startsWith('order_mock_')) {
      await completeOrderPayment(
        razorpay_order_id,
        razorpay_payment_id || 'pay_mock_' + Math.random().toString(36).substring(7)
      );
      await clearCartForRazorpayOrder(razorpay_order_id);
      await sendConfirmationEmailForRazorpayOrder(razorpay_order_id);
      return res.json({ verified: true, message: 'Mock payment verified successfully.' });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing signature verification parameters.' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', rzpKeySecret)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      await completeOrderPayment(razorpay_order_id, razorpay_payment_id);
      await clearCartForRazorpayOrder(razorpay_order_id);
      await sendConfirmationEmailForRazorpayOrder(razorpay_order_id);
      res.json({ verified: true, message: 'Payment verified successfully.' });
    } else {
      res.status(400).json({ verified: false, error: 'Payment signature verification failed.' });
    }
  } catch (err) {
    console.error('Payment verification failed:', err);
    res.status(500).json({ error: 'Payment verification failed.' });
  }
});

// Webhook listener for captured payments (mounted with express.raw in index.js)
export async function handleRazorpayWebhook(req, res) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (webhookSecret && !webhookSecret.includes('placeholder')) {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
    const digest = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    if (digest !== signature) {
      console.warn('Webhook signature mismatch.');
      return res.status(400).send('Invalid signature');
    }
  }

  let payload;
  try {
    payload = req.body instanceof Buffer ? JSON.parse(req.body.toString('utf8')) : req.body;
  } catch {
    return res.status(400).send('Invalid payload');
  }

  const event = payload.event;
  console.log(`Razorpay webhook event: ${event}`);

  if (event === 'payment.captured' || event === 'order.paid') {
    const payment = payload.payload?.payment?.entity;
    if (!payment) {
      return res.status(400).send('Missing payment entity');
    }

    const rzpOrderId = payment.order_id;
    const rzpPaymentId = payment.id;

    try {
      await completeOrderPayment(rzpOrderId, rzpPaymentId);
      console.log(`Order paid via webhook for Razorpay order: ${rzpOrderId}`);
      await clearCartForRazorpayOrder(rzpOrderId);
      await sendConfirmationEmailForRazorpayOrder(rzpOrderId);
    } catch (err) {
      console.error('Error updating order from webhook:', err);
      return res.status(500).send('Webhook processing failed');
    }
  }

  res.json({ status: 'ok' });
}

export default router;
