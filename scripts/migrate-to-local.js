/**
 * Copies all data from Atlas to local MongoDB.
 * Run ONCE when you have internet: node scripts/migrate-to-local.js
 * After this, you can use MONGO_URI=mongodb://localhost:27017/eventsnapDB
 */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const mongoose = require("mongoose");

const ATLAS_URI = process.env.MONGO_URI;
const LOCAL_URI = "mongodb://localhost:27017/eventsnapDB";

async function migrate() {
    console.log("Connecting to Atlas...");
    const atlas = await mongoose.createConnection(ATLAS_URI, { serverSelectionTimeoutMS: 15000 }).asPromise();
    console.log("✅ Atlas connected");

    console.log("Connecting to local MongoDB...");
    const local = await mongoose.createConnection(LOCAL_URI).asPromise();
    console.log("✅ Local connected");

    const collections = ["users", "rooms", "photos", "matches"];

    for (const col of collections) {
        const docs = await atlas.db.collection(col).find({}).toArray();
        if (docs.length === 0) { console.log(`  ${col}: empty, skipping`); continue; }
        await local.db.collection(col).deleteMany({});
        await local.db.collection(col).insertMany(docs);
        console.log(`  ✅ ${col}: copied ${docs.length} documents`);
    }

    await atlas.close();
    await local.close();
    console.log("\n✅ Migration complete! Switch .env to: MONGO_URI=mongodb://localhost:27017/eventsnapDB");
}

migrate().catch(e => { console.error("Migration failed:", e.message); process.exit(1); });
