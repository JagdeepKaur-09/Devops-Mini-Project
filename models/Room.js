const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  eventName: String,
  roomCode: { type: String, unique: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["processing", "ready"], default: "processing" }
}, { timestamps: true });

module.exports = mongoose.model("Room", roomSchema);