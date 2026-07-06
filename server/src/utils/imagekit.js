import ImageKit from 'imagekit';
import dotenv from 'dotenv';

dotenv.config();

console.log('ImageKit import:', ImageKit);
console.log('ImageKit constructor:', ImageKit?.name);

const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

// Ensure URL endpoint has trailing slash
const normalizedUrlEndpoint = urlEndpoint && !urlEndpoint.endsWith('/') ? `${urlEndpoint}/` : urlEndpoint;

console.log('ImageKit Configuration:');
console.log('URL Endpoint:', normalizedUrlEndpoint);
console.log('Public Key:', publicKey ? 'set' : 'not set');
console.log('Private Key:', privateKey ? 'set' : 'not set');

if (!normalizedUrlEndpoint || !publicKey || !privateKey) {
  console.error('ERROR: Missing ImageKit environment variables!');
  console.error('Please set IMAGEKIT_URL_ENDPOINT, IMAGEKIT_PUBLIC_KEY, and IMAGEKIT_PRIVATE_KEY');
  throw new Error('Missing ImageKit configuration');
}

const imagekit = new ImageKit({
  urlEndpoint: normalizedUrlEndpoint,
  publicKey,
  privateKey,
});

console.log("ImageKit instance:", imagekit);
console.log("upload:", typeof imagekit.upload);
console.log("constructor:", imagekit.constructor?.name);

export default imagekit;
