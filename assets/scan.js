(function () {
  var cfg = window.STORE_CONFIG;
  var store = window.CouponStore;
  var scanner = null;
  var lastScan = "";

  var statusEl = document.getElementById("coupon-status");
  var resultCard = document.getElementById("result-card");

  document.title = "Owner Scanner | " + cfg.storeName;

  function showCoupon(coupon, source) {
    if (!coupon || !coupon.id) {
      resultCard.classList.remove("hidden");
      statusEl.className = "status bad";
      statusEl.textContent = "Could not read coupon details. Scan the QR on the customer's downloaded card.";
      return;
    }

    document.getElementById("out-name").textContent = coupon.name || "-";
    document.getElementById("out-phone").textContent = coupon.phone || "-";
    document.getElementById("out-discount").textContent = coupon.discount ? cfg.currency + coupon.discount : "-";
    document.getElementById("out-start").textContent = coupon.purchased ? store.formatDisplayDate(coupon.purchased) : "-";
    document.getElementById("out-expiry").textContent = coupon.expiry ? store.formatDisplayDate(coupon.expiry) : "-";
    document.getElementById("out-id").textContent = coupon.id;

    resultCard.classList.remove("hidden");
    statusEl.className = "status " + (store.isExpired(coupon) ? "bad" : "ok");
    if (store.isExpired(coupon)) {
      statusEl.textContent = "Expired coupon. Do not accept this discount. Source: " + source + ".";
    } else {
      statusEl.textContent = "Valid coupon. Source: " + source + ".";
    }
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

    if (decoded.name && decoded.phone && decoded.discount) {
      showCoupon(decoded, "coupon QR");
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
