import ImageKit from '@imagekit/nodejs';
import dotenv from 'dotenv';

dotenv.config();

console.log('ImageKit Configuration:');
console.log('URL Endpoint:', process.env.IMAGEKIT_URL_ENDPOINT);
console.log('Public Key:', process.env.IMAGEKIT_PUBLIC_KEY ? 'set' : 'not set');
console.log('Private Key:', process.env.IMAGEKIT_PRIVATE_KEY ? 'set' : 'not set');

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

export default imagekit;
