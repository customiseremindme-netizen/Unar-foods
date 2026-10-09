# UNAR — One Healthy Habit a Day

The online shop and business dashboard for **UNAR Banana Chewy**.

- 🛍️ **Storefront:** animated homepage, shop, product pages, cart, checkout
  (Razorpay online payments + optional Cash on Delivery), order tracking,
  customer accounts, About, Contact, FAQs, Journal and policy pages.
- 🧑‍💼 **Dashboard (`/admin`):** orders, products, stock, customers,
  reviews, homepage & page editor, banners, coupons, shipping, reports,
  SEO, business settings, staff roles and an activity log — no coding
  needed.

## Start here

| If you are… | Read |
| --- | --- |
| The owner setting the shop up | [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) — click-by-click for the Hostinger database and website, Razorpay, email and your domain |
| The owner checking what needs your approval | [docs/OWNER_CHECKLIST.md](docs/OWNER_CHECKLIST.md) |
| Anyone asking "what's done?" | [docs/STATUS.md](docs/STATUS.md) |
| A developer (or Claude) changing the code | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [tests/README.md](tests/README.md) |

## Tech
Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · MySQL / MariaDB
(Hostinger) with automatic table setup · own sign-in (scrypt, email
confirmation) · Razorpay · email via SMTP (Hostinger mail) or Resend ·
optional Shiprocket · runs as a Hostinger Node.js web app.

## Developer quick start
```bash
npm install
cp .env.example .env.local          # fill in DB_HOST/DB_NAME/DB_USER/DB_PASSWORD for a local MySQL or MariaDB
npm run dev                         # http://localhost:3000 — creates the tables on first visit
node tests/e2e/support/seed-test-db.mjs   # LOCAL ONLY: demo stock + test owner (see tests/README.md)
npm run check                       # lint + typecheck + unit tests
```

Never commit `.env.local` or any secret. Brand assets in `public/brand` and
`brand-source/` are the official UNAR artwork — do not redraw or alter them.
