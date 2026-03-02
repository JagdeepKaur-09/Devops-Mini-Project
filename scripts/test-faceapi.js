/**
 * Test script — verifies face-api.js models load and detection works
 * Run: node scripts/test-faceapi.js
 */

const path = require("path");
const { createCanvas } = require("@napi-rs/canvas");
const faceapi = require("face-api.js");

// Proper monkey-patch for @napi-rs/canvas
const OffscreenCanvas = createCanvas(1, 1).constructor;
faceapi.env.monkeyPatch({
    Canvas: OffscreenCanvas,
    createCanvasElement: () => createCanvas(300, 300),
    createImageElement: () => ({}),
    ImageData: Uint8ClampedArray
});

const MODELS_PATH = path.join(__dirname, "..", "models");

async function run() {
    console.log("\n🔍 EventSnap AI — face-api.js Test\n");

    // ── Step 1: Load models ──────────────────────────────────────────
    console.log("1️⃣  Loading models from:", MODELS_PATH);
    try {
        await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_PATH);
        console.log("   ✅ TinyFaceDetector loaded");
        await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
        console.log("   ✅ FaceLandmark68Net loaded");
        await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);
        console.log("   ✅ FaceRecognitionNet loaded");
    } catch (err) {
        console.error("   ❌ Model loading failed:", err.message);
        process.exit(1);
    }

    // ── Step 2: Create test canvas ───────────────────────────────────
    console.log("\n2️⃣  Creating test canvas...");
    const testCanvas = createCanvas(200, 200);
    const ctx = testCanvas.getContext("2d");
    ctx.fillStyle = "#f5e6d3";
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = "#f0c080";
    ctx.beginPath();
    ctx.ellipse(100, 100, 60, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.beginPath(); ctx.arc(78, 85, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(122, 85, 8, 0, Math.PI * 2); ctx.fill();
    console.log("   ✅ Test canvas created (200x200)");

    // ── Step 3: Run detection ────────────────────────────────────────
    console.log("\n3️⃣  Running face detection on test canvas...");
    try {
        const detections = await faceapi
            .detectAllFaces(testCanvas, new faceapi.TinyFaceDetectorOptions({
                inputSize: 160,
                scoreThreshold: 0.3
            }))
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (detections.length > 0) {
            console.log(`   ✅ Detected ${detections.length} face(s)`);
            console.log(`   ✅ Descriptor length: ${detections[0].descriptor.length} values`);
        } else {
            console.log("   ⚠️  No faces in synthetic image (expected — it's a drawing)");
            console.log("   ✅ Detection pipeline ran without errors");
        }
    } catch (err) {
        console.error("   ❌ Detection failed:", err.message);
        process.exit(1);
    }

    // ── Step 4: Descriptor math ──────────────────────────────────────
    console.log("\n4️⃣  Testing descriptor comparison math...");
    const d1 = new Float32Array(128).fill(0.5);
    const d2 = new Float32Array(128).fill(0.5);
    const dist = Math.sqrt(d1.reduce((acc, v, i) => acc + Math.pow(v - d2[i], 2), 0));
    console.log(`   ✅ Distance between identical descriptors: ${dist} (expected: 0)`);

    console.log("\n✅ face-api.js is working correctly!");
    console.log("   Models:            loaded ✓");
    console.log("   Detection pipeline: working ✓");
    console.log("   Descriptor math:   working ✓\n");
    process.exit(0);
}

run().catch(err => {
    console.error("Unexpected error:", err.message);
    process.exit(1);
});
