(function () {
  var cfg = window.STORE_CONFIG;
  var url = window.CouponStore.getCustomerUrl();
  var qrBox = document.getElementById("store-qr-box");

  document.title = "Store QR | " + cfg.storeName;
  document.getElementById("poster-url").textContent = url;

  var qrSize = Math.max(160, Math.min(220, Math.floor(window.innerWidth * 0.52)));
  new QRCode(qrBox, {
    text: url,
    width: qrSize,
    height: qrSize,
    colorDark: "#2b1a16",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  function waitForQr() {
    return new Promise(function (resolve) {
      var tries = 0;
      var timer = setInterval(function () {
        var node = document.querySelector("#store-qr-box canvas, #store-qr-box img");
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

  document.getElementById("download-store-qr").addEventListener("click", function () {
    Promise.all([waitForQr(), window.Brand.loadImage(cfg.bannerUrl)]).then(function (parts) {
      var qrNode = parts[0];
      var bannerImg = parts[1];
      var bannerH = bannerImg ? Math.round(640 * (bannerImg.height / bannerImg.width)) : 120;
      var canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 900 + bannerH;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f4f0e6";
      ctx.fillRect(0, 0, 720, canvas.height);
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(40, 40, 640, canvas.height - 80);
      window.Brand.drawWatermark(ctx, 720, canvas.height);
      if (bannerImg) {
        ctx.drawImage(bannerImg, 40, 40, 640, bannerH);
      }
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = "#c9a24a";
      ctx.lineWidth = 4;
      ctx.strokeRect(60, 60, 600, canvas.height - 120);
      ctx.setLineDash([]);
      ctx.fillStyle = "#161616";
      ctx.textAlign = "center";
      ctx.font = "700 34px 'Playfair Display', serif";
      ctx.fillText("Scan to get coupon", 360, 70 + bannerH);
      ctx.fillStyle = "#7a6458";
      ctx.font = "500 16px Outfit, sans-serif";
      ctx.fillText("Show this QR to the customer", 360, 304);
      if (qrNode) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(210, 330, 300, 300);
        ctx.drawImage(qrNode, 220, 340, 280, 280);
      }
      ctx.fillStyle = "#2b1a16";
      ctx.font = "500 15px Outfit, sans-serif";
      ctx.fillText(url, 360, 680);
      ctx.fillStyle = "#7a6458";
      ctx.fillText("1. Scan  2. Review  3. Spin  4. Download coupon", 360, 730);
      ctx.fillText(window.Brand.footerText(), 360, 860);
      var link = document.createElement("a");
      link.download = "store-qr-for-customers.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  });
})();
