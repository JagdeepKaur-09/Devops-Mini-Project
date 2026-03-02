const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const crypto = require("crypto");
const auth = require("../middleware/auth");

// POST /api/rooms/create
router.post("/create", auth, async (req, res) => {
  const { eventName } = req.body;
  try {
    if (!eventName || !eventName.trim())
      return res.status(400).json({ error: "Event name is required." });

    const roomCode = crypto.randomBytes(6).toString("hex");
    const room = new Room({
      eventName: eventName.trim(),
      organizerId: req.user.userId,
      roomCode
    });
    await room.save();
    res.json({ message: "Room created!", roomCode });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/rooms/my-rooms
router.get("/my-rooms", auth, async (req, res) => {
  try {
    const rooms = await Room.find({ organizerId: req.user.userId }).sort({ createdAt: -1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms/:roomCode  — auth required so only logged-in users can look up rooms
router.get("/:roomCode", auth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.roomCode });
    if (!room) return res.status(404).json({ error: "Room not found." });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
