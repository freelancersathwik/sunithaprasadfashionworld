/**
 * Validate cart line items have enough stock (does not modify inventory).
 */
export async function validateOrderItemsStock(client, items) {
  for (const item of items) {
    const prodRes = await client.query(
      'SELECT name, stock FROM products WHERE id = $1 FOR UPDATE',
      [item.product_id]
    );
    if (prodRes.rows.length === 0) {
      throw new Error(`Product ${item.product_id} not found.`);
    }

    const product = prodRes.rows[0];
    let currentStock = product.stock;

    if (item.variant_id) {
      const variantRes = await client.query(
        'SELECT stock FROM product_variants WHERE id = $1 AND product_id = $2 FOR UPDATE',
        [item.variant_id, item.product_id]
      );
      if (variantRes.rows.length === 0) {
        throw new Error(`Variant ${item.variant_id} not found for product.`);
      }
      currentStock = variantRes.rows[0].stock;
    }

    if (currentStock < item.quantity) {
      throw new Error(`Insufficient stock for "${product.name}". Only ${currentStock} remaining.`);
    }
  }
}

/**
 * Deduct inventory after payment is confirmed.
 */
export async function fulfillOrderItemsStock(client, orderItems, userId) {
  for (const item of orderItems) {
    const prodRes = await client.query(
      'SELECT name, stock FROM products WHERE id = $1 FOR UPDATE',
      [item.product_id]
    );
    if (prodRes.rows.length === 0) {
      throw new Error(`Product ${item.product_id} not found.`);
    }

    const product = prodRes.rows[0];
    let currentStock = product.stock;

    if (item.variant_id) {
      const variantRes = await client.query(
        'SELECT stock FROM product_variants WHERE id = $1 AND product_id = $2 FOR UPDATE',
        [item.variant_id, item.product_id]
      );
      if (variantRes.rows.length === 0) {
        throw new Error(`Variant ${item.variant_id} not found for product.`);
      }
      currentStock = variantRes.rows[0].stock;

      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}". Only ${currentStock} remaining.`);
      }

      await client.query(
        'UPDATE product_variants SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.variant_id]
      );
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    } else {
      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}". Only ${currentStock} remaining.`);
      }

      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    const newStock = currentStock - item.quantity;
    await client.query(
      `INSERT INTO stock_history (product_id, variant_id, old_stock, new_stock, reason, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [item.product_id, item.variant_id || null, currentStock, newStock, 'sale', userId]
    );
  }
}

export async function deleteStalePendingOrders(client, userId) {
  if (!userId) return;
  await client.query(
    `DELETE FROM orders
     WHERE user_id = $1 AND payment_status = 'pending' AND order_status = 'Pending'`,
    [userId]
  );
}
