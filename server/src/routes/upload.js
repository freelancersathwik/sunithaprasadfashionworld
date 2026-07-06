import { Router } from 'express';
import multer from 'multer';
import cloudinary from '../utils/cloudinary.js';
import imagekit from '../utils/imagekit.js';
import { uploadToImageKit, deleteFromImageKit } from '../utils/imagekitUpload.js';
import { compressImage } from '../utils/imageCompression.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper function to upload from memory stream to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'sunithaprasad_sarees' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// Helper function to upload to ImageKit
const uploadToImageKitHelper = async (fileBuffer, fileName) => {
  try {
    console.log('ImageKit configuration check:', {
      hasImagekit: !!imagekit,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ? 'set' : 'not set',
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY ? 'set' : 'not set',
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY ? 'set' : 'not set',
    });
    
    // Compress image to 120KB before upload
    console.log('Compressing image...');
    const compressedBuffer = await compressImage(fileBuffer, 120);
    console.log('Compression complete');
    
    const result = await uploadToImageKit(compressedBuffer, fileName, 'sunithaprasad_sarees');
    return result;
  } catch (error) {
    console.error('uploadToImageKitHelper error:', error);
    throw error;
  }
};

// POST /api/upload - Admin upload endpoint (using ImageKit only)
router.post('/', authMiddleware, adminMiddleware, upload.array('images', 8), async (req, res) => {
  try {
    console.log('Upload request received');
    console.log('Files:', req.files?.length);
    
    if (!req.files || req.files.length === 0) {
      console.log('No files uploaded');
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    console.log('Upload configuration check:', {
      hasImagekit: !!imagekit,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });

    console.log('Attempting ImageKit upload...');
    const uploadPromises = req.files.map(file => 
      uploadToImageKitHelper(file.buffer, file.originalname)
    );
    const results = await Promise.all(uploadPromises);

    const uploadedImages = results.map(result => ({
      url: result.url,
      public_id: result.fileId  // Return as public_id for frontend compatibility
    }));
    console.log('ImageKit upload successful:', uploadedImages);

    console.log('Returning uploaded images:', uploadedImages);
    res.json({ images: uploadedImages });
  } catch (err) {
    console.error('Upload error:', err);
    console.error('Upload error details:', JSON.stringify(err, null, 2));
    res.status(500).json({ error: 'Failed to upload images to ImageKit.' });
  }
});

// DELETE /api/upload - Admin delete endpoint for ImageKit images
router.delete('/:fileId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required.' });
    }

    await deleteFromImageKit(fileId);
    res.json({ message: 'Image deleted successfully from ImageKit.' });
  } catch (err) {
    console.error('ImageKit deletion error:', err);
    res.status(500).json({ error: 'Failed to delete image from ImageKit.' });
  }
});

export default router;
