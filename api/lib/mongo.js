const { MongoClient } = require("mongodb");

const globalCache = globalThis;

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }
  if (globalCache._dreamMongo && globalCache._dreamMongo.uri === uri) {
    return globalCache._dreamMongo.db;
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "dream_clothing");
  await db.collection("coupons").createIndex({ phone: 1, used: 1 });
  await db.collection("coupons").createIndex({ id: 1 }, { unique: true });
  globalCache._dreamMongo = { uri: uri, db: db };
  return db;
}

module.exports = { getDb };
