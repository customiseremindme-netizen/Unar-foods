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
| The owner setting the shop up | [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) — click-by-click for Supabase, Resend, Razorpay, Vercel and your domain |
| The owner checking what needs your approval | [docs/OWNER_CHECKLIST.md](docs/OWNER_CHECKLIST.md) |
| Anyone asking "what's done?" | [docs/STATUS.md](docs/STATUS.md) |
| A developer (or Claude) changing the code | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [tests/README.md](tests/README.md) |

## Tech
Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres,
Auth, Storage, Row Level Security) · Razorpay · Resend · optional Shiprocket
· Vercel.

## Developer quick start
```bash
npm install
cp .env.example .env.local          # fill in local values
npx supabase start                  # local database (needs Docker)
npx supabase db reset               # schema + local demo data
npm run dev                         # http://localhost:3000
npm run check                       # lint + typecheck + unit tests
```

Never commit `.env.local` or any secret. Brand assets in `public/brand` and
`brand-source/` are the official UNAR artwork — do not redraw or alter them.
