const express = require("express");
const router = express.Router();
const multer = require("multer");
const PDFDocument = require("pdfkit");
const axios = require("axios");
const cloudinary = require("../config/cloudinary");
const Photo = require("../models/Photo");
const Room = require("../models/Room");
const User = require("../models/User");
const auth = require("../middleware/auth");
const imageQueue = require("../queues/imageQueue");

// Multer — memory storage, images only, 10 MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Only image files are allowed."));
    cb(null, true);
  }
});

// ─── POST /api/photos/upload ──────────────────────────────────────────────────
// Organizer uploads a photo → saved to Cloudinary → queued for AI processing
router.post("/upload", auth, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const room = await Room.findById(req.body.roomId);
    if (!room) return res.status(404).json({ error: "Room not found." });

    if (room.organizerId.toString() !== req.user.userId.toString())
      return res.status(403).json({ error: "Only the room organizer can upload photos." });

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "eventsnap" },
        (error, result) => { if (error) reject(error); else resolve(result); }
      ).end(req.file.buffer);
    });
    const uploadResult = /** @type {{ secure_url: string }} */ (result);

    // Save photo record with status 'processing'
    const photo = new Photo({
      roomId: req.body.roomId,
      cloudinaryUrl: uploadResult.secure_url,
      status: "processing"
    });
    await photo.save();

    // Push to background queue for AI face detection
    await imageQueue.add({ photoId: photo._id.toString(), imageUrl: uploadResult.secure_url });

    res.json({ message: "Upload started! AI is scanning in the background.", photo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/photos/download-pdf ────────────────────────────────────────────
// MUST be before /:roomId to avoid Express matching it as a roomId param
router.get("/download-pdf", auth, async (req, res) => {
  try {
    const { images } = req.query;
    if (!images) return res.status(400).json({ error: "No images provided." });

    const imageUrls = images.split(",").filter(Boolean);
    const doc = new PDFDocument({ margin: 30 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=MyEventPhotos.pdf");
    doc.pipe(res);

    doc.fontSize(22).text("EventSnap AI — Your Gallery", { align: "center" });
    doc.moveDown();

    for (const url of imageUrls) {
      try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        // Use Buffer.from with no encoding — binary data must not be decoded as utf-8
        const buffer = Buffer.from(response.data);
        doc.addPage().image(buffer, { fit: [500, 600], align: "center", valign: "center" });
      } catch (imgErr) {
        console.error("Image fetch failed:", url, imgErr.message);
      }
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ error: "PDF Error: " + err.message });
  }
});

// ─── GET /api/photos/match/:roomId ───────────────────────────────────────────
// MUST be before /:roomId
router.get("/match/:roomId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.faceDescriptor || user.faceDescriptor.length === 0)
      return res.status(400).json({ error: "Register your face first!" });

    // Only match against fully processed photos
    const photos = await Photo.find({ roomId: req.params.roomId, status: "processed" });
    if (photos.length === 0)
      return res.json({ matches: [], maybe: [] });

    const userFace = new Float32Array(user.faceDescriptor);
    const highConfidence = [];
    const lowConfidence = [];

    photos.forEach(photo => {
      if (!photo.faceDescriptors || photo.faceDescriptors.length === 0) return;

      let bestDistance = 1.0;
      photo.faceDescriptors.forEach(faceData => {
        const photoFace = new Float32Array(faceData);
        const distance = Math.sqrt(
          userFace.reduce((acc, val, i) => acc + Math.pow(val - photoFace[i], 2), 0)
        );
        if (distance < bestDistance) bestDistance = distance;
      });

      if (bestDistance < 0.45) highConfidence.push(photo);
      else if (bestDistance < 0.6) lowConfidence.push(photo);
    });

    res.json({ matches: highConfidence, maybe: lowConfidence });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/photos/:roomId ──────────────────────────────────────────────────
// Must be LAST among GET routes to avoid swallowing the specific paths above
router.get("/:roomId", auth, async (req, res) => {
  try {
    const photos = await Photo.find({ roomId: req.params.roomId });
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/photos/:photoId ─────────────────────────────────────────────
// Organizer only — delete a single photo
router.delete("/:photoId", auth, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Photo not found." });

    const room = await Room.findById(photo.roomId);
    if (!room || room.organizerId.toString() !== req.user.userId.toString())
      return res.status(403).json({ error: "Only the room organizer can delete photos." });

    // Delete from Cloudinary
    const publicId = photo.cloudinaryUrl.split("/").pop()?.split(".")[0];
    if (publicId) {
      await cloudinary.uploader.destroy(`eventsnap/${publicId}`).catch(() => { });
    }

    await Photo.findByIdAndDelete(req.params.photoId);
    res.json({ message: "Photo deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
