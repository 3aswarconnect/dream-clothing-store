# Dress Store coupon site

Simple HTML site. No React, no database. Works on **Vercel** or **GitHub Pages**.

## Pages

- `index.html` — customer page: review, name, phone, spin, download coupon
- `store-qr.html` — owner page: download the store QR to give customers
- `scan.html` — owner page: scan the coupon QR and see the details
- `coupons.json` — coupon list you can keep / replace later
- `config.js` — store name and Google Maps review link

## MongoDB (required for live coupons)

The site saves each coupon in **MongoDB Atlas** (free). Local phone storage is not used for this.

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database user and allow access from `0.0.0.0/0` (Vercel)
3. Copy the connection string
4. In Vercel → Project → Settings → Environment Variables add:
   - `MONGODB_URI` = that connection string
   - `MONGODB_DB` = `dream_clothing`
5. Redeploy

Each coupon stores: name, phone, discount, purchase date, expiry date, and used yes/no.

- Spin is blocked while that phone has an unused, not-expired coupon
- Owner scan sets **used = yes**
- After used or date expiry, the same phone can spin again

## Before you deploy

1. Open `config.js`
2. Put the real store name, owner name, phone, and address
3. Put your Google Maps review URL in `mapsReviewUrl`
4. To use your own logo, replace `assets/brand/logo.svg` or set `logoUrl` to your image file

Logo and coupon artwork can be dropped in later. The layout is already ready for that.

## How it works

There are **two QR codes**:

1. **Store QR** (`store-qr.html`) — after deploy, owner downloads this and shows it to the customer. Customer scans it and the site opens.
2. **Coupon QR** — after the customer reviews, spins, and downloads the card. Next time they come to the shop, owner scans that coupon QR on `scan.html`.

Customer steps after scanning the store QR:

1. Tap **Review**, finish the Maps review, then come back. The review step gets a tick.
2. Enter name and phone, then spin. Prize is a random amount from 300 to 500.
3. Dates are filled automatically:
   - present date = today
   - purchased date = today
   - expiry date = 1 month later
4. **Download coupon card** saves a PNG with the details and QR code.

`coupons.json` in the project folder will stay empty. A static site on Vercel or GitHub Pages cannot write into that file.

Verification still works: the customer's coupon QR contains the JSON (name, phone, discount, dates). Owner scans that coupon card on `scan.html` and the details appear.

## Deploy

### GitHub Pages

Upload this folder to a GitHub repo and turn on Pages. The site root should be this folder.

### Vercel

Import the same folder. It is already static HTML, so no build command is needed.

## Local preview

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.
