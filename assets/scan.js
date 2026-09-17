(function () {
  var cfg = window.STORE_CONFIG;
  var store = window.CouponStore;
  var scanner = null;
  var lastScan = "";

  var statusEl = document.getElementById("coupon-status");
  var resultCard = document.getElementById("result-card");
  var markUsedBtn = document.getElementById("mark-used-btn");
  var scannedCoupon = null;

  document.title = "Owner Scanner | " + cfg.storeName;

  var api = window.CouponApi;

  function fillDetails(coupon) {
    document.getElementById("out-name").textContent = coupon.name || "-";
    document.getElementById("out-phone").textContent = coupon.phone || "-";
    document.getElementById("out-discount").textContent = coupon.discount ? cfg.currency + coupon.discount : "-";
    document.getElementById("out-start").textContent = coupon.purchased ? store.formatDisplayDate(coupon.purchased) : "-";
    document.getElementById("out-expiry").textContent = coupon.expiry ? store.formatDisplayDate(coupon.expiry) : "-";
    document.getElementById("out-id").textContent = coupon.id || "-";
    document.getElementById("out-used").textContent = coupon.used === "yes" ? "Yes" : "No";
  }

  function showFromDb(coupon, extra) {
    scannedCoupon = coupon || null;
    markUsedBtn.classList.add("hidden");
    resultCard.classList.remove("hidden");
    if (!coupon) {
      statusEl.className = "status bad";
      statusEl.textContent = extra || "Could not find this coupon in the database.";
      return;
    }
    fillDetails(coupon);
    if (coupon.used === "yes") {
      statusEl.className = extra ? "status ok" : "status bad";
      statusEl.textContent = extra || "Already used. Do not give this discount again. Customer can get a new coupon now.";
      return;
    }
    if (store.isExpired(coupon)) {
      statusEl.className = "status bad";
      statusEl.textContent = "Expired coupon. Do not accept this discount.";
      return;
    }
    statusEl.className = "status ok";
    statusEl.textContent = extra || "Valid coupon. Check the name and phone, then mark as used.";
    markUsedBtn.classList.remove("hidden");
  }

  function lookup(payload) {
    var decoded = typeof payload === "string" ? store.decodePayload(payload) : payload;
    if (decoded && decoded.type === "site") {
      resultCard.classList.remove("hidden");
      statusEl.className = "status bad";
      statusEl.textContent = "That is the store website QR. Ask the customer to show the downloaded coupon card, then scan that QR.";
      return;
    }
    if (!decoded) {
      resultCard.classList.remove("hidden");
      statusEl.className = "status bad";
      statusEl.textContent = "This QR is not a coupon. Scan the QR on the customer's downloaded coupon card.";
      return;
    }

    if (decoded.id && decoded.phone) {
      statusEl.className = "status";
      resultCard.classList.remove("hidden");
      statusEl.textContent = "Checking database...";
      markUsedBtn.classList.add("hidden");
      api.lookup(decoded.id, decoded.phone).then(function (res) {
        if (!res.ok || !res.coupon) {
          showFromDb(null, "This coupon was not found in the database.");
          return;
        }
        showFromDb(res.coupon);
      });
      return;
    }

    resultCard.classList.remove("hidden");
    statusEl.className = "status bad";
    statusEl.textContent = "Scan the full coupon QR on the downloaded card.";
  }

  function startScanner() {
    if (!window.Html5Qrcode) {
      alert("Scanner library did not load. Check your internet and refresh.");
      return;
    }
    if (scanner) {
      return;
    }
    scanner = new Html5Qrcode("qr-reader");
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      function (text) {
        if (text === lastScan) {
          return;
        }
        lastScan = text;
        lookup(text);
      }
    ).catch(function (err) {
      alert("Could not start camera: " + err);
      scanner = null;
    });
  }

  function stopScanner() {
    if (!scanner) {
      return;
    }
    scanner.stop().then(function () {
      scanner.clear();
      scanner = null;
      lastScan = "";
    }).catch(function () {
      scanner = null;
    });
  }

  markUsedBtn.addEventListener("click", function () {
    if (!scannedCoupon) {
      return;
    }
    markUsedBtn.disabled = true;
    api.redeem(scannedCoupon.id, scannedCoupon.phone).then(function (res) {
      markUsedBtn.disabled = false;
      if (res.reason === "used" || (res.coupon && res.coupon.used === "yes" && !res.ok)) {
        showFromDb(res.coupon || scannedCoupon);
        return;
      }
      if (res.reason === "expired") {
        showFromDb(res.coupon || scannedCoupon, "Expired coupon. Do not accept this discount.");
        return;
      }
      if (!res.ok || !res.coupon) {
        statusEl.className = "status bad";
        statusEl.textContent = "Could not update the database. Check internet and try again.";
        return;
      }
      showFromDb(res.coupon, "Marked as used. This customer can get a new coupon for the next purchase.");
    });
  });

  document.getElementById("start-scan").addEventListener("click", startScanner);
  document.getElementById("stop-scan").addEventListener("click", stopScanner);
  document.getElementById("qr-file").addEventListener("change", function (event) {
    var file = event.target.files[0];
    if (!file || !window.Html5Qrcode) {
      return;
    }
    var fileScanner = new Html5Qrcode("qr-reader");
    fileScanner.scanFile(file, true).then(function (text) {
      lookup(text);
      fileScanner.clear();
    }).catch(function () {
      alert("Could not read a QR code from that image.");
    });
  });
})();
