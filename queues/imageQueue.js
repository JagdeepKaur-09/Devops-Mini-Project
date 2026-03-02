const Queue = require("bull");
const path = require("path");

const imageQueue = new Queue(
  "image-processing",
  process.env.REDIS_URL || "redis://127.0.0.1:6379"
);

let _io = null;
imageQueue.setIo = (io) => { _io = io; };

// Listen to the completed event from the child process
imageQueue.on("completed", (job, result) => {
  if (_io && result && result.status === "processed") {
    _io.to(result.roomId).emit("photoProcessed", {
      photoId: result.photoId,
      status: result.status,
      cloudinaryUrl: result.cloudinaryUrl,
      roomId: result.roomId
    });
  }
});

imageQueue.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

// Dispatch processing to the child process (1 concurrency)
// This completely unblocks the main Node.js event loop
imageQueue.process(1, path.join(__dirname, "processor.js"));

module.exports = imageQueue;
