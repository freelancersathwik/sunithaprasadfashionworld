import ImageKit from '@imagekit/nodejs';
import dotenv from 'dotenv';

dotenv.config();

const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

console.log('ImageKit Configuration:');
console.log('URL Endpoint:', urlEndpoint);
console.log('Public Key:', publicKey ? 'set' : 'not set');
console.log('Private Key:', privateKey ? 'set' : 'not set');

if (!urlEndpoint || !publicKey || !privateKey) {
  console.error('ERROR: Missing ImageKit environment variables!');
  console.error('Please set IMAGEKIT_URL_ENDPOINT, IMAGEKIT_PUBLIC_KEY, and IMAGEKIT_PRIVATE_KEY');
  throw new Error('Missing ImageKit configuration');
}

const imagekit = new ImageKit({
  urlEndpoint,
  publicKey,
  privateKey,
});

export default imagekit;
