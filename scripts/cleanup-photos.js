/**
 * One-time cleanup script:
 * 1. Fixes photos with 'pending' status → 'processed'
 * 2. Removes duplicate photos (same URL in same room)
 *
 * Run: node scripts/cleanup-photos.js
 */

require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const mongoose = require("mongoose");
const Photo = require("../models/Photo");

async function main() {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log("✅ Connected to MongoDB\n");

    // Fix 1: 'pending' was the old status name — update to 'processed'
    const fixed = await Photo.updateMany({ status: "pending" }, { $set: { status: "processed" } });
    console.log(`Fixed 'pending' → 'processed': ${fixed.modifiedCount} photos`);

    // Fix 2: Remove duplicate photos (same cloudinaryUrl in same room)
    const all = await Photo.find().sort({ createdAt: 1 });
    const seen = new Map();
    const toDelete = [];

    for (const p of all) {
        const key = `${p.roomId}|${p.cloudinaryUrl}`;
        if (seen.has(key)) {
            toDelete.push(p._id);
        } else {
            seen.set(key, true);
        }
    }

    if (toDelete.length > 0) {
        await Photo.deleteMany({ _id: { $in: toDelete } });
        console.log(`Removed ${toDelete.length} duplicate photo(s)`);
    } else {
        console.log("No duplicates found");
    }

    // Show final state
    const remaining = await Photo.find().sort({ createdAt: -1 });
    console.log(`\nFinal photo count: ${remaining.length}`);
    remaining.forEach(p =>
        console.log(` ${p.status} | room:${p.roomId} | ${p.cloudinaryUrl?.slice(0, 65)}`)
    );

    await mongoose.disconnect();
    console.log("\n✅ Cleanup complete");
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
