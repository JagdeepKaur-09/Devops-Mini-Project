const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  cloudinaryUrl: { type: String, required: true },
  // Array of face descriptors — each descriptor is 128 numbers
  faceDescriptors: { type: [[Number]], default: [] },
  status: { type: String, enum: ["processing", "processed"], default: "processing" },
  processedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("Photo", photoSchema);
