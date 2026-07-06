import pg from 'pg';
import ImageKit from 'imagekit';
import dotenv from 'dotenv';

dotenv.config();

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

// Extract filename from Cloudinary URL
function getFileNameFromCloudinaryURL(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    return filename || null;
  } catch (error) {
    return null;
  }
}

// Extract base filename from ImageKit URL (remove random suffix)
function getBaseFilenameFromImageKitURL(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    // Remove the random suffix (e.g., "filename_abc123.jpg" -> "filename.jpg")
    const lastUnderscoreIndex = filename.lastIndexOf('_');
    if (lastUnderscoreIndex > 0) {
      const baseName = filename.substring(0, lastUnderscoreIndex);
      const extension = filename.substring(filename.lastIndexOf('.'));
      return `${baseName}${extension}`;
    }
    return filename || null;
  } catch (error) {
    return null;
  }
}

async function updateFromImageKitAPI() {
  console.log('Updating database using ImageKit API...\n');

  try {
    // Get all files from ImageKit
    console.log('Fetching files from ImageKit...');
    const imageKitFiles = await imagekit.listFiles({
      path: 'sunithaprasad_sarees/',
    });

    console.log(`Found ${imageKitFiles.length} files in ImageKit\n`);

    // Create a mapping from base filename (without random suffix) to ImageKit URL and fileId
    const filenameToImageKit = {};
    console.log('ImageKit files:');
    for (const file of imageKitFiles) {
      const filename = file.name;
      const baseFilename = getBaseFilenameFromImageKitURL(file.url);
      // Store both the full filename and base filename for matching
      filenameToImageKit[filename] = {
        url: file.url,
        fileId: file.fileId,
      };
      if (baseFilename && baseFilename !== filename) {
        filenameToImageKit[baseFilename] = {
          url: file.url,
          fileId: file.fileId,
        };
      }
      console.log(`  ${filename} -> ${baseFilename}`);
    }
    console.log();

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

        // Skip if already ImageKit
        if (url.includes('ik.imagekit.io')) {
          newImageUrls.push(url);
          newImagePublicIds.push(publicId);
          continue;
        }

        // Extract filename from Cloudinary URL
        const cloudinaryFilename = getFileNameFromCloudinaryURL(url);
        
        if (cloudinaryFilename) {
          console.log(`  Cloudinary filename: ${cloudinaryFilename}`);
          console.log(`  Match found: ${filenameToImageKit[cloudinaryFilename] ? 'Yes' : 'No'}`);
        }
        
        if (cloudinaryFilename && filenameToImageKit[cloudinaryFilename]) {
          console.log(`Updating URL for product "${product.name}": ${cloudinaryFilename}`);
          newImageUrls.push(filenameToImageKit[cloudinaryFilename].url);
          newImagePublicIds.push(filenameToImageKit[cloudinaryFilename].fileId);
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

updateFromImageKitAPI().then(() => {
  console.log('\nCompleted successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\nFailed:', error);
  process.exit(1);
});
