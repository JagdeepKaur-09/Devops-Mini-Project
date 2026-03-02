const mongoose = require("mongoose");
const path = require("path");
const Photo = require("../models/Photo");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const faceapi = require("face-api.js");

// Load dotenv to ensure process.env.MONGO_URI is available
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Proper monkey-patch for @napi-rs/canvas with face-api.js
const OffscreenCanvas = createCanvas(1, 1).constructor;
faceapi.env.monkeyPatch({
  Canvas: OffscreenCanvas,
  createCanvasElement: () => createCanvas(300, 300),
  createImageElement: () => ({}),
  ImageData: Uint8ClampedArray
});

let modelsLoaded = false;
let dbConnected = false;

module.exports = async function(job) {
  const { photoId, imageUrl } = job.data;

  try {
    // 1. Establish DB Connection
    if (!dbConnected) {
      const uri = process.env.MONGO_URI;
      if (!uri) throw new Error("MONGO_URI is missing in processor environment");
      await mongoose.connect(uri);
      dbConnected = true;
      console.log(`[Queue Worker] Connected to MongoDB`);
    }

    // 2. Load Models
    if (!modelsLoaded) {
      const modelsPath = path.join(__dirname, "../models");
      await faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
      modelsLoaded = true;
      console.log(`[Queue Worker] Face-api models loaded`);
    }

    // 3. Process Image
    console.log(`[Queue Worker] Processing photo ${photoId}...`);
    const img = await loadImage(imageUrl);
    const cvs = createCanvas(img.width, img.height);
    const ctx = cvs.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const detections = await faceapi
      .detectAllFaces(cvs, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    const faceDescriptors = detections.map(d => Array.from(d.descriptor));

    // 4. Update Database
    const photo = await Photo.findByIdAndUpdate(
      photoId,
      { faceDescriptors, status: "processed", processedAt: new Date() },
      { new: true }
    );

    if (!photo) {
      throw new Error(`Photo not found: ${photoId}`);
    }

    console.log(`[Queue Worker] ✅ Processed photo ${photoId} — ${faceDescriptors.length} face(s) found`);
    
    // 5. Return data for the main process to emit socket events
    return {
      status: "completed",
      facesFound: faceDescriptors.length,
      photoId: photo._id.toString(),
      cloudinaryUrl: photo.cloudinaryUrl,
      roomId: photo.roomId.toString()
    };
  } catch (err) {
    console.error(`[Queue Worker] ❌ Error processing photo ${photoId}:`, err);
    throw err;
  }
};
