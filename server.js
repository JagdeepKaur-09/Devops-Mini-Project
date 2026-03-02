const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const dns = require("dns");
require("dotenv").config();

// Force Google DNS — fixes ECONNREFUSED on networks that block MongoDB SRV lookups
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
  cors: { origin: "http://localhost:4200" }
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:4200" }));
app.use(express.json());

// Rate limiting — generous limits for development
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: "Too many requests. Please try again later." },
  skip: () => process.env.NODE_ENV !== 'production'  // skip in development
}));

// Stricter limit on auth endpoints — only in production
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many login attempts. Please try again later." },
  skip: () => process.env.NODE_ENV !== 'production'
}));

// Make io accessible in routes via req.app.get("socketio")
app.set("socketio", io);

// Static Bootstrap assets
app.use("/css", express.static(path.join(__dirname, "node_modules/bootstrap/dist/css")));
app.use("/js", express.static(path.join(__dirname, "node_modules/bootstrap/dist/js")));

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");
    // On startup, recover any photos stuck in 'processing' from a previous crash
    const Photo = require("./models/Photo");
    const stuckCount = await Photo.countDocuments({ status: "processing" });
    if (stuckCount > 0) {
      console.log(`⚠️  Found ${stuckCount} stuck photo(s) — re-queuing...`);
      const stuck = await Photo.find({ status: "processing" });
      const imageQueue = require("./queues/imageQueue");
      for (const p of stuck) {
        await imageQueue.add({ photoId: p._id.toString(), imageUrl: p.cloudinaryUrl });
      }
    }
  })
  .catch(err => console.error("❌ MongoDB error:", err));

// Start background queue worker and pass Socket.io instance to it
const imageQueue = require("./queues/imageQueue");
imageQueue.setIo(io);

// Start scheduled cleanup job (clears face data older than 7 days)
require("./scripts/cleanup");

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/rooms", require("./routes/rooms"));
app.use("/api/photos", require("./routes/photos"));

// Serve frontend entry point
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/index.html"));
});

// Socket.io events
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`👤 User joined room: ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log("🔥 User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
