/**
 * Downloads face-api.js model weight files from the official GitHub repo.
 * Run once before starting the server:
 *   node scripts/download-models.js
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const MODEL_FILES = [
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2",
];

// Backend models folder (used by the queue worker)
const BACKEND_DIR = path.join(__dirname, "..", "models");

// Frontend assets folder (used by the Angular register-face page)
const FRONTEND_DIR = path.join(__dirname, "..", "client", "src", "assets", "models");

function download(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            console.log(`  ⏭  Already exists: ${path.basename(dest)}`);
            return resolve();
        }
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            res.pipe(file);
            file.on("finish", () => { file.close(); resolve(); });
        }).on("error", (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function main() {
    // Ensure directories exist
    [BACKEND_DIR, FRONTEND_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    for (const file of MODEL_FILES) {
        const url = `${BASE_URL}/${file}`;
        console.log(`⬇  Downloading ${file}...`);
        try {
            await download(url, path.join(BACKEND_DIR, file));
            await download(url, path.join(FRONTEND_DIR, file));
            console.log(`  ✅ ${file}`);
        } catch (err) {
            console.error(`  ❌ Failed: ${file} — ${err.message}`);
        }
    }

    console.log("\n✅ All models downloaded.");
    console.log(`   Backend:  ${BACKEND_DIR}`);
    console.log(`   Frontend: ${FRONTEND_DIR}`);
}

main();
