import sharp from 'sharp';

/**
 * Compress image buffer to target size (default 120KB)
 * @param {Buffer} imageBuffer - The original image buffer
 * @param {number} targetSizeKB - Target size in KB (default: 120)
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
export const compressImage = async (imageBuffer, targetSizeKB = 120) => {
  try {
    const targetSizeBytes = targetSizeKB * 1024;
    
    // Get original image info
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`Original image: ${metadata.format}, ${Math.round(imageBuffer.length / 1024)}KB, ${metadata.width}x${metadata.height}`);
    
    // If already under target size, return as-is
    if (imageBuffer.length <= targetSizeBytes) {
      console.log('Image already under target size, skipping compression');
      return imageBuffer;
    }
    
    // Start with quality 80 and adjust if needed
    let quality = 80;
    let compressedBuffer;
    let iterations = 0;
    const maxIterations = 10;
    
    while (iterations < maxIterations) {
      // Compress with current quality
      compressedBuffer = await sharp(imageBuffer)
        .resize(metadata.width, metadata.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality, progressive: true })
        .toBuffer();
      
      const compressedSize = compressedBuffer.length;
      console.log(`Iteration ${iterations + 1}: Quality ${quality}, Size: ${Math.round(compressedSize / 1024)}KB`);
      
      // If under target size or quality too low, break
      if (compressedSize <= targetSizeBytes || quality <= 30) {
        break;
      }
      
      // Reduce quality by 10 for next iteration
      quality -= 10;
      iterations++;
    }
    
    // If still over target size after iterations, try reducing dimensions
    if (compressedBuffer.length > targetSizeBytes && iterations === maxIterations) {
      console.log('Quality reduction insufficient, trying dimension reduction');
      
      let scale = 0.9;
      let dimIterations = 0;
      const maxDimIterations = 5;
      
      while (dimIterations < maxDimIterations && compressedBuffer.length > targetSizeBytes) {
        const newWidth = Math.round(metadata.width * scale);
        const newHeight = Math.round(metadata.height * scale);
        
        compressedBuffer = await sharp(imageBuffer)
          .resize(newWidth, newHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 70, progressive: true })
          .toBuffer();
        
        console.log(`Dimension iteration ${dimIterations + 1}: ${newWidth}x${newHeight}, Size: ${Math.round(compressedBuffer.length / 1024)}KB`);
        
        scale -= 0.1;
        dimIterations++;
      }
    }
    
    console.log(`Final compressed size: ${Math.round(compressedBuffer.length / 1024)}KB (target: ${targetSizeKB}KB)`);
    return compressedBuffer;
  } catch (error) {
    console.error('Image compression error:', error);
    // Return original buffer if compression fails
    return imageBuffer;
  }
};

/**
 * Compress multiple image buffers
 * @param {Array<Buffer>} imageBuffers - Array of image buffers
 * @param {number} targetSizeKB - Target size in KB (default: 120)
 * @returns {Promise<Array<Buffer>>} - Array of compressed image buffers
 */
export const compressImages = async (imageBuffers, targetSizeKB = 120) => {
  const compressionPromises = imageBuffers.map(buffer => 
    compressImage(buffer, targetSizeKB)
  );
  return Promise.all(compressionPromises);
};
