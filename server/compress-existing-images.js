import dotenv from 'dotenv';
import pg from 'pg';
import imagekit from './src/utils/imagekit.js';
import { uploadToImageKit, deleteFromImageKit } from './src/utils/imagekitUpload.js';
import { compressImage } from './src/utils/imageCompression.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Extract base filename from ImageKit filename (remove random suffixes)
function getBaseFilename(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  const extension = filename.substring(lastDotIndex);
  const nameWithoutExt = filename.substring(0, lastDotIndex);
  
  // Remove all underscore-separated suffixes
  const firstUnderscoreIndex = nameWithoutExt.indexOf('_');
  if (firstUnderscoreIndex > 0) {
    const baseName = nameWithoutExt.substring(0, firstUnderscoreIndex);
    return `${baseName}${extension}`;
  }
  
  return filename;
}

async function compressExistingImages() {
  console.log('Starting compression of existing ImageKit images...\n');

  try {
    // Get all files from ImageKit
    console.log('Fetching files from ImageKit...');
    const imageKitFiles = await imagekit.listFiles({
      path: 'sunithaprasad_sarees/',
    });

    console.log(`Found ${imageKitFiles.length} files in ImageKit\n`);

    let compressedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const fileMapping = {}; // old filename -> new fileId and URL

    for (const file of imageKitFiles) {
      console.log(`\nProcessing: ${file.name}`);
      console.log(`  Size: ${Math.round(file.size / 1024)}KB`);

      // Skip if already under 120KB
      if (file.size <= 120 * 1024) {
        console.log('  Already under 120KB, skipping');
        skippedCount++;
        fileMapping[file.name] = {
          fileId: file.fileId,
          url: file.url,
          filename: file.name
        }; // Keep same fileId and URL
        continue;
      }

      try {
        // Download the image
        console.log('  Downloading...');
        const response = await fetch(file.url);
        const buffer = Buffer.from(await response.arrayBuffer());
        console.log(`  Downloaded: ${Math.round(buffer.length / 1024)}KB`);

        // Compress the image
        console.log('  Compressing to 120KB...');
        const compressedBuffer = await compressImage(buffer, 120);
        console.log(`  Compressed: ${Math.round(compressedBuffer.length / 1024)}KB`);

        // Upload compressed version with same name
        console.log('  Uploading compressed version...');
        const uploadResult = await uploadToImageKit(
          compressedBuffer,
          file.name,
          'sunithaprasad_sarees'
        );
        console.log(`  Uploaded: ${uploadResult.url}`);
        console.log(`  New filename: ${uploadResult.url.split('/').pop()}`);

        // Delete old version
        console.log('  Deleting old version...');
        await deleteFromImageKit(file.fileId);
        console.log('  Old version deleted');

        // Map old filename to new fileId and URL
        fileMapping[file.name] = {
          fileId: uploadResult.fileId,
          url: uploadResult.url,
          oldFilename: file.name,
          newFilename: uploadResult.url.split('/').pop()
        };
        compressedCount++;
        console.log('  ✓ Compression complete');
      } catch (error) {
        console.error(`  ✗ Error: ${error.message}`);
        errorCount++;
        fileMapping[file.name] = {
          fileId: file.fileId,
          url: file.url,
          filename: file.name
        }; // Keep old fileId and URL on error
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('COMPRESSION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total files: ${imageKitFiles.length}`);
    console.log(`Compressed: ${compressedCount}`);
    console.log(`Skipped (already < 120KB): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('='.repeat(50));

    // Update database with new fileIds
    console.log('\nUpdating database with new fileIds...');
    
    const result = await pool.query(
      `SELECT id, name, image_urls, image_public_ids FROM products WHERE image_urls IS NOT NULL AND array_length(image_urls, 1) > 0`
    );

    const products = result.rows;
    console.log(`Found ${products.length} products with images\n`);

    // After compression, fetch the current list of files from ImageKit
    console.log('Fetching current ImageKit files after compression...');
    const currentImageKitFiles = await imagekit.listFiles({
      path: 'sunithaprasad_sarees/',
    });
    console.log(`Found ${currentImageKitFiles.length} files in ImageKit after compression\n`);

    // Create a mapping from base filename (without suffixes) to current fileId and URL
    const baseFilenameToImageKit = {};
    for (const file of currentImageKitFiles) {
      const filename = file.name;
      const baseFilename = getBaseFilename(filename);
      baseFilenameToImageKit[baseFilename] = {
        fileId: file.fileId,
        url: file.url,
        filename: filename
      };
    }
    console.log(`Created base filename mapping for ${Object.keys(baseFilenameToImageKit).length} files\n`);

    let productsUpdated = 0;
    let urlsUpdated = 0;

    for (const product of products) {
      const newImageUrls = [];
      const newImagePublicIds = [];
      let productUpdated = false;

      console.log(`\nChecking product: ${product.name}`);
      console.log(`  Image URLs count: ${product.image_urls.length}`);
      console.log(`  Public IDs count: ${product.image_public_ids.length}`);

      for (let i = 0; i < product.image_urls.length; i++) {
        const url = product.image_urls[i];
        const publicId = product.image_public_ids[i];

        console.log(`  URL ${i}: ${url.substring(0, 50)}...`);
        console.log(`  Public ID ${i}: ${publicId}`);

        // Check if this is an ImageKit URL
        if (url.includes('ik.imagekit.io')) {
          // Extract filename from URL
          const urlObj = new URL(url);
          const filename = urlObj.pathname.split('/').pop();
          console.log(`  Filename: ${filename}`);

          // Get base filename (remove random suffixes)
          const baseFilename = getBaseFilename(filename);
          console.log(`  Base filename: ${baseFilename}`);

          // Look up the current ImageKit file by base filename
          const currentFile = baseFilenameToImageKit[baseFilename];
          
          if (currentFile) {
            console.log(`    Current fileId: ${currentFile.fileId}`);
            console.log(`    Current filename: ${currentFile.filename}`);
            console.log(`    Database fileId: ${publicId}`);
            console.log(`    FileIds match: ${currentFile.fileId === publicId}`);

            if (currentFile.fileId !== publicId) {
              // Update with current fileId and URL
              newImageUrls.push(currentFile.url);
              newImagePublicIds.push(currentFile.fileId);
              productUpdated = true;
              urlsUpdated++;
              console.log(`  ✓ Updated URL for product "${product.name}": ${publicId} -> ${currentFile.fileId}`);
            } else {
              newImageUrls.push(url);
              newImagePublicIds.push(publicId);
            }
          } else {
            console.log(`    Base filename not found in ImageKit, keeping existing`);
            newImageUrls.push(url);
            newImagePublicIds.push(publicId);
          }
        } else {
          newImageUrls.push(url);
          newImagePublicIds.push(publicId);
        }
      }

      if (productUpdated) {
        await pool.query(
          `UPDATE products SET image_urls = $1, image_public_ids = $2 WHERE id = $3`,
          [newImageUrls, newImagePublicIds, product.id]
        );
        productsUpdated++;
        console.log(`  ✓ Updated product "${product.name}"`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('DATABASE UPDATE SUMMARY');
    console.log('='.repeat(50));
    console.log(`Products updated: ${productsUpdated}`);
    console.log(`URLs updated: ${urlsUpdated}`);
    console.log('='.repeat(50));

    await pool.end();
    console.log('\nCompression and database update completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

compressExistingImages();
