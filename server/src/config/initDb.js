import pool from './db.js';
import bcrypt from 'bcryptjs';

// Helper to generate slugs
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
}

export async function initializeDatabase() {
  console.log('Initializing PostgreSQL database...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Addresses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        pincode VARCHAR(20) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        image TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT NOT NULL,
        category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
        original_price NUMERIC(10, 2),
        sale_price NUMERIC(10, 2) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        featured BOOLEAN DEFAULT FALSE,
        image_urls TEXT[] NOT NULL,
        image_public_ids TEXT[],
        fabric VARCHAR(100),
        occasion VARCHAR(100),
        work_type VARCHAR(100),
        blouse_included BOOLEAN DEFAULT TRUE,
        length VARCHAR(50),
        care_instructions TEXT,
        color VARCHAR(255),
        weight VARCHAR(50),
        blouse VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Product Variants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        color VARCHAR(100),
        stock INT DEFAULT 0,
        original_price NUMERIC(10,2),
        sale_price NUMERIC(10,2),
        image_urls TEXT[],
        image_public_ids TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);
      ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);
    `);

    // 6. Orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id VARCHAR(50) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        customer_name VARCHAR(255) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        email VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(255) NOT NULL,
        state VARCHAR(255) NOT NULL,
        pincode VARCHAR(20) NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        gst_percentage NUMERIC(5, 2) DEFAULT 0.00,
        gst_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
        weekend_discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        payment_id VARCHAR(255),
        razorpay_order_id VARCHAR(255),
        payment_status VARCHAR(50) DEFAULT 'pending',
        order_status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP,
        packed_at TIMESTAMP,
        shipped_at TIMESTAMP,
        delivered_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        cancellation_reason TEXT
      );
    `);

    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 100.00;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS weekend_discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
    `);

    // 7. Order Items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id VARCHAR(50) REFERENCES orders(order_id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
        quantity INT NOT NULL DEFAULT 1,
        price NUMERIC(10, 2) NOT NULL
      );
    `);

    // 8. Reviews table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review TEXT NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Wishlist table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wishlists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      );
    `);

    // 10. Cart Items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
        quantity INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id, variant_id)
      );
    `);

    // 11. Banners table
    await client.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255),
        subtitle VARCHAR(255),
        image_url TEXT NOT NULL,
        link_url VARCHAR(255) DEFAULT '/collections',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 12. Return Requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS return_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id VARCHAR(50) REFERENCES orders(order_id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 13. Audit Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 14. Stock History table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
        old_stock INT NOT NULL,
        new_stock INT NOT NULL,
        reason TEXT NOT NULL,
        changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 15. Inquiries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Performance Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart_items(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlists(user_id);');

    await client.query('COMMIT');
    console.log('Tables and indexes initialized successfully.');

    // Seeding Check
    const userCheck = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count, 10) === 0) {
      console.log('Database empty. Seeding initial mock data...');
      await seedDatabase(client);
    } else {
      console.log('Database already populated. Skipping seeding.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during database initialization:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function seedDatabase(client) {
  try {
    await client.query('BEGIN');

    // 1. Seed Users
    const hashedAdminPass = await bcrypt.hash('#sunithaprasad5000', 10);
    const hashedUserPass = await bcrypt.hash('user123', 10);

    const userMap = {};

    const usersData = [
      { name: 'Sunitha Prasad', email: 'sunithaprasad@gmail.com', mobile: '9876543210', password: hashedAdminPass, role: 'admin' },
      { name: 'Lakshmi Devi', email: 'lakshmi@example.com', mobile: '9876543211', password: hashedUserPass, role: 'user' },
      { name: 'Priya Sharma', email: 'priya@example.com', mobile: '9876543212', password: hashedUserPass, role: 'user' },
      { name: 'Anitha Reddy', email: 'anitha@example.com', mobile: '9876543213', password: hashedUserPass, role: 'user' },
      { name: 'Kavya Nair', email: 'kavya@example.com', mobile: '9876543214', password: hashedUserPass, role: 'user' },
    ];

    for (const u of usersData) {
      const res = await client.query(
        'INSERT INTO users (name, email, mobile, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name',
        [u.name, u.email, u.mobile, u.password, u.role]
      );
      userMap[u.name] = res.rows[0].id;
    }

    // Seed User Addresses
    const defaultAddressRes = await client.query(
      'INSERT INTO addresses (user_id, name, mobile, address, city, state, pincode, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [userMap['Lakshmi Devi'], 'Lakshmi Devi', '9876543211', '7-1-234, Srinivasa Nagar', 'Vijayawada', 'Andhra Pradesh', '520010', true]
    );

    // 2. Seed Categories
    const categoryMap = {};
    const categoriesData = [
      { name: 'Kanchipuram Sarees', image: 'https://images.unsplash.com/photo-1716504627981-22728cb2d2e2?w=400&h=400&fit=crop&auto=format' },
      { name: 'Banarasi Sarees', image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400&h=400&fit=crop&auto=format' },
      { name: 'Wedding Sarees', image: 'https://images.unsplash.com/photo-1619516388835-2b60acc4049e?w=400&h=400&fit=crop&auto=format' },
      { name: 'Designer Sarees', image: 'https://images.unsplash.com/photo-1614940685083-c5409b57da6e?w=400&h=400&fit=crop&auto=format' },
      { name: 'Cotton Sarees', image: 'https://images.unsplash.com/photo-1610189013429-a703f4b245cf?w=400&h=400&fit=crop&auto=format' },
      { name: 'Festival Sarees', image: 'https://images.unsplash.com/photo-1618901185975-d59f7091bcfe?w=400&h=400&fit=crop&auto=format' },
    ];

    for (const c of categoriesData) {
      const res = await client.query(
        'INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING id',
        [c.name, c.image]
      );
      categoryMap[c.name] = res.rows[0].id;
    }

    // 3. Seed Products
    const productMap = {};
    const productsData = [
      {
        name: 'Kanchipuram Pure Silk Saree',
        description: 'Exquisite Kanchipuram pure silk saree with traditional temple border and rich pallu. Handwoven by master weavers with pure zari work.',
        category: 'Kanchipuram Sarees',
        original_price: 8999,
        sale_price: 6499,
        stock: 15,
        featured: true,
        image_urls: [
          'https://images.unsplash.com/photo-1716504627981-22728cb2d2e2?w=600&h=800&fit=crop&auto=format',
          'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&h=800&fit=crop&auto=format',
        ],
        material: 'Pure Silk',
        occasion: 'Wedding',
        work_type: 'Pure Zari Weaving',
        blouse_included: true,
        length: '6.3 meters',
        care_instructions: 'Dry Clean Only',
        color: 'Maroon & Gold',
        weight: '750g',
        blouse: 'Running Blouse Piece Included',
      },
      {
        name: 'Banarasi Silk Saree',
        description: 'Stunning Banarasi silk saree with intricate Mughal-inspired motifs. Perfect for weddings and special occasions.',
        category: 'Banarasi Sarees',
        original_price: 8000,
        sale_price: 5999,
        stock: 12,
        featured: true,
        image_urls: [
          'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&h=800&fit=crop&auto=format',
        ],
        material: 'Silk',
        occasion: 'Festive / Wedding',
        work_type: 'Kadhwa Brocade Zari',
        blouse_included: true,
        length: '6.3 meters',
        care_instructions: 'Dry Clean Only',
        color: 'Red & Gold',
        weight: '700g',
        blouse: 'Unstitched Blouse Piece',
      },
      {
        name: 'Designer Organza Saree',
        description: 'Lightweight designer organza saree with delicate floral embroidery and sequin work. Ideal for parties and receptions.',
        category: 'Designer Sarees',
        original_price: 5500,
        sale_price: 4299,
        stock: 20,
        featured: true,
        image_urls: [
          'https://images.unsplash.com/photo-1614940685083-c5409b57da6e?w=600&h=800&fit=crop&auto=format',
        ],
        material: 'Organza',
        occasion: 'Party Wear',
        work_type: 'Floral Threadwork & Sequins',
        blouse_included: true,
        length: '6.3 meters',
        care_instructions: 'Dry Clean / Gentle Hand Wash',
        color: 'Peach & Silver',
        weight: '400g',
        blouse: 'Running Blouse Piece Included',
      },
      {
        name: 'Soft Silk Saree',
        description: 'Premium soft silk saree with contemporary designs. Comfortable drape with rich look perfect for daily wear and functions.',
        category: 'Kanchipuram Sarees',
        original_price: null,
        sale_price: 3499,
        stock: 25,
        featured: false,
        image_urls: [
          'https://images.unsplash.com/photo-1619516388835-2b60acc4049e?w=600&h=800&fit=crop&auto=format',
        ],
        material: 'Soft Silk',
        occasion: 'General Wear / Festival',
        work_type: 'Jacquard Weaving',
        blouse_included: true,
        length: '6.3 meters',
        care_instructions: 'Dry Clean Preferred',
        color: 'Purple & Gold',
        weight: '550g',
        blouse: 'Running Blouse Piece Included',
      },
      {
        name: 'Bridal Pattu Saree',
        description: 'Gorgeous bridal pattu saree with heavy zari border and rich pallu. The perfect saree for your special day.',
        category: 'Wedding Sarees',
        original_price: 15999,
        sale_price: 12999,
        stock: 5,
        featured: true,
        image_urls: [
          'https://images.unsplash.com/photo-1618901185975-d59f7091bcfe?w=600&h=800&fit=crop&auto=format',
        ],
        material: 'Pure Pattu Silk',
        occasion: 'Bridal Wear',
        work_type: 'Korvai Double Warp Zari',
        blouse_included: true,
        length: '6.3 meters',
        care_instructions: 'Dry Clean Only',
        color: 'Red & Maroon',
        weight: '900g',
        blouse: 'Contrast Blouse Piece Included',
      },
      {
        name: 'Cotton Handloom Saree',
        description: 'Breathable cotton handloom saree with traditional motifs. Perfect for everyday elegance and office wear.',
        category: 'Cotton Sarees',
        original_price: 2500,
        sale_price: 1999,
        stock: 30,
        featured: false,
        image_urls: [
          'https://images.unsplash.com/photo-1610189013429-a703f4b245cf?w=600&h=800&fit=crop&auto=format',
        ],
        material: 'Pure Handloom Cotton',
        occasion: 'Office Wear / Casual',
        work_type: 'Thread Border Weaving',
        blouse_included: true,
        length: '6.3 meters',
        care_instructions: 'Gentle Hand Wash with Mild Detergent',
        color: 'Blue & White',
        weight: '350g',
        blouse: 'Running Blouse Piece Included',
      },
      {
        name: 'Festive Chanderi Saree',
        description: 'Elegant Chanderi saree with golden zari weaving. Lightweight and graceful for festive celebrations.',
        category: 'Festival Sarees',
        original_price: 4999,
        sale_price: 3799,
        stock: 18,
        featured: true,
        image_urls: [
          'https://images.unsplash.com/photo-1618901185975-d59f7091bcfe?w=600&h=800&fit=crop&auto=format',
        ],
        material: 'Chanderi Silk Cotton',
        occasion: 'Festive / Festival',
        work_type: 'Golden Zari Buti',
        blouse_included: true,
        length: '6.3 meters',
        care_instructions: 'Dry Clean Recommended',
        color: 'Green & Gold',
        weight: '450g',
        blouse: 'Unstitched Blouse Piece',
      },
      {
        name: 'Mysore Crepe Silk Saree',
        description: 'Luxurious Mysore crepe silk saree with a smooth finish and elegant drape. A timeless classic.',
        category: 'Designer Sarees',
        original_price: 6500,
        sale_price: 4999,
        stock: 10,
        featured: false,
        image_urls: [
          'https://images.unsplash.com/photo-1619516388835-2b60acc4049e?w=600&h=800&fit=crop&auto=format',
        ],
        material: 'Mysore Crepe Silk',
        occasion: 'Festive / Formal Meetings',
        work_type: 'Plain Body with Gold Zari Border',
        blouse_included: true,
        length: '6.3 meters',
        care_instructions: 'Dry Clean Only',
        color: 'Teal & Gold',
        weight: '500g',
        blouse: 'Running Blouse Piece Included',
      },
    ];

    for (const p of productsData) {
      const slug = slugify(p.name + '-' + p.color);
      const categoryId = categoryMap[p.category];

      const res = await client.query(
        `INSERT INTO products (
          name, slug, description, category_id, original_price, sale_price, stock, featured, image_urls, 
          fabric, occasion, work_type, blouse_included, length, care_instructions, color, weight, blouse
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
        [
          p.name, slug, p.description, categoryId, p.original_price, p.sale_price, p.stock, p.featured, p.image_urls,
          p.material, p.occasion, p.work_type, p.blouse_included, p.length, p.care_instructions, p.color, p.weight, p.blouse
        ]
      );
      productMap[p.name] = res.rows[0].id;

      // Seed product variants (e.g. Red, Blue variant examples for a product)
      if (p.name === 'Kanchipuram Pure Silk Saree') {
        const pId = res.rows[0].id;
        await client.query(
          'INSERT INTO product_variants (product_id, color, stock, image_urls) VALUES ($1, $2, $3, $4)',
          [pId, 'Blue & Gold', 5, ['https://images.unsplash.com/photo-1619516388835-2b60acc4049e?w=600&h=800&fit=crop&auto=format']]
        );
        await client.query(
          'INSERT INTO product_variants (product_id, color, stock, image_urls) VALUES ($1, $2, $3, $4)',
          [pId, 'Pink & Gold', 3, ['https://images.unsplash.com/photo-1614940685083-c5409b57da6e?w=600&h=800&fit=crop&auto=format']]
        );
      }

      // Track stock history
      await client.query(
        'INSERT INTO stock_history (product_id, old_stock, new_stock, reason) VALUES ($1, $2, $3, $4)',
        [res.rows[0].id, 0, p.stock, 'initial_stock_seed']
      );
    }

    // 4. Seed Orders
    const ordersData = [
      {
        order_id: 'SPFW-20260606-10001',
        user_name: 'Lakshmi Devi',
        mobile: '9876543211',
        email: 'lakshmi@example.com',
        address: '7-1-234, Srinivasa Nagar',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        pincode: '520010',
        total_amount: 8498,
        gst_percentage: 5.00,
        gst_amount: 404.66,
        payment_id: 'pay_mock_001',
        razorpay_order_id: 'order_mock_001',
        payment_status: 'paid',
        order_status: 'Delivered',
        created_at: new Date('2026-05-28T10:00:00Z'),
        items: [
          { product_name: 'Kanchipuram Pure Silk Saree', quantity: 1, price: 6499 },
          { product_name: 'Cotton Handloom Saree', quantity: 1, price: 1999 },
        ]
      },
      {
        order_id: 'SPFW-20260606-10002',
        user_name: 'Priya Sharma',
        mobile: '9876543212',
        email: 'priya@example.com',
        address: '12-5-89, MG Road',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500003',
        total_amount: 12999,
        gst_percentage: 5.00,
        gst_amount: 619.00,
        payment_id: 'pay_mock_002',
        razorpay_order_id: 'order_mock_002',
        payment_status: 'paid',
        order_status: 'Shipped',
        created_at: new Date('2026-05-28T11:00:00Z'),
        items: [
          { product_name: 'Bridal Pattu Saree', quantity: 1, price: 12999 }
        ]
      }
    ];

    for (const o of ordersData) {
      const userId = userMap[o.user_name] || null;
      await client.query(
        `INSERT INTO orders (
          order_id, user_id, customer_name, mobile, email, address, city, state, pincode, 
          total_amount, gst_percentage, gst_amount, payment_id, razorpay_order_id, payment_status, order_status, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          o.order_id, userId, o.user_name, o.mobile, o.email, o.address, o.city, o.state, o.pincode,
          o.total_amount, o.gst_percentage, o.gst_amount, o.payment_id, o.razorpay_order_id, o.payment_status, o.order_status, o.created_at
        ]
      );

      for (const item of o.items) {
        const prodId = productMap[item.product_name];
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
          [o.order_id, prodId, item.quantity, item.price]
        );
      }
    }

    // 5. Seed Reviews
    const reviewsData = [
      { product_name: 'Kanchipuram Pure Silk Saree', user_name: 'Lakshmi Devi', rating: 5, review: 'Absolutely stunning saree! The silk quality is exceptional and the zari work is beautiful.', created_at: '2026-05-30T10:00:00Z' },
      { product_name: 'Kanchipuram Pure Silk Saree', user_name: 'Priya Sharma', rating: 4, review: 'Beautiful saree, loved the color combination. Delivery was quick.', created_at: '2026-05-31T10:00:00Z' },
      { product_name: 'Banarasi Silk Saree', user_name: 'Anitha Reddy', rating: 5, review: 'This Banarasi saree is a masterpiece. Wore it for my sister\'s wedding and received so many compliments!', created_at: '2026-06-01T10:00:00Z' },
    ];

    for (const r of reviewsData) {
      const prodId = productMap[r.product_name];
      const userId = userMap[r.user_name];
      await client.query(
        'INSERT INTO reviews (product_id, user_id, rating, review, user_name, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [prodId, userId, r.rating, r.review, r.user_name, r.created_at]
      );
    }

    const bannersData = [
      { title: 'ELEGANCE IN EVERY DRAPE', subtitle: 'Exclusive Collection 2026', image_url: '/saree_hero_banner.png', active: true },
      { title: 'ROYAL BANARASI WEAVES', subtitle: 'Timeless Heritage Sarees', image_url: '/saree_banarasi_banner.png', active: true },
      { title: 'BRIDAL SPECIAL COLLECTION', subtitle: 'Stunning Pattu Sarees for Your Big Day', image_url: '/saree_bridal_banner.png', active: true }
    ];

    for (const b of bannersData) {
      await client.query(
        'INSERT INTO banners (title, subtitle, image_url, active) VALUES ($1, $2, $3, $4)',
        [b.title, b.subtitle, b.image_url, b.active]
      );
    }

    await client.query('COMMIT');
    console.log('Mock data seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', err);
    throw err;
  }
}
