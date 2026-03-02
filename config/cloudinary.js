// Line 1: Import cloudinary package
const cloudinary = require('cloudinary').v2;

// Line 2: Import dotenv to access .env values
require('dotenv').config();

// Lines 3-9: Configure cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Line 10: Export so other files can use it
module.exports = cloudinary;