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

// Failed image URLs from previous migration (extracted from logs)
const failedImages = [
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780730888/sunithaprasad_sarees/w2bf6fykvxut6kr8pbqy.jpg',
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780736731/sunithaprasad_sarees/cuqasrejigrzlm41pvka.jpg',
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780828519/sunithaprasad_sarees/lt5jzx1bvwowatyaq4eq.png',
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780832848/sunithaprasad_sarees/oq31zdg6qbk8q7fhwjrr.jpg',
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780834511/sunithaprasad_sarees/ibnkivffeo1f2qywapjs.jpg',
  'https://res.cloudinary.com/dsww6s9bv/image/upload/v1780834511/sunithaprasad_sarees/ibnkivffeo1f2qywapjs.jpg'
];

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

// Main function
async function migrateMissingImages() {
  console.log('Starting migration of missing images...\n');
  console.log(`Found ${failedImages.length} failed images to migrate\n`);

  let successfulUploads = 0;
  let failedUploads = 0;

  for (let i = 0; i < failedImages.length; i++) {
    const oldUrl = failedImages[i];
    console.log(`Image ${i + 1}/${failedImages.length}: ${oldUrl.substring(0, 50)}...`);

    try {
      // Download from Cloudinary
      console.log('  Downloading from Cloudinary...');
      const buffer = await downloadImage(oldUrl);

      // Upload to ImageKit
      const fileName = getFileNameFromURL(oldUrl);
      console.log(`  Uploading to ImageKit as ${fileName}...`);
      const result = await uploadToImageKit(buffer, fileName, 'sunithaprasad_sarees');

      successfulUploads++;
      console.log(`  Success: ${result.url}`);
      console.log(`  File ID: ${result.fileId}\n`);
    } catch (error) {
      console.error(`  Failed: ${error.message}\n`);
      failedUploads++;
    }
  }

  console.log('='.repeat(50));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total images processed: ${failedImages.length}`);
  console.log(`Successful uploads: ${successfulUploads}`);
  console.log(`Failed uploads: ${failedUploads}`);
  console.log('='.repeat(50));

  await pool.end();
}

migrateMissingImages().then(() => {
  console.log('\nMigration completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\nMigration failed:', error);
  process.exit(1);
});
