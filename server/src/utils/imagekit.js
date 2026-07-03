import ImageKit from '@imagekit/nodejs';
import dotenv from 'dotenv';

dotenv.config();

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

export default imagekit;
