const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  photoId: { type: mongoose.Schema.Types.ObjectId, ref: "Photo" },
  confidence: Number
}, { timestamps: true });

module.exports = mongoose.model("Match", matchSchema);