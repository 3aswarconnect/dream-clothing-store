(function (global) {
  function apiUrl() {
    var cfg = global.STORE_CONFIG || {};
    var base = String(cfg.apiUrl || cfg.siteUrl || "").replace(/\/$/, "");
    var local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.origin);
    if (local && !base) {
      return "";
    }
    if (local && base) {
      return base + "/api/coupon";
    }
    return "/api/coupon";
  }

  function request(method, action, data) {
    var url = apiUrl();
    if (!url) {
      return Promise.resolve({
        ok: false,
        reason: "local",
        message: "Open the Vercel site to spin. Local preview has no database API."
      });
    }
    var options = { method: method };
    if (method === "GET") {
      var query = new URLSearchParams({ action: action });
      if (data) {
        Object.keys(data).forEach(function (key) {
          if (data[key]) {
            query.set(key, data[key]);
          }
        });
      }
      url += "?" + query.toString();
    } else {
      options.headers = { "Content-Type": "text/plain" };
      options.body = JSON.stringify(Object.assign({ action: action }, data || {}));
    }
    return fetch(url, options).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, reason: "server" };
      });
    }).catch(function () {
      return { ok: false, reason: "network" };
    });
  }

  global.CouponApi = {
    check: function (phone) {
      return request("GET", "check", { phone: phone });
    },
    claim: function (name, phone) {
      return request("POST", "claim", { name: name, phone: phone });
    },
    lookup: function (id, phone) {
      return request("POST", "lookup", { id: id, phone: phone });
    },
    redeem: function (id, phone) {
      return request("POST", "redeem", { id: id, phone: phone });
    },
    list: function (page, filter) {
      return request("GET", "list", {
        page: String(page || 1),
        filter: filter || "all"
      });
    }
  };
})(window);
