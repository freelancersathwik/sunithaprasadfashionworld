import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Broken Cloudinary URLs to remove
const brokenUrls = [
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780730888/sunithaprasad_sarees/w2bf6fykvxut6kr8pbqy.jpg',
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780736731/sunithaprasad_sarees/cuqasrejigrzlm41pvka.jpg',
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780828519/sunithaprasad_sarees/lt5jzx1bvwowatyaq4eq.png',
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780832848/sunithaprasad_sarees/oq31zdg6qbk8q7fhwjrr.jpg',
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780834511/sunithaprasad_sarees/ibnkivffeo1f2qywapjs.jpg',
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780834511/sunithaprasad_sarees/ibnkivffeo1f2qywapjs.jpg'
];

async function removeBrokenUrls() {
  console.log('Removing broken Cloudinary URLs from database...\n');

  try {
    // Get all products
    const result = await pool.query(
      `SELECT id, name, image_urls, image_public_ids FROM products WHERE image_urls IS NOT NULL AND array_length(image_urls, 1) > 0`
    );

    const products = result.rows;
    console.log(`Found ${products.length} products with images\n`);

    let updatedProducts = 0;
    let removedUrls = 0;

    for (const product of products) {
      const imageUrls = product.image_urls || [];
      const imagePublicIds = product.image_public_ids || [];

      const newImageUrls = [];
      const newImagePublicIds = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        const publicId = imagePublicIds[i] || null;

        if (brokenUrls.includes(url)) {
          console.log(`Removing broken URL from product "${product.name}": ${url.substring(0, 50)}...`);
          removedUrls++;
        } else {
          newImageUrls.push(url);
          newImagePublicIds.push(publicId);
        }
      }

      // Update if any URLs were removed
      if (newImageUrls.length !== imageUrls.length) {
        await pool.query(
          `UPDATE products SET image_urls = $1, image_public_ids = $2 WHERE id = $3`,
          [newImageUrls, newImagePublicIds, product.id]
        );
        console.log(`Updated product "${product.name}"\n`);
        updatedProducts++;
      }
    }

    console.log('='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    console.log(`Products updated: ${updatedProducts}`);
    console.log(`Broken URLs removed: ${removedUrls}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

removeBrokenUrls().then(() => {
  console.log('\nCompleted successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\nFailed:', error);
  process.exit(1);
});
