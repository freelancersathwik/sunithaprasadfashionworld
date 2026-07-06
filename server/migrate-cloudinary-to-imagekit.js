import pg from 'pg';
import ImageKit from 'imagekit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// ImageKit configuration
const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

// Statistics
let totalProducts = 0;
let totalImages = 0;
let successfulUploads = 0;
let failedUploads = 0;
let skippedImages = 0;

// Check if URL is already ImageKit
function isImageKitURL(url) {
  return url && url.includes('imagekit.io');
}

// Download image from URL
async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error.message);
    throw error;
  }
}

// Upload image to ImageKit
async function uploadToImageKit(buffer, fileName, folder = 'sunithaprasad_sarees') {
  try {
    const base64File = buffer.toString('base64');
    const result = await imagekit.upload({
      file: base64File,
      fileName: fileName,
      folder: folder,
    });
    return {
      url: result.url,
      fileId: result.fileId,
    };
  } catch (error) {
    console.error(`Error uploading to ImageKit:`, error.message);
    throw error;
  }
}

// Extract filename from URL
function getFileNameFromURL(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    return filename || `image_${Date.now()}.jpg`;
  } catch (error) {
    return `image_${Date.now()}.jpg`;
  }
}

// Migrate a single product
async function migrateProduct(product, index, total) {
  console.log(`\nProduct ${index + 1}/${total}: ${product.name}`);
  
  const imageUrls = product.image_urls || [];
  const imagePublicIds = product.image_public_ids || [];
  
  if (imageUrls.length === 0) {
    console.log('  No images to migrate');
    return;
  }
  
  console.log(`  Processing ${imageUrls.length} images...`);
  
  const newImageUrls = [];
  const newImagePublicIds = [];
  
  for (let i = 0; i < imageUrls.length; i++) {
    const oldUrl = imageUrls[i];
    const oldPublicId = imagePublicIds[i] || null;
    
    totalImages++;
    console.log(`  Image ${i + 1}/${imageUrls.length}: ${oldUrl.substring(0, 50)}...`);
    
    // Skip if already ImageKit
    if (isImageKitURL(oldUrl)) {
      console.log('    Skipping (already ImageKit)');
      newImageUrls.push(oldUrl);
      newImagePublicIds.push(oldPublicId);
      skippedImages++;
      continue;
    }
    
    try {
      // Download from Cloudinary
      console.log('    Downloading from Cloudinary...');
      const buffer = await downloadImage(oldUrl);
      
      // Upload to ImageKit
      const fileName = getFileNameFromURL(oldUrl);
      console.log(`    Uploading to ImageKit as ${fileName}...`);
      const result = await uploadToImageKit(buffer, fileName, 'sunithaprasad_sarees');
      
      newImageUrls.push(result.url);
      newImagePublicIds.push(result.fileId);
      
      successfulUploads++;
      console.log(`    Success: ${result.url}`);
    } catch (error) {
      console.error(`    Failed: ${error.message}`);
      // Keep original URL and public_id on failure
      newImageUrls.push(oldUrl);
      newImagePublicIds.push(oldPublicId);
      failedUploads++;
    }
  }
  
  // Update product in database
  try {
    await pool.query(
      `UPDATE products SET image_urls = $1, image_public_ids = $2 WHERE id = $3`,
      [JSON.stringify(newImageUrls), JSON.stringify(newImagePublicIds), product.id]
    );
    console.log('  Product updated in database');
  } catch (error) {
    console.error(`  Failed to update product: ${error.message}`);
  }
}

// Main migration function
async function migrate() {
  console.log('Starting Cloudinary to ImageKit migration...\n');
  console.log('Configuration:');
  console.log('  Database:', process.env.DATABASE_URL ? 'Connected' : 'Not configured');
  console.log('  ImageKit URL Endpoint:', process.env.IMAGEKIT_URL_ENDPOINT || 'Not configured');
  console.log('  ImageKit Public Key:', process.env.IMAGEKIT_PUBLIC_KEY ? 'Set' : 'Not set');
  console.log('  ImageKit Private Key:', process.env.IMAGEKIT_PRIVATE_KEY ? 'Set' : 'Not set');
  
  if (!process.env.IMAGEKIT_URL_ENDPOINT || !process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY) {
    console.error('\nERROR: ImageKit environment variables not configured!');
    console.error('Please set IMAGEKIT_URL_ENDPOINT, IMAGEKIT_PUBLIC_KEY, and IMAGEKIT_PRIVATE_KEY');
    process.exit(1);
  }
  
  try {
    // Get all products with images
    console.log('\nFetching products from database...');
    const result = await pool.query(
      `SELECT id, name, image_urls, image_public_ids FROM products WHERE image_urls IS NOT NULL AND jsonb_array_length(image_urls) > 0`
    );
    
    const products = result.rows;
    totalProducts = products.length;
    
    console.log(`Found ${totalProducts} products with images\n`);
    
    if (totalProducts === 0) {
      console.log('No products to migrate. Exiting.');
      return;
    }
    
    // Migrate each product
    for (let i = 0; i < products.length; i++) {
      await migrateProduct(products[i], i, totalProducts);
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total products processed: ${totalProducts}`);
    console.log(`Total images processed: ${totalImages}`);
    console.log(`Successful uploads: ${successfulUploads}`);
    console.log(`Failed uploads: ${failedUploads}`);
    console.log(`Skipped (already ImageKit): ${skippedImages}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrate().then(() => {
  console.log('\nMigration completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\nMigration failed:', error);
  process.exit(1);
});
