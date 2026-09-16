(function (global) {
  var cfg = global.STORE_CONFIG || {};

  function ownerLine() {
    var names = [cfg.ownerName, cfg.ownerName2].filter(Boolean);
    return names.join("  ·  ");
  }

  function footerText() {
    var parts = [cfg.storeName];
    if (ownerLine()) {
      parts.push(ownerLine());
    }
    if (cfg.phone) {
      parts.push(cfg.phone);
    }
    if (cfg.instagram) {
      parts.push(cfg.instagram);
    }
    if (cfg.address) {
      parts.push(cfg.address);
    }
    return parts.join("  ·  ");
  }

  function fillWatermark(el) {
    var label = cfg.storeName + (ownerLine() ? "  ·  " + ownerLine() : "");
    var row = "";
    var i;
    for (i = 0; i < 8; i += 1) {
      row += label + "     ";
    }
    el.innerHTML = "";
    for (i = 0; i < 14; i += 1) {
      var span = document.createElement("span");
      span.textContent = row;
      el.appendChild(span);
    }
  }

  function apply() {
    document.querySelectorAll("[data-brand]").forEach(function (el) {
      var key = el.getAttribute("data-brand");
      if (key === "logo") {
        el.src = cfg.logoUrl;
        el.alt = cfg.storeName + " logo";
      } else if (key === "banner") {
        el.src = cfg.bannerUrl || cfg.logoUrl;
        el.alt = cfg.storeName;
      } else if (key === "storeName") {
        el.textContent = cfg.storeName;
      } else if (key === "storeNameUpper") {
        el.textContent = String(cfg.storeName || "").toUpperCase();
      } else if (key === "ownerName") {
        el.textContent = cfg.ownerName || "";
      } else if (key === "ownerName2") {
        el.textContent = cfg.ownerName2 || "";
        if (!cfg.ownerName2) {
          el.classList.add("hidden");
        }
      } else if (key === "ownerLine") {
        el.textContent = ownerLine();
        if (!ownerLine()) {
          el.classList.add("hidden");
        }
      } else if (key === "tagline") {
        el.textContent = cfg.tagline || "";
      } else if (key === "phone") {
        el.textContent = cfg.phone || "";
      } else if (key === "instagram") {
        el.textContent = cfg.instagram || "";
      } else if (key === "address") {
        el.textContent = cfg.address || "";
      } else if (key === "footer") {
        el.textContent = footerText();
      } else if (key === "watermark") {
        fillWatermark(el);
      }
    });
    document.title = document.title.replace("Dress Store", cfg.storeName);
    if (document.title.indexOf(cfg.storeName) === -1 && document.title.indexOf("Coupon") !== -1) {
      document.title = cfg.storeName + " Coupon";
    }
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) {
        resolve(null);
        return;
      }
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    });
  }

  function drawWatermark(ctx, width, height) {
    var label = cfg.storeName + (ownerLine() ? "  ·  " + ownerLine() : "");
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "700 34px 'Great Vibes', 'Playfair Display', serif";
    ctx.textAlign = "center";
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 7);
    var row;
    var col;
    for (row = -4; row <= 4; row += 1) {
      for (col = -3; col <= 3; col += 1) {
        ctx.fillText(label, col * 320, row * 74);
      }
    }
    ctx.restore();
  }

  function drawBanner(ctx, img, x, y, width) {
    if (!img) {
      return 0;
    }
    var height = Math.round(width * (img.height / img.width));
    ctx.drawImage(img, x, y, width, height);
    return height;
  }

  function drawLogo(ctx, img, x, y, size) {
    if (img) {
      ctx.drawImage(img, x, y, size, size);
      return;
    }
    ctx.strokeStyle = "#6eafd4";
    ctx.lineWidth = Math.max(3, size / 16);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.5, y + size * 0.12);
    ctx.lineTo(x + size * 0.5, y + size * 0.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.12, y + size * 0.52);
    ctx.quadraticCurveTo(x + size * 0.5, y + size * 0.28, x + size * 0.88, y + size * 0.52);
    ctx.stroke();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }

  global.Brand = {
    apply: apply,
    ownerLine: ownerLine,
    footerText: footerText,
    loadImage: loadImage,
    drawWatermark: drawWatermark,
    drawBanner: drawBanner,
    drawLogo: drawLogo
  };
})(window);
