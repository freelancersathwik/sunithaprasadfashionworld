import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Mapping from Cloudinary URLs to ImageKit URLs and fileIds (extracted from migration logs)
// This is a sample mapping - you'll need to extract the actual mappings from your migration logs
const urlMapping = {
  // Example format:
  // 'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780730888/sunithaprasad_sarees/w2bf6fykvxut6kr8pbqy.jpg': {
  //   url: 'https://ik.imagekit.io/lfbb6ebts/sunithaprasad_sarees/w2bf6fykvxut6kr8pbqy_45DqFzCB7.jpg',
  //   fileId: 'some_file_id'
  // }
};

async function updateToImageKitUrls() {
  console.log('Updating database with ImageKit URLs...\n');

  try {
    // Get all products with Cloudinary URLs
    const result = await pool.query(
      `SELECT id, name, image_urls, image_public_ids FROM products WHERE image_urls IS NOT NULL AND array_length(image_urls, 1) > 0`
    );

    const products = result.rows;
    console.log(`Found ${products.length} products with images\n`);

    let updatedProducts = 0;
    let updatedUrls = 0;

    for (const product of products) {
      const imageUrls = product.image_urls || [];
      const imagePublicIds = product.image_public_ids || [];

      const newImageUrls = [];
      const newImagePublicIds = [];

      let productUpdated = false;

      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        const publicId = imagePublicIds[i] || null;

        // Check if this URL has a mapping
        if (urlMapping[url]) {
          console.log(`Updating URL for product "${product.name}": ${url.substring(0, 50)}...`);
          newImageUrls.push(urlMapping[url].url);
          newImagePublicIds.push(urlMapping[url].fileId);
          productUpdated = true;
          updatedUrls++;
        } else {
          newImageUrls.push(url);
          newImagePublicIds.push(publicId);
        }
      }

      // Update if any URLs were changed
      if (productUpdated) {
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
    console.log(`URLs updated: ${updatedUrls}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateToImageKitUrls().then(() => {
  console.log('\nCompleted successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\nFailed:', error);
  process.exit(1);
});
