# UNAR website — setup guide (no coding needed)

This guide takes you from "the code is on GitHub" to "customers can buy
Banana Chewy on my own domain". Follow the parts **in order**. Plan for
about **2–3 hours** spread over a few days (Razorpay KYC and DNS changes
take time to be approved).

> **Golden rule for secrets.** Some values below are marked **SECRET**
> (keys, passwords). Paste them **only** into the website settings named in
> this guide (your hosting's environment variables or Supabase). Never put them in
> chat, email, WhatsApp, GitHub, screenshots or documents. If you think a
> secret was exposed, create a new one in that service, update it in your hosting settings,
> and delete the old one.

Keep a password manager (e.g. Bitwarden, 1Password, or your phone's built-in
one) open while you work, and save every account password and secret there.

> **Website shows only "UNAR — One Healthy Habit a Day" and nothing else?**
> The website is running but cannot read its database yet. Open
> `https://YOUR-SITE/api/health` — it says exactly what is missing and how
> to fix it (see [Troubleshooting](#troubleshooting) at the end).

---

## Part 0 — What you will create

| Service | What it does | Cost (check the current price on their site) |
| --- | --- | --- |
| **GitHub** | Stores the website code | Free |
| **Supabase** | Database, customer logins, uploaded images | Free plan for testing. **Pro plan recommended for the live shop** — free projects are paused after a week without visitors and have no automatic backups. |
| **Hosting — Hostinger** (you already have it) | Runs the website | Your plan must include **Node.js web apps** — Hostinger lists this on **Business Web Hosting** and the **Cloud** plans. The cheaper *Premium/Single* plans can't run this website (upgrade, or use Vercel instead). |
| *or* **Vercel** | Runs the website (alternative) | Hobby (free) is for personal, non-commercial use only; a shop needs **Pro**. |
| **Razorpay** | Takes online payments (UPI, cards, net banking) | Per-transaction fee, no monthly fee |
| **Email** — your **Hostinger email** (included with Business plans) *or* **Resend** | Sends order emails | Included / free plan |
| **Your domain** (Hostinger, GoDaddy, BigRock…) | Your web address | Yearly fee |
| **Shiprocket** (optional) | Courier bookings | Per shipment |

Turn on **two-factor authentication (2FA)** in every one of these accounts.

---

## Part 1 — GitHub (the code)

The code is in the repository **customiseremindme-netizen/Unar-foods**,
on the branch `claude/gifted-dirac-rkndzu`. To make it the main version:

1. Sign in at <https://github.com> and open the repository.
2. You will see a yellow bar *"claude/gifted-dirac-rkndzu had recent
   pushes"* with a **Compare & pull request** button. Click it. (If you don't
   see it: click **Pull requests → New pull request**, choose
   `base: main` and `compare: claude/gifted-dirac-rkndzu`.)
3. Click **Create pull request**, then **Merge pull request → Confirm merge**.

From now on, every change merged into `main` can be published by your
hosting (Part 5). Keep the repository **Private**
(Settings → General → Danger Zone → Change visibility).

---

## Part 2 — Supabase (database and logins)

### 2.1 Create the project
1. Go to <https://supabase.com> → **Sign in with GitHub** → **New project**.
2. **Name:** `unar-shop`. **Database password:** click *Generate a password*
   and save it in your password manager (**SECRET**).
3. **Region:** *South Asia (Mumbai)* — closest to your customers.
4. Click **Create new project** and wait 1–2 minutes.

### 2.2 Create the database tables (one copy-paste)
1. In the left menu click **SQL Editor** → **New query**.
2. On GitHub open the file `supabase/setup/all-migrations.sql`, click the
   **Copy raw file** button (two overlapping squares), paste everything into
   the Supabase SQL editor, and click **Run**.
3. You should see *"Success. No rows returned"*. Run it **only once**.

This creates every table, the security rules, your two Banana Chewy
products (as **drafts** with **0 stock**), starter page texts and settings.
Nothing is visible to customers until you publish it from the dashboard.

> Do **not** run `supabase/seed.sql` on the live project — it contains demo
> stock for testing only.

### 2.3 Copy the keys
Click the **Settings** (gear) icon → **API Keys**. Note down:

| What Supabase calls it | Where it goes (hosting environment variable) |
| --- | --- |
| Project URL (Settings → Data API, or the **Connect** button) | `NEXT_PUBLIC_SUPABASE_URL` |
| **Publishable key** (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Secret key** (`sb_secret_…`) — click *Reveal* — **SECRET** | `SUPABASE_SECRET_KEY` |

(If you only see "Legacy API keys", the `anon` key also works for the
publishable one and `service_role` for the secret one — but Supabase is
retiring those, so create the new keys if offered.)

### 2.4 Login settings
**Authentication → URL Configuration**
- **Site URL:** your final address, e.g. `https://www.unarfoods.in`
  (use the temporary address from Part 5 until your domain is connected,
  then come back and change it).
- **Redirect URLs → Add URL:** `https://www.unarfoods.in/**` (and the
  temporary hosting address too, e.g. `https://….hostingersite.com/**`, if
  you test on it).

**Authentication → Sign In / Providers → Email**
- *Confirm email*: **ON**.
- Minimum password length: **8** or more.

**Authentication → Emails → Templates** (recommended — makes email links
work even if the customer opens them in a different browser). Edit each
template and replace the link inside the button with:

| Template | Link to use |
| --- | --- |
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account` |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` |
| Change email address | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/account` |

### 2.5 Send login emails through your own email (after Part 3)
Supabase's built-in email only sends a couple of emails per hour — not
enough for a shop. **Authentication → Emails → SMTP Settings → Enable custom SMTP**:

| Field | Hostinger email | Resend |
| --- | --- | --- |
| Sender email | `orders@your-domain` | `orders@your-domain` |
| Sender name | `UNAR` | `UNAR` |
| Host | `smtp.hostinger.com` | `smtp.resend.com` |
| Port | `465` | `465` |
| Username | the full mailbox address, e.g. `orders@unarfoods.in` | `resend` |
| Password | that mailbox's password (**SECRET**) | your Resend API key (**SECRET**) |

### 2.6 Backups
On the Pro plan, daily backups are automatic (**Database → Backups**).

---

## Part 3 — Order emails (choose ONE)

Without email the shop still works — customers see their order on screen —
but no emails are sent. The dashboard shows "skipped" honestly in
**Integrations → Recent emails**.

### Option A — your Hostinger email (recommended for you)
1. hPanel → **Emails** → choose your domain → **Create email account** →
   `orders@your-domain` (e.g. `orders@unarfoods.in`) with a strong password
   (**SECRET**, save it).
2. You will add these settings to your hosting in Part 5:

   | Name | Value |
   | --- | --- |
   | `SMTP_HOST` | `smtp.hostinger.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | `orders@unarfoods.in` (the full address) |
   | `SMTP_PASSWORD` | the mailbox password (**SECRET**) |
   | `EMAIL_FROM` | `UNAR <orders@unarfoods.in>` |

   (If sending fails, Hostinger suggests port `587` instead of `465`.)

### Option B — Resend
1. Sign up at <https://resend.com> → **Domains → Add domain** and add the
   DNS records it shows (Part 6 explains DNS) → **Verify**.
2. **API Keys → Create API key** (*Sending access*) → `RESEND_API_KEY` (**SECRET**).
3. `EMAIL_FROM` = e.g. `UNAR <orders@unarfoods.in>`.

If both are filled in, Resend is used.

---

## Part 4 — Razorpay (online payments)

### 4.1 Account
1. Sign up at <https://razorpay.com> and complete **KYC / business
   verification** (PAN, bank account, business details, website address).
   Live payments only work after Razorpay approves your account.
2. Your website must show your policies before approval — they are at
   `/policies/…` on your site (finish them first — see the Owner Checklist).

### 4.2 Test mode first
1. In the Razorpay Dashboard switch the toggle at the top to **Test Mode**.
2. **Account & Settings → API Keys → Generate Key**. Copy:
   - Key ID (`rzp_test_…`) → `RAZORPAY_KEY_ID`
   - Key Secret → `RAZORPAY_KEY_SECRET` (**SECRET**, shown only once)
3. **Account & Settings → Webhooks → + Add New Webhook**
   - **Webhook URL:** `https://YOUR-SITE/api/webhooks/razorpay`
     (the exact address is shown in your dashboard under **Integrations**)
   - **Secret:** make up a long random password (30+ characters), save it →
     `RAZORPAY_WEBHOOK_SECRET` (**SECRET**)
   - **Active events:** tick `payment.authorized`, `payment.captured`,
     `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`
   - **Create Webhook**.

### 4.3 Going live (after testing — Part 7)
Switch to **Live Mode**, generate **live** keys (`rzp_live_…`), create the
**same webhook again in Live Mode** (test and live webhooks are separate),
and replace the three Razorpay values in your hosting settings, then
redeploy (Part 5).

---

## Part 5 — Publishing the website (choose ONE)

### The settings list (needed for either option)
Every value below goes into your hosting's **Environment Variables**. Add
them **before the first deploy** — the website reads several of them while
it is being built, so **after adding or changing any value you must
redeploy**. (Forgetting this is the most common reason the site shows only
"UNAR — One Healthy Habit a Day".)

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://www.unarfoods.in` (your final address, no `/` at the end) |
| `NEXT_PUBLIC_SUPABASE_URL` | from Part 2.3 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from Part 2.3 |
| `SUPABASE_SECRET_KEY` | from Part 2.3 (**SECRET**) |
| `RAZORPAY_KEY_ID` | from Part 4 |
| `RAZORPAY_KEY_SECRET` | from Part 4 (**SECRET**) |
| `RAZORPAY_WEBHOOK_SECRET` | from Part 4 (**SECRET**) |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | from Part 3, option A (**SMTP_PASSWORD is SECRET**) |
| *or* `EMAIL_FROM`, `RESEND_API_KEY` | from Part 3, option B (**SECRET**) |
| `CRON_SECRET` | a new long random password, 40+ characters (**SECRET**) |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | only if you use Shiprocket (create an **API user** in Shiprocket → Settings → API) |

Never add `RAZORPAY_API_BASE_URL` — it exists only for automated tests (and
is ignored on the live site anyway). The file `.env.example` in the code
lists the same names.

### 5A — Hostinger (Node.js web app)
1. hPanel → **Websites → Add website** → choose **Node.js Apps** /
   *Node.js web app* (if you don't see this option, your plan doesn't
   include Node.js — see Part 0).
2. Choose **Import Git repository** → **Connect GitHub** → allow access to
   the **Unar-foods** repository → pick the branch **`main`** (after Part 1;
   until then you can pick `claude/gifted-dirac-rkndzu`).
3. Build settings — Hostinger detects **Next.js** automatically. Check:
   - **Node.js version:** **`22.x`** (required — 20.x is too old for the
     database library)
   - **Build command:** `npm run build` · **Start command:** `npm start`
   - Root / output directory: leave the defaults.
4. **Environment Variables:** add every row from the table above — easiest:
   open `docs/hostinger-env-template.txt`, save a copy on your computer as
   `unar-hostinger.env`, replace each `PASTE_…` with your value, then click
   **Edit → import .env** and choose that file. For anything you haven't set
   up yet (Razorpay, email, Shiprocket) leave the value as `none` — the site
   treats `none` as "not set up". Delete the file from your computer
   afterwards (it contains secrets). Then **Deploy**.
5. When it finishes, open the temporary address Hostinger shows, then open
   `/api/health` on it. You want `"database":"ok"`.
6. **Changing a value later:** your app → **Deployments → Settings and
   redeploy → Environment Variables** → edit → **Save and redeploy**.
7. **Daily payment check (recommended):** hPanel → your website →
   **Cron Jobs** (under *Advanced*) → **Create** (type **Custom**), run once a day
   (e.g. `0 21 * * *` = 2:30 am India time — Hostinger cron uses UTC) with
   this command (replace the two parts in capitals):
   ```
   curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://www.YOUR-DOMAIN/api/cron/reconcile
   ```
   If your plan doesn't offer cron jobs for Node.js apps, skip this — the
   shop also does this check whenever someone checks out and whenever staff
   open the dashboard.
8. If a deploy fails, open the app's **deployment logs** in hPanel and send
   Claude the error text (never the secret values). The build uses
   `next build --webpack` on purpose: Hostinger's build servers can't run
   Next.js's newer Turbopack builder.

### 5B — Vercel (alternative)
1. <https://vercel.com> → **Sign up with GitHub** → **Add New… → Project**
   → **Unar-foods** → **Import**. Framework: **Next.js** (leave defaults).
2. **Environment Variables:** add the table above (tick *Production* and
   *Preview*) → **Deploy**.
3. Changing a value later: **Settings → Environment Variables → edit**, then
   **Deployments → ⋯ → Redeploy**.
4. Upgrade to **Pro** before taking real orders (Hobby is non-commercial
   only). The daily payment check runs automatically from `vercel.json`.

---

## Part 6 — Your domain (DNS)

**If your domain is registered at Hostinger and the site is hosted on
Hostinger (5A):** choose the domain when creating the Node.js app (or in the
app's **Domains** settings) — Hostinger sets the DNS records and the free
SSL padlock for you. Then make sure `NEXT_PUBLIC_SITE_URL` (hosting) and
**Site URL** (Supabase, Part 2.4) both use the final `https://www…`
address and redeploy. Skip to step 5 below.

**If the site is on Vercel (5B):**
1. Vercel → **Project → Settings → Domains → Add** → your domain. Choose the
   recommended option (usually redirect `unarfoods.in` → `www.unarfoods.in`).
2. Vercel shows the exact **DNS records** to create — typically an **A**
   record for `@` and a **CNAME** for `www`. Use the values Vercel shows.
3. At your domain company (for Hostinger: hPanel → **Domains → your domain
   → DNS / Nameservers → DNS records**): delete old A/CNAME records for `@`
   and `www` that point elsewhere, then add Vercel's records exactly.
4. Wait 10–60 minutes (sometimes up to 24 h). Vercel shows a green tick and
   sets up HTTPS automatically.

**Then, in every case:**
5. If you chose Resend for email, add its DNS records too. If you use
   Hostinger email, **don't delete the MX records** Hostinger created.
6. Update the Razorpay webhook URL if you created it with the temporary address.

---

## Part 7 — First-time setup in your dashboard

### 7.1 Make yourself the owner
1. On your website click the **person icon → Create an account** and sign
   up with the email you want to use for the business.
2. Click the confirmation link in the email you receive.
3. In Supabase → **SQL Editor → New query**, paste (with your email) and **Run**:
   ```sql
   select public.bootstrap_owner('you@example.com');
   ```
   It says *"Owner access granted"*. This only works once — when there is
   no owner yet. Add other staff later from **Dashboard → Staff**.
4. Go to `https://YOUR-SITE/admin`.

### 7.2 Work through the launch checklist
The **Overview** page shows a checklist until everything is done. In short:
1. **Settings → Business details** — confirm address, phone, email, FSSAI, tick "checked".
2. **Products** — for each product: check every text against the pack,
   set the **selling price**, decide which **claims** to approve, approve the
   shelf life, then publish. See [OWNER_CHECKLIST.md](OWNER_CHECKLIST.md).
3. **Inventory** — enter your real stock (*Set to* → reason *Opening stock*).
4. **Shipping** — edit "All India — Standard": enter your real charge,
   free-shipping amount (if any), tick **Active**. Add state or PIN-code
   zones if prices differ.
5. **Content → Pages & policies** — complete every policy (fill all
   `[brackets]`), have them checked, then untick *Owner review required*.
6. **Settings → Checkout** — decide on Cash on Delivery and any COD fee.
7. **Settings → Tax** — only if GST-registered (enter GSTIN, then HSN + GST
   rate on each product, as advised by your accountant).
8. **Integrations** — check Razorpay shows *Test mode*, the webhook
   secret is set and Email shows *SMTP* (Hostinger) or *Resend*; press
   **Send me a test email**.

### 7.3 Place test orders (Razorpay test mode)
1. Buy a product on your site and pay with Razorpay's **test** UPI / card
   details (listed in Razorpay's docs under *Test card details*).
2. Check: you see the confirmation page, the order appears in **Orders**
   as *Paid*, stock went down by one, you received emails, and
   **Integrations → Recent payment webhooks** shows *processed*.
3. Try a refund from the order page, and mark an order as shipped with a
   tracking number.
4. Cancel/refund the test orders. Then switch Razorpay to **live** (Part 4.3).

### 7.4 Before announcing the shop
- **Settings → Search & sharing:** make sure *Allow search engines* is ON.
- Submit `https://YOUR-SITE/sitemap.xml` in
  [Google Search Console](https://search.google.com/search-console)
  (verify ownership with the DNS TXT record it gives you).

---

## Part 8 — Everyday use

| Task | Where |
| --- | --- |
| New orders | **Orders → To fulfil**. Open an order → *Start processing → Mark packed → Add tracking → Mark shipped → Mark delivered*. Customers get an email at shipped/delivered. |
| COD orders | When the courier pays you, open the order → **Mark COD collected** (only then is it counted as revenue). |
| Refunds | Order page → **Refund** (online payments go back automatically via Razorpay; for COD, pay the customer yourself, then record it). |
| Stock | **Inventory → Update stock** (every change is logged). |
| Prices, photos, text | **Products** → click the product → **Save**. |
| Homepage | **Content → Homepage** → edit → **Save & preview** → **Publish**. |
| Discount codes | **Marketing → Coupons**. |
| Reviews | **Reviews** — approve genuine reviews only; never edit what customers wrote. |
| Sales figures | **Reports** (download CSV for your accountant). |
| Who changed what | **Activity log**. |

---

## Part 9 — Safety habits

- Give each helper their **own** account with the smallest role
  (*Fulfilment staff* for packing, *Content editor* for photos/text). Remove
  access when they leave (**Staff → Remove**).
- The website code never contains secrets; they live only in your hosting
  settings (Hostinger or Vercel) and Supabase. Never paste them anywhere else.
- No website is "unhackable". This one follows good practice (HTTPS,
  database row-level security, server-side price checks, signed payment
  confirmations, rate limits, audit log) — keep your accounts protected with
  strong passwords and 2FA, and keep the code updated.
- If something looks wrong with a payment, check **Razorpay Dashboard →
  Payments** — it is the source of truth for money.

---

## Part 10 — Asking Claude for changes

Describe what you want in plain words (e.g. *"Add a 250 g pack of the Fresh
Raw Banana at ₹249"*, *"Make the homepage hero image bigger on phones"*).
Mention the page address and attach a screenshot if possible. Changes are
made on a separate branch, tested, and published only after you merge them
(Part 1) and your hosting redeploys. Most content changes don't need Claude at all — use the
dashboard.

---

## Troubleshooting

### The website shows only "UNAR — One Healthy Habit a Day"
Open `https://YOUR-SITE/api/health`. It shows one of these:

| It says | What to do |
| --- | --- |
| `"database":"not configured"` | `NEXT_PUBLIC_SUPABASE_URL` and/or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are missing. Add them (Part 5) and **redeploy**. |
| `"connected, but the tables are missing"` | The database setup wasn't run. Do Part 2.2 (paste `supabase/setup/all-migrations.sql` into Supabase → SQL Editor → Run). Then wait 5 minutes or redeploy. |
| `"connected, but the key was refused"` | The publishable key belongs to a different Supabase project or was copied incompletely. Copy it again (Part 2.3) and redeploy. |
| `"unreachable"` | The Supabase URL is wrong (it looks like `https://abcd1234.supabase.co`) or the Supabase project is paused (free plan) — open Supabase and press *Restore*. |
| `"database":"ok"` but the homepage is still bare | The page was saved before the database was connected. **Redeploy** (or wait 5 minutes and refresh). |

`"server_key":"missing"` means `SUPABASE_SECRET_KEY` is missing — checkout and
the dashboard need it.

### Products don't appear in the shop
That's expected at first: both products start as **drafts with 0 stock**.
Sign in, open **/admin → Products**, check each product and **Publish** it,
then set stock in **Inventory** (Part 7).

### Checkout says delivery isn't available
Activate a shipping zone: **/admin → Shipping** → edit *All India —
Standard* → enter your charge → tick **Active** → Save.

