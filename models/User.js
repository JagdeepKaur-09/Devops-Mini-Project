const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  faceDescriptor: { type: [Number], default: [] },
  consentGiven: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);