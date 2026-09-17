(function () {
  var cfg = window.STORE_CONFIG;
  var store = window.CouponStore;
  var scanner = null;
  var lastScan = "";

  var statusEl = document.getElementById("coupon-status");
  var resultCard = document.getElementById("result-card");
  var markUsedBtn = document.getElementById("mark-used-btn");
  var scannedCoupon = null;
  var api = window.CouponApi;

  document.title = "Owner Scanner | " + cfg.storeName;

  function fillDetails(coupon) {
    document.getElementById("out-name").textContent = coupon.name || "-";
    document.getElementById("out-phone").textContent = coupon.phone || "-";
    document.getElementById("out-discount").textContent = coupon.discount ? cfg.currency + coupon.discount : "-";
    document.getElementById("out-start").textContent = coupon.purchased ? store.formatDisplayDate(coupon.purchased) : "-";
    document.getElementById("out-expiry").textContent = coupon.expiry ? store.formatDisplayDate(coupon.expiry) : "-";
    document.getElementById("out-id").textContent = coupon.id || "-";
    document.getElementById("out-used").textContent = coupon.used === "yes" ? "Yes" : (coupon.used === "no" ? "No" : "-");
    document.getElementById("out-min").textContent = "Above " + cfg.currency + (cfg.minPurchase || 1500);
  }

  function beep() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (err) {}
    if (navigator.vibrate) {
      navigator.vibrate(80);
    }
  }

  function flashHit() {
    var reader = document.querySelector(".reader");
    if (reader) {
      reader.classList.add("is-hit");
      setTimeout(function () {
        reader.classList.remove("is-hit");
      }, 400);
    }
    resultCard.classList.add("is-instant");
    setTimeout(function () {
      resultCard.classList.remove("is-instant");
    }, 800);
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (coupon.expiry && store.isExpired(coupon)) {
      statusEl.className = "status bad";
      statusEl.textContent = extra || "Expired coupon. Do not accept this discount.";
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
      decoded.used = decoded.used || "no";
      beep();
      showFromDb(decoded, "Coupon found. Check name and phone, then mark as used.");
      flashHit();
      stopScanner();
      api.lookup(decoded.id, decoded.phone).then(function (res) {
        if (res.coupon) {
          showFromDb(res.coupon);
        }
      });
      return;
    }

    resultCard.classList.remove("hidden");
    statusEl.className = "status bad";
    statusEl.textContent = "Scan the full coupon QR on the downloaded card.";
  }

  function scannerConfig() {
    return {
      fps: 20,
      qrbox: function (w, h) {
        var size = Math.floor(Math.min(w, h) * 0.78);
        if (size < 180) {
          size = 180;
        }
        return { width: size, height: size };
      },
      aspectRatio: 1,
      disableFlip: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    };
  }

  function onScan(text) {
    if (!text || text === lastScan) {
      return;
    }
    lastScan = text;
    lookup(text);
  }

  function startWithCamera(cameraId) {
    scanner = new Html5Qrcode("qr-reader");
    return scanner.start(cameraId, scannerConfig(), onScan);
  }

  function startScanner() {
    if (!window.Html5Qrcode) {
      alert("Scanner library did not load. Check your internet and refresh.");
      return;
    }
    if (scanner) {
      return;
    }
    Html5Qrcode.getCameras().then(function (cameras) {
      var cameraId = { facingMode: "environment" };
      if (cameras && cameras.length) {
        var back = cameras.filter(function (cam) {
          return /back|rear|environment/i.test(cam.label || "");
        });
        cameraId = (back[0] || cameras[cameras.length - 1]).id;
      }
      return startWithCamera(cameraId);
    }).catch(function () {
      return startWithCamera({ facingMode: "environment" });
    }).catch(function () {
      return startWithCamera({ facingMode: "user" });
    }).catch(function (err) {
      scanner = null;
      alert("Could not start camera. Allow camera permission, or use Scan coupon image. " + (err && err.message ? err.message : ""));
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
      lastScan = "";
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

  var listPage = 1;
  var listFilter = "all";
  var listPages = 1;
  var listPanel = document.getElementById("list-panel");
  var listStatus = document.getElementById("list-status");
  var listMeta = document.getElementById("list-meta");
  var listBody = document.getElementById("coupon-table-body");
  var listPrev = document.getElementById("list-prev");
  var listNext = document.getElementById("list-next");

  function loadCouponList() {
    listStatus.className = "status";
    listStatus.textContent = "Loading coupons...";
    api.list(listPage, listFilter).then(function (res) {
      if (!res.ok || !res.coupons) {
        listStatus.className = "status bad";
        listStatus.textContent = res.message || "Could not load coupons from the database.";
        listBody.innerHTML = "";
        return;
      }
      listPages = res.pages || 1;
      listPage = res.page || listPage;
      listStatus.className = "status ok";
      listStatus.textContent = (res.total || 0) + " coupon(s) found.";
      listMeta.textContent = "Page " + listPage + " of " + listPages + " · 15 per page";
      listPrev.disabled = listPage <= 1;
      listNext.disabled = listPage >= listPages;
      if (!res.coupons.length) {
        listBody.innerHTML = "<tr><td colspan=\"9\">No coupons for this filter.</td></tr>";
        return;
      }
      listBody.innerHTML = res.coupons.map(function (coupon) {
        var expired = coupon.expiry && store.isExpired(coupon);
        return "<tr>" +
          "<td>" + (coupon.id || "-") + "</td>" +
          "<td>" + (coupon.name || "-") + "</td>" +
          "<td>" + (coupon.phone || "-") + "</td>" +
          "<td>" + (coupon.discount ? cfg.currency + coupon.discount : "-") + "</td>" +
          "<td>" + (coupon.issued ? store.formatDisplayDate(coupon.issued) : "-") + "</td>" +
          "<td>" + (coupon.purchased ? store.formatDisplayDate(coupon.purchased) : "-") + "</td>" +
          "<td>" + (coupon.expiry ? store.formatDisplayDate(coupon.expiry) : "-") + (expired ? " · expired" : "") + "</td>" +
          "<td>" + (coupon.used === "yes" ? "Yes" : "No") + "</td>" +
          "<td>" + (coupon.usedAt ? store.formatDisplayDate(coupon.usedAt) : "-") + "</td>" +
          "</tr>";
      }).join("");
    });
  }

  document.getElementById("load-list-btn").addEventListener("click", function () {
    listPanel.classList.remove("hidden");
    listPage = 1;
    loadCouponList();
  });
  document.getElementById("list-filter").addEventListener("change", function (event) {
    listFilter = event.target.value;
    listPage = 1;
    loadCouponList();
  });
  listPrev.addEventListener("click", function () {
    if (listPage > 1) {
      listPage -= 1;
      loadCouponList();
    }
  });
  listNext.addEventListener("click", function () {
    if (listPage < listPages) {
      listPage += 1;
      loadCouponList();
    }
  });

  document.getElementById("start-scan").addEventListener("click", startScanner);
  document.getElementById("stop-scan").addEventListener("click", stopScanner);
  document.getElementById("qr-file").addEventListener("change", function (event) {
    var file = event.target.files[0];
    if (!file || !window.Html5Qrcode) {
      return;
    }
    var fileScanner = new Html5Qrcode("qr-file-reader");
    fileScanner.scanFile(file, true).then(function (text) {
      lastScan = "";
      lookup(text);
      fileScanner.clear();
      event.target.value = "";
    }).catch(function () {
      alert("Could not read a QR code from that image. Use the downloaded coupon card, not the store QR.");
      event.target.value = "";
    });
  });
})();
