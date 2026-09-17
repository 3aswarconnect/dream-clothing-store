(function () {
  var cfg = window.STORE_CONFIG;
  var store = window.CouponStore;
  var reviewed = false;
  var spinning = false;
  var currentCoupon = null;
  var qrWidget = null;

  var reviewBtn = document.getElementById("review-btn");
  var reviewDoneBtn = document.getElementById("review-done-btn");
  var reviewTick = document.getElementById("review-tick");
  var nameInput = document.getElementById("customer-name");
  var phoneInput = document.getElementById("customer-phone");
  var spinBtn = document.getElementById("spin-btn");
  var lock = document.getElementById("lock");
  var prizeText = document.getElementById("prize-text");
  var resultCard = document.getElementById("result-card");
  var strips = [
    document.getElementById("reel-0"),
    document.getElementById("reel-1"),
    document.getElementById("reel-2")
  ];
  var pendingPrize = null;
  var api = window.CouponApi;
  var REPEATS = 16;

  function fillStrips() {
    strips.forEach(function (strip, idx) {
      strip.className = "reel-strip reel-" + idx;
      strip.innerHTML = "";
      var r;
      var d;
      for (r = 0; r < REPEATS; r += 1) {
        for (d = 0; d < 10; d += 1) {
          var cell = document.createElement("b");
          cell.textContent = String(d);
          strip.appendChild(cell);
        }
      }
    });
  }

  function digitHeight() {
    var cell = strips[0].querySelector("b");
    return cell ? cell.offsetHeight : 86;
  }

  function setReel(index, digit, loops, animate) {
    var strip = strips[index];
    var y = -((loops * 10 + digit) * digitHeight());
    strip.classList.toggle("is-stopping", !!animate);
    strip.style.transform = "translateY(" + y + "px)";
  }

  fillStrips();

  document.title = cfg.storeName + " Coupon";

  function markReviewed() {
    reviewed = true;
    reviewTick.classList.add("done");
    reviewBtn.textContent = "Reviewed";
    reviewDoneBtn.classList.add("hidden");
  }

  function openReview() {
    window.open(cfg.mapsReviewUrl, "_blank", "noopener");
    sessionStorage.setItem("review-opened", "1");
    reviewDoneBtn.classList.remove("hidden");
  }

  function maybeReturnFromReview() {
    if (!reviewed && sessionStorage.getItem("review-opened") === "1") {
      markReviewed();
    }
  }

  reviewBtn.addEventListener("click", openReview);
  reviewDoneBtn.addEventListener("click", markReviewed);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      maybeReturnFromReview();
    }
  });
  window.addEventListener("focus", maybeReturnFromReview);
  window.addEventListener("pageshow", maybeReturnFromReview);

  phoneInput.addEventListener("input", function () {
    phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 10);
  });

  function getFormError() {
    if (!reviewed) {
      return "Please complete the Google review first.";
    }
    if (!nameInput.value.trim()) {
      return "Please enter the customer name.";
    }
    if (!/^\d{10}$/.test(phoneInput.value)) {
      return "Please enter a 10 digit phone number.";
    }
    return "";
  }

  function renderCoupon(coupon) {
    document.getElementById("present-date").textContent = store.formatDisplayDate(coupon.issued);
    document.getElementById("purchased-date").textContent = store.formatDisplayDate(coupon.purchased);
    document.getElementById("expiry-date").textContent = store.formatDisplayDate(coupon.expiry);
    document.getElementById("card-name").textContent = coupon.name;
    document.getElementById("card-phone").textContent = coupon.phone;
    document.getElementById("card-discount").textContent = cfg.currency + coupon.discount;
    document.getElementById("card-purchased").textContent = store.formatDisplayDate(coupon.purchased);
    document.getElementById("card-expiry").textContent = store.formatDisplayDate(coupon.expiry);
    document.getElementById("card-id").textContent = "COUPON ID " + coupon.id;
    prizeText.textContent = cfg.currency + coupon.discount;
    prizeText.classList.remove("hidden");
    resultCard.classList.remove("hidden");

    var qrBox = document.getElementById("qr-box");
    qrBox.innerHTML = "";
    qrWidget = new QRCode(qrBox, {
      text: store.encodePayload(coupon),
      width: 112,
      height: 112,
      colorDark: "#2b1a16",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function showReadyCoupon(coupon, locked) {
    currentCoupon = coupon;
    nameInput.value = coupon.name || nameInput.value;
    phoneInput.value = coupon.phone || phoneInput.value;
    nameInput.disabled = !!locked;
    phoneInput.disabled = !!locked;
    spinBtn.disabled = !!locked;
    spinBtn.textContent = locked ? "Use this coupon first" : "Gift unlocked";
    renderCoupon(coupon);
    prizeText.classList.add("is-in");
  }

  function resetSpinUi() {
    spinning = false;
    lock.classList.remove("is-spinning");
    if (!currentCoupon) {
      spinBtn.disabled = false;
      spinBtn.textContent = "Spin the lock";
    }
  }

  function checkPhoneInDb() {
    var phone = phoneInput.value.trim();
    if (!/^\d{10}$/.test(phone)) {
      return;
    }
    api.check(phone).then(function (res) {
      if (res.coupon && res.canSpin === false) {
        showReadyCoupon(res.coupon, true);
      }
    });
  }

  phoneInput.addEventListener("blur", checkPhoneInDb);

  spinBtn.addEventListener("click", function () {
    var error = getFormError();
    if (error) {
      alert(error);
      return;
    }
    if (spinning) {
      return;
    }
    spinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = "Checking...";
    api.claim(nameInput.value.trim(), phoneInput.value.trim()).then(function (res) {
      if (res.reason === "active" && res.coupon) {
        resetSpinUi();
        showReadyCoupon(res.coupon, true);
        alert("You already have a coupon. Please use it at the shop. You can get another after it is used or expires.");
        return;
      }
      if (!res.ok || !res.coupon) {
        resetSpinUi();
        if (res.reason === "local") {
          alert(res.message);
        } else if (res.reason === "server" && res.message) {
          alert("Database error: " + res.message);
        } else {
          alert("Could not save the coupon. Use the live Vercel site and check MONGODB_URI.");
        }
        return;
      }
      currentCoupon = res.coupon;
      pendingPrize = res.coupon.discount;
      spinBtn.textContent = "Spinning...";
      lock.classList.add("is-spinning");
      var digits = String(pendingPrize).split("").map(Number);
      digits.forEach(function (digit, index) {
        setReel(index, 0, 0, false);
        strips[index].offsetHeight;
        setReel(index, digit, 8 + index * 3, true);
      });
      setTimeout(function () {
        showReadyCoupon(currentCoupon, true);
        spinBtn.textContent = "Gift unlocked";
        lock.classList.remove("is-spinning");
        spinning = false;
      }, 3600);
    });
  });

  function waitForQrImage() {
    return new Promise(function (resolve) {
      var tries = 0;
      var timer = setInterval(function () {
        var node = document.querySelector("#qr-box canvas, #qr-box img");
        if (node && (node.tagName !== "IMG" || node.src)) {
          clearInterval(timer);
          resolve(node);
        }
        tries += 1;
        if (tries > 40) {
          clearInterval(timer);
          resolve(null);
        }
      }, 80);
    });
  }

  function drawCouponCard(qrNode, bannerImg) {
    var canvas = document.createElement("canvas");
    var width = 840;
    var bannerH = bannerImg ? Math.round(780 * (bannerImg.height / bannerImg.width)) : 120;
    var titleTop = 30 + bannerH + 28;
    var height = 580 + bannerH;
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#f4f0e6";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fffdf8";
    roundRect(ctx, 30, 30, 780, height - 60, 28);
    ctx.fill();
    window.Brand.drawWatermark(ctx, width, height);
    ctx.save();
    roundRect(ctx, 30, 30, 780, height - 60, 28);
    ctx.clip();
    if (bannerImg) {
      ctx.drawImage(bannerImg, 30, 30, 780, bannerH);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(201, 162, 74, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 30 + bannerH);
    ctx.lineTo(810, 30 + bannerH);
    ctx.stroke();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 4;
    roundRect(ctx, 48, titleTop - 10, 744, height - (titleTop - 10) - 48, 22);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#161616";
    ctx.textAlign = "center";
    ctx.font = "700 36px 'Playfair Display', serif";
    ctx.fillText("Gift Coupon", width / 2, titleTop + 36);

    ctx.textAlign = "left";
    ctx.font = "600 20px Outfit, sans-serif";
    var lines = [
      "Name: " + currentCoupon.name,
      "Phone: " + currentCoupon.phone,
      "Discount: " + cfg.currency + currentCoupon.discount,
      "Present date: " + store.formatDisplayDate(currentCoupon.issued),
      "Purchased: " + store.formatDisplayDate(currentCoupon.purchased),
      "Expiry: " + store.formatDisplayDate(currentCoupon.expiry)
    ];
    var y = titleTop + 86;
    lines.forEach(function (line) {
      ctx.fillText(line, 90, y);
      y += 34;
    });

    if (qrNode) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(590, titleTop + 72, 170, 170);
      ctx.drawImage(qrNode, 598, titleTop + 80, 154, 154);
    }

    ctx.textAlign = "center";
    ctx.font = "500 15px Outfit, sans-serif";
    ctx.fillStyle = "#7a6458";
    ctx.fillText("Coupon ID " + currentCoupon.id + "  ·  " + window.Brand.footerText(), width / 2, height - 50);
    return canvas;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  document.getElementById("download-btn").addEventListener("click", function () {
    if (!currentCoupon) {
      return;
    }
    Promise.all([waitForQrImage(), window.Brand.loadImage(cfg.bannerUrl)]).then(function (parts) {
      var canvas = drawCouponCard(parts[0], parts[1]);
      var link = document.createElement("a");
      link.download = currentCoupon.id + "-coupon.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  });

})();
