import ImageKit from '@imagekit/nodejs';
import dotenv from 'dotenv';

dotenv.config();

let imagekit = null;

// Only initialize ImageKit if credentials are provided
if (process.env.IMAGEKIT_URL_ENDPOINT && process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY) {
  imagekit = new ImageKit({
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  });
}

export default imagekit;
