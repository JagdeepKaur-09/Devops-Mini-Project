const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields are required." });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ error: "Email already registered." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    res.json({ message: "User created successfully!" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Wrong password." });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ message: "Login successful!", token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register-face
router.post("/register-face", auth, async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    if (!faceDescriptor || faceDescriptor.length !== 128)
      return res.status(400).json({ error: "Invalid face data. Expected 128 values." });

    await User.findByIdAndUpdate(req.user.userId, { faceDescriptor });
    res.json({ message: "Face registered successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — returns basic profile + whether face is registered
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("name email faceDescriptor");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({
      name: user.name,
      email: user.email,
      hasFace: Array.isArray(user.faceDescriptor) && user.faceDescriptor.length === 128
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/my-face — user deletes their own face data
router.delete("/my-face", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { faceDescriptor: [] });
    res.json({ message: "Face data deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
