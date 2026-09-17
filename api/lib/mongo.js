const dns = require("node:dns");
const { MongoClient } = require("mongodb");

dns.setDefaultResultOrder("ipv4first");

const globalCache = globalThis;

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI on Vercel. Add it in Settings → Environment Variables, then Redeploy.");
  }
  if (globalCache._dreamMongo && globalCache._dreamMongo.uri === uri) {
    return globalCache._dreamMongo.db;
  }
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000
  });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "dream_clothing");
  try {
    await db.collection("coupons").createIndex({ phone: 1, used: 1 });
    await db.collection("coupons").createIndex({ id: 1 }, { unique: true });
  } catch (err) {
    // Index creation should not block coupon save/check.
  }
  globalCache._dreamMongo = { uri: uri, db: db };
  return db;
}

module.exports = { getDb };
