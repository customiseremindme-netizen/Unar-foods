# UNAR website — setup guide (no coding needed)

This guide takes you from "the code is on GitHub" to "customers can buy
Banana Chewy on my own domain". Everything runs on **Hostinger**: the
website and its database (MySQL). Follow the parts **in order**. Plan for
about **2 hours** spread over a few days (Razorpay KYC and DNS changes take
time to be approved).

> **Golden rule for secrets.** Some values below are marked **SECRET**
> (passwords, keys). Paste them **only** into Hostinger's environment
> variables for your website (Part 5). Never put them in chat, email,
> WhatsApp, GitHub, screenshots or documents. If you think a secret was
> exposed, change it at its source (e.g. a new database password in
> Hostinger), update it in the environment variables and redeploy.

Keep a password manager (e.g. Bitwarden, 1Password, or your phone's built-in
one) open while you work, and save every account password and secret there.

> **Something not working?** Open `https://YOUR-SITE/api/health` — it says
> in plain words what is missing and how to fix it (see
> [Troubleshooting](#troubleshooting) at the end).

---

## Part 0 — What you need

| Service | What it does | Cost (check the current price on their site) |
| --- | --- | --- |
| **GitHub** | Stores the website code (Claude makes all code changes here) | Free |
| **Hostinger** (you already have it) | Runs the website **and** its MySQL database | Your plan must include **Node.js web apps** — Hostinger lists this on **Business Web Hosting** and the **Cloud** plans. The cheaper *Premium/Single* plans can't run this website. |
| **Razorpay** | Takes online payments (UPI, cards, net banking) | Per-transaction fee, no monthly fee |
| **Hostinger email** (included with Business plans) | Order emails, account confirmation and password-reset emails | Included |
| **Your domain** (Hostinger, GoDaddy, BigRock…) | Your web address | Yearly fee |
| **Shiprocket** (optional) | Courier bookings | Per shipment |

Turn on **two-factor authentication (2FA)** in every one of these accounts.

There is **no SQL to paste** and no separate database service: the website
creates and updates its own tables in your Hostinger database automatically
the first time it starts.

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

From now on, every change merged into `main` can be published by Hostinger
(Part 5). Keep the repository **Private**
(Settings → General → Danger Zone → Change visibility).

---

## Part 2 — Create the database (Hostinger)

1. hPanel → **Websites** → your website → **Databases** (sometimes shown as
   **Databases → Management**).
2. Under **Create a new MySQL database**, fill in:
   - **Database name:** `unar` (Hostinger adds a prefix, so it becomes
     something like `u123456789_unar`)
   - **Username:** `unar` (becomes e.g. `u123456789_unar`)
   - **Password:** click *Generate* or make a strong one — save it
     (**SECRET**).
3. Click **Create**. In the list below you now see the **full** database
   name and username (with the `u123456789_` prefix). Note both exactly.

That's all. Leave the database empty — the website fills it.

What goes into it: your products, orders, customers, website texts and the
images you upload in the dashboard. Hostinger's daily backups include it
(see Part 9).

---

## Part 3 — Email (Hostinger mailbox)

Email is needed for order emails **and** for customer accounts (the
confirmation link and password-reset link are sent by email). Without
email the shop still works for guests — customers see their order on
screen — but no emails are sent and new customers can't create accounts.

1. hPanel → **Emails** → choose your domain → **Create email account** →
   `orders@your-domain` (e.g. `orders@unarfoods.in`) with a strong password
   (**SECRET**, save it).
2. You will add these settings in Part 5:

   | Name | Value |
   | --- | --- |
   | `SMTP_HOST` | `smtp.hostinger.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | `orders@unarfoods.in` (the full address) |
   | `SMTP_PASSWORD` | the mailbox password (**SECRET**) |
   | `EMAIL_FROM` | `UNAR <orders@unarfoods.in>` |

   (If sending fails, Hostinger suggests port `587` instead of `465`.)

*Alternative:* the site can also send through **Resend** (<https://resend.com>):
set `RESEND_API_KEY` and `EMAIL_FROM` instead. If both are filled in,
Resend is used.

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
and replace the three Razorpay values in Hostinger, then redeploy (Part 5).

---

## Part 5 — Publishing the website on Hostinger

### The settings list
Every value below goes into the website's **Environment Variables** in
Hostinger. **After adding or changing any value, redeploy.**

| Name | Value |
| --- | --- |
| `DB_HOST` | `localhost` (see the note below) |
| `DB_PORT` | `3306` |
| `DB_NAME` | the full database name from Part 2, e.g. `u123456789_unar` |
| `DB_USER` | the full database username from Part 2, e.g. `u123456789_unar` |
| `DB_PASSWORD` | the database password from Part 2 (**SECRET**) |
| `SETUP_KEY` | a long secret phrase you make up (at least 12 characters, e.g. four random words). It unlocks the one-time page that creates your owner account (Part 7.1). **SECRET** |
| `NEXT_PUBLIC_SITE_URL` | `none` while you only have the temporary hosting address (the site then uses whatever address it is opened on). Once your own domain works, change it to e.g. `https://www.unarfoods.in` (no `/` at the end) and redeploy. |
| `RAZORPAY_KEY_ID` | from Part 4 |
| `RAZORPAY_KEY_SECRET` | from Part 4 (**SECRET**) |
| `RAZORPAY_WEBHOOK_SECRET` | from Part 4 (**SECRET**) |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | from Part 3 (**SMTP_PASSWORD is SECRET**) |
| `CRON_SECRET` | a new long random password, 40+ characters (**SECRET**) |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | only if you use Shiprocket (create an **API user** in Shiprocket → Settings → API) |

**About `DB_HOST`:** on Hostinger the website and the database are on the
same account, so `localhost` normally works. If `/api/health` says the
database is *unreachable*, use the **MySQL host** shown next to your
database in hPanel → Databases instead, and redeploy.

Never add `RAZORPAY_API_BASE_URL` — it exists only for automated tests (and
is ignored on the live site anyway). The file `.env.example` in the code
lists the same names.

### Create the Node.js app
1. hPanel → **Websites → Add website** → choose **Node.js Apps** /
   *Node.js web app* (if you don't see this option, your plan doesn't
   include Node.js — see Part 0).
2. Choose **Import Git repository** → **Connect GitHub** → allow access to
   the **Unar-foods** repository → pick the branch **`main`** (after Part 1;
   until then you can pick `claude/gifted-dirac-rkndzu`).
3. Build settings — Hostinger detects **Next.js** automatically. Check:
   - **Node.js version:** **`22.x`** (required)
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
   `/api/health` on it. You want `"database":"ok"`. (The very first visit
   can take a few seconds longer while the site creates its tables.)
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
   Next.js's newer Turbopack builder. The build never needs the database —
   pages read it when visitors open them.

---

## Part 6 — Your domain (DNS)

**If your domain is registered at Hostinger:** choose the domain when
creating the Node.js app (or in the app's **Domains** settings) — Hostinger
sets the DNS records and the free SSL padlock for you.

**If your domain is somewhere else** (GoDaddy, BigRock…): either point its
nameservers to Hostinger (hPanel shows the two nameserver names), or add the
DNS records hPanel shows for the domain at your domain company. Wait 10–60
minutes (sometimes up to 24 h).

**Then:**
1. Set `NEXT_PUBLIC_SITE_URL` to the final `https://www…` address and
   redeploy (so email links and search engines use your real address).
2. If you use Hostinger email, **don't delete the MX records** Hostinger
   created.
3. Update the Razorpay webhook URL if you created it with the temporary address.

---

## Part 7 — First-time setup in your dashboard

### 7.1 Create your owner account
1. Open `https://YOUR-SITE/setup`.
2. Enter the **SETUP_KEY** from Part 5, your name, the email you want to use
   for the business and a strong password → **Create owner account**.
3. You are taken straight into the dashboard (`/admin`).

This page works only once — as soon as an owner exists it is locked. (You
can then delete `SETUP_KEY` from the environment variables if you like.)
Add other staff later from **Dashboard → Staff** (they first create a
customer account on the website and confirm their email).

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
   secret is set, Email shows *SMTP* and the database shows *ok*; press
   **Send me a test email**.

### 7.3 Place test orders (Razorpay test mode)
1. Buy a product on your site and pay with Razorpay's **test** UPI / card
   details (listed in Razorpay's docs under *Test card details*).
2. Check: you see the confirmation page, the order appears in **Orders**
   as *Paid*, stock went down by one, you received emails, and
   **Integrations → Recent payment webhooks** shows *processed*.
3. Try a refund from the order page, and mark an order as shipped with a
   tracking number.
4. Create a customer account with a second email address: you should get a
   confirmation email, and *Forgot password* should send a reset email.
5. Cancel/refund the test orders. Then switch Razorpay to **live** (Part 4.3).

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

## Part 9 — Safety habits and backups

- Give each helper their **own** account with the smallest role
  (*Fulfilment staff* for packing, *Content editor* for photos/text). Remove
  access when they leave (**Staff → Remove**).
- The website code never contains secrets; they live only in Hostinger's
  environment variables. Never paste them anywhere else.
- **Backups:** Hostinger Business plans make automatic backups that include
  your database (hPanel → Websites → your site → **Backups** — you can
  restore or download a database backup there). Once a month, also download
  a copy: hPanel → **Databases → phpMyAdmin** → select the database →
  **Export → Go**, and keep the file somewhere safe (it contains customer
  data — store it privately).
- Don't edit or delete tables in phpMyAdmin by hand — use the dashboard.
  The website manages its own tables.
- No website is "unhackable". This one follows good practice (HTTPS,
  access rules on every database query, server-side price checks, signed
  payment confirmations, hashed passwords, rate limits, audit log) — keep
  your accounts protected with strong passwords and 2FA, and keep the code
  updated.
- If something looks wrong with a payment, check **Razorpay Dashboard →
  Payments** — it is the source of truth for money.

---

## Part 10 — Asking Claude for changes

Describe what you want in plain words (e.g. *"Add a 250 g pack of the Fresh
Raw Banana at ₹249"*, *"Make the homepage hero image bigger on phones"*).
Mention the page address and attach a screenshot if possible. Changes are
made on a separate branch in GitHub, tested, and published only after you
merge them (Part 1) and Hostinger redeploys. If a change needs new database
columns, the website adds them by itself on the next start. Most content
changes don't need Claude at all — use the dashboard.

---

## Troubleshooting

### Check `/api/health` first
Open `https://YOUR-SITE/api/health`. It shows one of these:

| It says | What to do |
| --- | --- |
| `"database":"not configured"` | One of `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` is missing or still says `PASTE_…`. Add it (Part 5) and **redeploy**. |
| `"the database refused the user name or password"` | `DB_USER` or `DB_PASSWORD` doesn't match the database user in hPanel → Databases. The username includes the `u123456789_` prefix. You can set a new password for the user there, then update `DB_PASSWORD` and redeploy. |
| `"the database name was not found"` | `DB_NAME` must be the full name including the `u123456789_` prefix. |
| `"unreachable"` | `DB_HOST` is wrong. Try `localhost`; if that doesn't work, use the MySQL host shown in hPanel → Databases. Redeploy after each change. |
| `"error while preparing the tables"` | Redeploy once. If it repeats, send Claude the text after "send this to your developer" (it contains no secrets). |
| `"owner":"not yet …"` | Open `/setup` and create your owner account (Part 7.1). |
| `"database":"ok"` | The database is fine. |

### `/setup` says "One more setting"
`SETUP_KEY` is missing or shorter than 12 characters. Add it (Part 5) and redeploy.

### Products don't appear in the shop
That's expected at first: both products start as **drafts with 0 stock**.
Sign in, open **/admin → Products**, check each product and **Publish** it,
then set stock in **Inventory** (Part 7).

### Checkout says delivery isn't available
Activate a shipping zone: **/admin → Shipping** → edit *All India —
Standard* → enter your charge → tick **Active** → Save.

### "Creating an account isn't available yet"
Email isn't set up. Add the `SMTP_…` settings from Part 3 and redeploy.
Guests can still order meanwhile.
