import imagekit from './imagekit.js';

/**
 * Upload a file buffer to ImageKit
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - The name of the file
 * @param {string} folder - The folder to upload to (default: 'sunithaprasad_sarees')
 * @returns {Promise<Object>} - Object containing url and fileId
 */
export const uploadToImageKit = async (fileBuffer, fileName, folder = 'sunithaprasad_sarees') => {
  if (!imagekit) {
    throw new Error('ImageKit is not configured. Please set IMAGEKIT_URL_ENDPOINT, IMAGEKIT_PUBLIC_KEY, and IMAGEKIT_PRIVATE_KEY environment variables.');
  }
  
  try {
    // Convert buffer to base64 for ImageKit upload
    const base64File = fileBuffer.toString('base64');
    
    // Use the correct upload method for @imagekit/nodejs
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
    console.error('ImageKit upload error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    throw new Error(`Failed to upload image to ImageKit: ${error.message || 'Unknown error'}`);
  }
};

/**
 * Delete a file from ImageKit by fileId
 * @param {string} fileId - The ImageKit fileId to delete
 * @returns {Promise<void>}
 */
export const deleteFromImageKit = async (fileId) => {
  if (!imagekit) {
    throw new Error('ImageKit is not configured.');
  }
  
  try {
    await imagekit.deleteFile(fileId);
  } catch (error) {
    console.error('ImageKit deletion error:', error);
    throw new Error('Failed to delete image from ImageKit');
  }
};

/**
 * Bulk delete files from ImageKit
 * @param {Array<string>} fileIds - Array of ImageKit fileIds to delete
 * @returns {Promise<void>}
 */
export const bulkDeleteFromImageKit = async (fileIds) => {
  if (!imagekit) {
    throw new Error('ImageKit is not configured.');
  }
  
  try {
    await imagekit.bulkDeleteFiles(fileIds);
  } catch (error) {
    console.error('ImageKit bulk deletion error:', error);
    throw new Error('Failed to delete images from ImageKit');
  }
};
