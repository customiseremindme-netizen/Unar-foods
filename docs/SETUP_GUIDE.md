# UNAR website — setup guide (no coding needed)

This guide takes you from "the code is on GitHub" to "customers can buy
Banana Chewy on my own domain". Follow the parts **in order**. Plan for
about **2–3 hours** spread over a few days (Razorpay KYC and DNS changes
take time to be approved).

> **Golden rule for secrets.** Some values below are marked **SECRET**
> (keys, passwords). Paste them **only** into the website settings named in
> this guide (Vercel environment variables or Supabase). Never put them in
> chat, email, WhatsApp, GitHub, screenshots or documents. If you think a
> secret was exposed, create a new one in that service, update it in Vercel,
> and delete the old one.

Keep a password manager (e.g. Bitwarden, 1Password, or your phone's built-in
one) open while you work, and save every account password and secret there.

---

## Part 0 — What you will create

| Service | What it does | Cost (check the current price on their site) |
| --- | --- | --- |
| **GitHub** | Stores the website code | Free |
| **Supabase** | Database, customer logins, uploaded images | Free plan for testing. **Pro plan recommended for the live shop** — free projects are paused after a week without visitors and have no automatic backups. |
| **Vercel** | Runs the website | Hobby (free) is for **personal, non-commercial** use only. A shop that takes payments needs the **Pro** plan. |
| **Razorpay** | Takes online payments (UPI, cards, net banking) | Per-transaction fee, no monthly fee |
| **Resend** | Sends order emails | Free plan is enough to start |
| **Your domain** (GoDaddy, Hostinger, BigRock, Namecheap…) | Your web address | Yearly fee |
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

From now on, every change merged into `main` is published automatically by
Vercel (Part 5). Keep the repository **Private**
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

| What Supabase calls it | Where it goes (Vercel variable) |
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
  (use the Vercel address from Part 5 until your domain is connected,
  then come back and change it).
- **Redirect URLs → Add URL:** `https://www.unarfoods.in/**` (and later the
  `https://…vercel.app/**` address too if you test on it).

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
enough for a shop. After setting up Resend (Part 3):
**Authentication → Emails → SMTP Settings → Enable custom SMTP**
- Sender email: `orders@your-domain` · Sender name: `UNAR`
- Host: `smtp.resend.com` · Port: `465` · Username: `resend`
- Password: your Resend API key (**SECRET**)

### 2.6 Backups
On the Pro plan, daily backups are automatic (**Database → Backups**).

---

## Part 3 — Resend (order emails)

1. Sign up at <https://resend.com>.
2. **Domains → Add domain** → enter your domain (e.g. `unarfoods.in`).
   Resend shows 3–4 DNS records (TXT/MX). Add them at your domain company
   exactly as shown (see Part 6 for how DNS editing works), then click
   **Verify**. This can take from minutes to a few hours.
3. **API Keys → Create API key** → name `unar-website`, permission
   *Sending access* → copy it (**SECRET**) → this is `RESEND_API_KEY`.
4. Decide your sender, e.g. `UNAR <orders@unarfoods.in>` → this is
   `EMAIL_FROM`.

Without Resend the shop still works — customers see their order on screen —
but no emails are sent. The dashboard shows "skipped" honestly in
**Integrations → Recent emails**.

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
and replace the three Razorpay values in Vercel. Redeploy (Part 5.4).

---

## Part 5 — Vercel (publishing the website)

### 5.1 Import the project
1. Go to <https://vercel.com> → **Sign up with GitHub**.
2. **Add New… → Project** → find **Unar-foods** → **Import**.
   (If it's not listed, click *Adjust GitHub App Permissions* and allow
   access to that repository.)
3. Framework is detected as **Next.js** — leave the build settings as they are.

### 5.2 Environment variables
Before clicking Deploy, open **Environment Variables** and add each of these
(Name → Value). Tick **Production** and **Preview** for each.

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://www.unarfoods.in` (your final address, no `/` at the end) |
| `NEXT_PUBLIC_SUPABASE_URL` | from Part 2.3 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from Part 2.3 |
| `SUPABASE_SECRET_KEY` | from Part 2.3 (**SECRET**) |
| `RAZORPAY_KEY_ID` | from Part 4 |
| `RAZORPAY_KEY_SECRET` | from Part 4 (**SECRET**) |
| `RAZORPAY_WEBHOOK_SECRET` | from Part 4 (**SECRET**) |
| `RESEND_API_KEY` | from Part 3 (**SECRET**) |
| `EMAIL_FROM` | e.g. `UNAR <orders@unarfoods.in>` |
| `CRON_SECRET` | a new long random password, 40+ characters (**SECRET**) |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | only if you use Shiprocket (create an **API user** in Shiprocket → Settings → API) |

Never add `RAZORPAY_API_BASE_URL` — it exists only for automated tests (and
is ignored on the live site anyway).

### 5.3 Deploy
Click **Deploy**. After 2–4 minutes you get an address like
`unar-foods.vercel.app`. Open it — you'll see the homepage (products appear
after you publish them in Part 7).

### 5.4 Changing a variable later
**Project → Settings → Environment Variables → edit**, then
**Deployments → ⋯ (latest) → Redeploy**. Variables only take effect after a
redeploy.

### 5.5 Plan and region
- Upgrade to **Pro** before taking real orders (Hobby is non-commercial only).
- The scheduled payment check (`vercel.json`) runs once a day at 3 am IST.
  Unpaid reservations are also released automatically whenever someone
  checks out, so a daily run is enough.

---

## Part 6 — Your domain (DNS)

1. In Vercel: **Project → Settings → Domains → Add** → type
   `unarfoods.in` (your domain) → **Add**. Choose the recommended option
   (usually redirect `unarfoods.in` → `www.unarfoods.in`).
2. Vercel now shows the exact **DNS records** to create — typically an
   **A record** for `@` and a **CNAME** for `www`. Use the values Vercel
   shows you (they can change over time).
3. Sign in to your domain company and find **DNS / Manage DNS / DNS Zone**:
   - **Delete** any old A record for `@` and CNAME for `www` that point
     elsewhere (e.g. a "parked" page).
   - **Add** the records exactly as Vercel shows (Type, Name/Host, Value).
   - Leave TTL as default.
4. Also add the Resend records from Part 3 in the same DNS page.
5. Wait. Usually 10–60 minutes, sometimes up to 24 hours. Vercel shows a
   green tick and sets up the padlock (HTTPS) automatically.
6. Make sure `NEXT_PUBLIC_SITE_URL` (Vercel) and **Site URL** (Supabase,
   Part 2.4) both use the final `https://www…` address, then redeploy.
7. Update the Razorpay webhook URL if you created it with the
   `vercel.app` address.

> Using Google Workspace or Zoho Mail on the same domain? Don't delete your
> existing **MX** records.

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
8. **Integrations** — check Razorpay shows *Test mode* and the webhook
   secret is set; press **Send me a test email**.

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
- The website code never contains secrets; they live only in Vercel and
  Supabase. Never paste them anywhere else.
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
made on a separate branch, tested, and published to Vercel only after you
merge them (Part 1). Most content changes don't need Claude at all — use the
dashboard.
