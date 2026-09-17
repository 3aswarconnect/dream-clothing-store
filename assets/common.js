(function (global) {
  var STORAGE_KEY = "dress-store-coupons";
  var CLAIM_KEY = "dress-claimed-coupon";
  var REDEEM_KEY = "dress-redeemed";
  var QR_PREFIX = "DRESSCOUPON:";

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toISODate(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function parseISODate(value) {
    var parts = String(value).split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function formatDisplayDate(value) {
    var date = typeof value === "string" ? parseISODate(value) : value;
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function addMonths(isoDate, months) {
    var date = parseISODate(isoDate);
    date.setMonth(date.getMonth() + months);
    return toISODate(date);
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function makeId() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var id = "DS-";
    for (var i = 0; i < 6; i += 1) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  function randomPrize(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function loadLocalCoupons() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function saveLocalCoupons(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function upsertCoupon(coupon) {
    var list = loadLocalCoupons();
    var found = false;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === coupon.id) {
        list[i] = coupon;
        found = true;
        break;
      }
    }
    if (!found) {
      list.unshift(coupon);
    }
    saveLocalCoupons(list);
    return list;
  }

  function findCoupon(id) {
    var list = loadLocalCoupons();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) {
        return list[i];
      }
    }
    return null;
  }

  function encodePayload(coupon) {
    return QR_PREFIX + JSON.stringify({
      id: coupon.id,
      name: coupon.name,
      phone: coupon.phone,
      discount: coupon.discount,
      issued: coupon.issued,
      purchased: coupon.purchased,
      expiry: coupon.expiry
    });
  }

  function decodePayload(text) {
    if (!text) {
      return null;
    }
    var value = String(text).trim();
    if (/^https?:\/\//i.test(value)) {
      return { type: "site", url: value };
    }
    try {
      if (value.indexOf(QR_PREFIX) === 0) {
        return JSON.parse(value.slice(QR_PREFIX.length));
      }
      if (value.charAt(0) === "{") {
        return JSON.parse(value);
      }
    } catch (err) {
      return null;
    }
    if (/^DS-/.test(value)) {
      return { id: value };
    }
    return null;
  }

  function isExpired(coupon) {
    return parseISODate(coupon.expiry) < parseISODate(todayISO());
  }

  function normalizePhone(phone) {
    return String(phone || "").replace(/\D/g, "").slice(-10);
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function getClaimedCoupon() {
    return readJson(CLAIM_KEY, null);
  }

  function saveClaimedCoupon(coupon) {
    localStorage.setItem(CLAIM_KEY, JSON.stringify(coupon));
    upsertCoupon(coupon);
  }

  function getRedeems() {
    var data = readJson(REDEEM_KEY, { ids: {}, phones: {} });
    data.ids = data.ids || {};
    data.phones = data.phones || {};
    return data;
  }

  function redeemStatus(coupon) {
    if (!coupon) {
      return { blocked: false };
    }
    var data = getRedeems();
    var phone = normalizePhone(coupon.phone);
    if (coupon.id && data.ids[coupon.id]) {
      return { blocked: true, reason: "used", record: data.ids[coupon.id] };
    }
    if (phone && data.phones[phone]) {
      return { blocked: true, reason: "phone", record: data.phones[phone] };
    }
    return { blocked: false };
  }

  function markRedeemed(coupon) {
    var data = getRedeems();
    var record = {
      id: coupon.id,
      name: coupon.name,
      phone: coupon.phone,
      discount: coupon.discount,
      usedAt: todayISO()
    };
    if (coupon.id) {
      data.ids[coupon.id] = record;
    }
    var phone = normalizePhone(coupon.phone);
    if (phone) {
      data.phones[phone] = record;
    }
    localStorage.setItem(REDEEM_KEY, JSON.stringify(data));
    return record;
  }

  function mergeCouponLists(base, extra) {
    var map = {};
    var i;
    for (i = 0; i < base.length; i += 1) {
      map[base[i].id] = base[i];
    }
    for (i = 0; i < extra.length; i += 1) {
      map[extra[i].id] = extra[i];
    }
    return Object.keys(map).map(function (key) {
      return map[key];
    });
  }

  function downloadJson(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function getCustomerUrl() {
    var cfg = global.STORE_CONFIG || {};
    if (cfg.siteUrl) {
      return String(cfg.siteUrl).replace(/\/?$/, "/");
    }
    var path = window.location.pathname.replace(/[^/]*$/, "");
    return window.location.origin + path;
  }

  function fetchFileCoupons() {
    return fetch("coupons.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("Could not load coupons.json");
        }
        return res.json();
      })
      .then(function (data) {
        return Array.isArray(data) ? data : data.coupons || [];
      })
      .catch(function () {
        return [];
      });
  }

  global.CouponStore = {
    todayISO: todayISO,
    addMonths: addMonths,
    formatDisplayDate: formatDisplayDate,
    makeId: makeId,
    randomPrize: randomPrize,
    loadLocalCoupons: loadLocalCoupons,
    upsertCoupon: upsertCoupon,
    findCoupon: findCoupon,
    encodePayload: encodePayload,
    decodePayload: decodePayload,
    isExpired: isExpired,
    normalizePhone: normalizePhone,
    getClaimedCoupon: getClaimedCoupon,
    saveClaimedCoupon: saveClaimedCoupon,
    redeemStatus: redeemStatus,
    markRedeemed: markRedeemed,
    mergeCouponLists: mergeCouponLists,
    downloadJson: downloadJson,
    fetchFileCoupons: fetchFileCoupons,
    getCustomerUrl: getCustomerUrl
  };
})(window);
