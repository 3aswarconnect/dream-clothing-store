const { getDb } = require("./lib/mongo");

function pad(n) {
  return String(n).padStart(2, "0");
}

function toISODate(date) {
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function todayISO() {
  return toISODate(new Date());
}

function addMonths(isoDate, months) {
  const parts = String(isoDate).split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function makeId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "DS-";
  for (let i = 0; i < 6; i += 1) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function randomPrize(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function publicCoupon(doc) {
  if (!doc) {
    return null;
  }
  return {
    id: doc.id,
    name: doc.name,
    phone: doc.phone,
    discount: doc.discount,
    issued: doc.issued,
    purchased: doc.purchased,
    expiry: doc.expiry,
    used: doc.used,
    usedAt: doc.usedAt || ""
  };
}

function isDateExpired(expiry) {
  return String(expiry) < todayISO();
}

function isActive(doc) {
  return doc && doc.used === "no" && !isDateExpired(doc.expiry);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(res, status, body) {
  setCors(res);
  res.setHeader("Content-Type", "application/json");
  res.status(status).json(body);
}

async function findActive(col, phone) {
  const list = await col
    .find({ phone: phone, used: "no" })
    .sort({ purchased: -1 })
    .toArray();
  return list.find(isActive) || null;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    if (typeof req.body === "string") {
      try {
        req.body = JSON.parse(req.body);
      } catch (err) {
        req.body = {};
      }
    }
    const db = await getDb();
    const col = db.collection("coupons");
    const action = String((req.query && req.query.action) || (req.body && req.body.action) || "").toLowerCase();

    if (req.method === "GET" || action === "check") {
      const phone = normalizePhone((req.query && req.query.phone) || (req.body && req.body.phone));
      if (!/^\d{10}$/.test(phone)) {
        send(res, 400, { ok: false, reason: "phone" });
        return;
      }
      const active = await findActive(col, phone);
      send(res, 200, {
        ok: true,
        canSpin: !active,
        coupon: publicCoupon(active)
      });
      return;
    }

    if (req.method !== "POST") {
      send(res, 405, { ok: false, reason: "method" });
      return;
    }

    const body = req.body || {};

    if (action === "lookup" || action === "redeem") {
      const id = String(body.id || "").trim();
      const phone = normalizePhone(body.phone);
      if (!id || !/^\d{10}$/.test(phone)) {
        send(res, 400, { ok: false, reason: "details" });
        return;
      }
      const doc = await col.findOne({ id: id, phone: phone });
      if (!doc) {
        send(res, 404, { ok: false, reason: "missing" });
        return;
      }
      if (action === "lookup") {
        send(res, 200, { ok: true, coupon: publicCoupon(doc), active: isActive(doc) });
        return;
      }
      if (doc.used === "yes") {
        send(res, 409, { ok: false, reason: "used", coupon: publicCoupon(doc) });
        return;
      }
      if (isDateExpired(doc.expiry)) {
        await col.updateOne({ id: id }, { $set: { used: "yes", usedAt: todayISO() } });
        doc.used = "yes";
        doc.usedAt = todayISO();
        send(res, 409, { ok: false, reason: "expired", coupon: publicCoupon(doc) });
        return;
      }
      const usedAt = todayISO();
      await col.updateOne({ id: id, phone: phone }, { $set: { used: "yes", usedAt: usedAt } });
      doc.used = "yes";
      doc.usedAt = usedAt;
      send(res, 200, { ok: true, coupon: publicCoupon(doc) });
      return;
    }

    if (action === "claim") {
      const name = String(body.name || "").trim();
      const phone = normalizePhone(body.phone);
      if (!name || !/^\d{10}$/.test(phone)) {
        send(res, 400, { ok: false, reason: "details" });
        return;
      }
      const active = await findActive(col, phone);
      if (active) {
        send(res, 409, {
          ok: false,
          reason: "active",
          coupon: publicCoupon(active)
        });
        return;
      }
      const today = todayISO();
      const coupon = {
        id: makeId(),
        name: name,
        phone: phone,
        discount: randomPrize(300, 500),
        issued: today,
        purchased: today,
        expiry: addMonths(today, 1),
        used: "no",
        usedAt: "",
        createdAt: new Date()
      };
      await col.insertOne(coupon);
      send(res, 200, { ok: true, coupon: publicCoupon(coupon) });
      return;
    }

    send(res, 400, { ok: false, reason: "action" });
  } catch (err) {
    send(res, 500, { ok: false, reason: "server", message: err.message });
  }
};
