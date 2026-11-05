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

Email is needed for order emails, email confirmation of new accounts and
"Forgot password" links. Without email the shop still works: customers can
order as guests **and can create accounts** (the account works straight
away, without a confirmation email). Once email is set up, new accounts
must confirm their address by the emailed link, and password reset works.

**No domain yet?** Hostinger mailboxes need your own domain. Until you have
one, use your Gmail: turn on 2-Step Verification, create an **App password**
at myaccount.google.com/apppasswords, and set `SMTP_HOST=smtp.gmail.com`,
`SMTP_PORT=465`, `SMTP_USER` = your Gmail address, `SMTP_PASSWORD` = the app
password (**SECRET**), `EMAIL_FROM=UNAR <your Gmail address>`.

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

**Google Pay and PhonePe through Razorpay:** Razorpay's payment window
already offers UPI, so customers can pay with Google Pay, PhonePe, Paytm or
any UPI app. You only need the options below if you also want PhonePe's own
gateway, or payments straight to your own UPI ID.

### 4.4 PhonePe Payment Gateway (optional)
For a PhonePe Business **Payment Gateway** account (not just the QR app).
1. In the PhonePe Business dashboard, find the **Developer / API** settings
   and note the **Client ID**, **Client Version** and **Client Secret**
   (**SECRET**). Start with the **test (UAT/sandbox)** credentials.
2. Add them in Hostinger (Part 5): `PHONEPE_CLIENT_ID`,
   `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION` (usually `1`), and
   leave `PHONEPE_ENV` as `none` while testing.
3. Webhook: in the PhonePe dashboard add a webhook with the address shown in
   **Dashboard → Integrations → PhonePe** (it ends in `/api/webhooks/phonepe`),
   choose a username and password there, tick *checkout.order.completed* and
   *checkout.order.failed*, and put the same username/password into
   `PHONEPE_WEBHOOK_USERNAME` / `PHONEPE_WEBHOOK_PASSWORD` (**SECRET**).
4. Redeploy. Checkout then shows **Pay with PhonePe**. Place a test order.
5. To go live: replace the three client values with the **production** ones,
   set `PHONEPE_ENV` to `production`, create the webhook for production too,
   and redeploy.

The shop always asks PhonePe directly whether a payment succeeded before it
marks an order paid. This PhonePe connection was tested only against a
local stand-in for PhonePe — do a test-mode payment before going live.

### 4.5 Pay by UPI to your own UPI ID — Google Pay / PhonePe Business (optional, no gateway)
No gateway account or fees: customers pay straight into your bank account.
The trade-off is that **you confirm each payment yourself**.
1. Find your business UPI ID in your Google Pay Business or PhonePe Business
   app (e.g. `unarfoods@okaxis`). It is not a secret.
2. Dashboard → **Settings → Checkout & payments**: tick **Offer "Pay by UPI
   to our UPI ID"**, enter the UPI ID and the name customers should see, and
   save.
3. When a customer chooses it, their order page shows your UPI QR code and an
   **Open my UPI app** button with the exact amount; they then type the UPI
   transaction ID (UTR).
4. You get the new-order email ("UPI payment to check"). Open the order in
   the dashboard, check the money arrived in your UPI/bank app, then press
   **Confirm UPI payment received**. The customer gets their confirmation and
   invoice. If nothing arrived, cancel the order.

### 4.6 "Continue with Google" sign-in (optional)
1. Go to console.cloud.google.com → create a project (e.g. "UNAR shop") →
   **APIs & Services → OAuth consent screen**: choose *External*, fill in
   the app name and your email, and publish it.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   → type **Web application**. Under **Authorised redirect URIs** add the
   address shown in **Dashboard → Integrations → Google sign-in** (it ends
   in `/auth/google/callback`, e.g.
   `https://coral-seahorse-181020.hostingersite.com/auth/google/callback`).
   Add your own domain's address too once it is connected.
3. Put the **Client ID** into `GOOGLE_CLIENT_ID` and the **Client secret**
   into `GOOGLE_CLIENT_SECRET` (**SECRET**) in Hostinger, and redeploy.
   Sign-in and sign-up pages then show **Continue with Google**.

### 4.7 WhatsApp order updates (optional)
**Without any setup:** every order in the dashboard has a **Message on
WhatsApp** button that opens WhatsApp with a ready-written message to the
customer.

**Automatic messages** (order received, payment confirmed, shipped with the
tracking link, delivered, cancelled) use Meta's official WhatsApp Cloud API:
1. At business.facebook.com create/verify your business, then in **WhatsApp
   Manager** add a phone number that is **not** already used in the normal
   WhatsApp or WhatsApp Business app.
2. Create message **templates** (category *Utility*) and wait for approval.
   Use these placeholders in the body: `{{1}}` = customer's first name,
   `{{2}}` = order number, `{{3}}` = link (tracking link for "shipped",
   otherwise the order page). **Every template must contain all three**, and
   Meta doesn't allow the text to end with a placeholder. Example: *Hi {{1}},
   your UNAR order {{2}} has been shipped. Track your parcel here: {{3}} .
   Team UNAR*. Ready-to-use texts for all five are in
   `docs/CLAUDE_IN_CHROME_WHATSAPP.md`.
3. Create a **permanent access token** (System user → Generate token, with
   whatsapp_business_messaging permission) and note the **Phone number ID**.
4. In Hostinger add `WHATSAPP_ACCESS_TOKEN` (**SECRET**) and
   `WHATSAPP_PHONE_NUMBER_ID`, and redeploy.
5. Dashboard → **Settings → Emails**: tick **Send automatic WhatsApp order
   updates**, enter the language code and the template names, save.
Checkout then offers "Send me order updates on WhatsApp"; only customers who
tick it get messages (WhatsApp's rules require the customer's consent).
6. **WhatsApp for you on every new order:** create one more template, e.g.
   `unar_new_order` — *New UNAR order {{1}} from {{2}}. Open it in the
   dashboard: {{3}} . Team UNAR* ({{1}} order number, {{2}} customer ·
   amount · payment, {{3}} dashboard link) — and in Settings → Emails fill
   in "WhatsApp me about every new order" with your mobile number(s) (not the
   shop's sending number) and the template name.
7. **Sign in with mobile number:** create an **Authentication** template
   (e.g. `unar_login_code`, "Copy code" button, 10-minute expiry) and enter
   its name under "WhatsApp template: sign-in code". The login page then
   shows **Sign in with mobile number**: the customer types their number,
   gets a 6-digit code on WhatsApp, and is signed in (new customers also give
   their name and email). Existing customers can add their number in
   Account → Security. Each code is one WhatsApp message (Meta charges a few
   paise); codes last 10 minutes, allow 5 tries and work once. Meta charges per message (see Meta's pricing).

### 4.8 Courier (Shiprocket) with automatic tracking (optional)
1. Shiprocket → Settings → API → **Create an API user** (a separate email).
   Put it into `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` (**SECRET**).
2. Dashboard → Settings → Shipping: enter your Shiprocket **pickup location
   name** exactly as in Shiprocket and the default box size.
3. Automatic tracking: choose a long random text (24+ characters) as a token,
   put it into `SHIPROCKET_WEBHOOK_TOKEN` (**SECRET**), and in Shiprocket →
   Settings → API → **Webhooks** add the URL shown on Dashboard →
   Integrations (ends in `/api/webhooks/courier`) with the same token.
4. Redeploy. On an order: **Create in Shiprocket** → assign the courier/AWB
   in Shiprocket. From then on the order changes to *Shipped* and
   *Delivered* by itself and the customer gets the email (and WhatsApp
   message). Without the webhook, tracking still refreshes with the daily job
   and the **Sync tracking** button.

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
| `NEXT_PUBLIC_SITE_URL` | the address your shop is opened on, e.g. `https://seashell-donkey-270999.hostingersite.com` today and `https://www.unarfoods.in` once your own domain works (no `/` at the end). Recommended: it makes links in emails always point at your own site. `none` also works — the site then uses whatever address it is opened on. Change it and redeploy whenever the address changes. |
| `RAZORPAY_KEY_ID` | from Part 4 |
| `RAZORPAY_KEY_SECRET` | from Part 4 (**SECRET**) |
| `RAZORPAY_WEBHOOK_SECRET` | from Part 4 (**SECRET**) |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | from Part 3 (**SMTP_PASSWORD is SECRET**) |
| `CRON_SECRET` | a new long random password, 40+ characters (**SECRET**) |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | only if you use Shiprocket (create an **API user** in Shiprocket → Settings → API) |
| `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION`, `PHONEPE_ENV`, `PHONEPE_WEBHOOK_USERNAME`, `PHONEPE_WEBHOOK_PASSWORD` | only for PhonePe's gateway (Part 4.4); otherwise `none`. The secret and webhook password are **SECRET** |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | only for "Continue with Google" (Part 4.6); otherwise `none`. The secret is **SECRET** |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | only for automatic WhatsApp messages (Part 4.7); otherwise `none`. The token is **SECRET** |
| `SHIPROCKET_WEBHOOK_TOKEN` | only for automatic courier tracking (Part 4.8); otherwise `none` (**SECRET**) |

**About `DB_HOST`:** on Hostinger the website and the database are on the
same account, so `localhost` normally works. If `/api/health` says the
database is *unreachable*, use the **MySQL host** shown next to your
database in hPanel → Databases instead, and redeploy.

Never add `RAZORPAY_API_BASE_URL`, `PHONEPE_API_BASE_URL`, `GOOGLE_OAUTH_BASE_URL`, `WHATSAPP_API_BASE_URL` or `SHIPROCKET_API_BASE_URL` — they exist only for automated tests (and
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
4. **Two-step sign-in** (required for staff): the dashboard first asks you
   to set it up. Install **Google Authenticator** or **Microsoft
   Authenticator** on your phone, scan the QR code, type the 6-digit code,
   and save the 10 **recovery codes** somewhere safe (password manager or
   printed). From then on, signing in asks for a code from the app. If you
   lose your phone, use one recovery code instead (each works once).

This page works only once — as soon as an owner exists it is locked. (You
can then delete `SETUP_KEY` from the environment variables if you like.)
Add other staff later from **Dashboard → Staff** (they first create a
customer account on the website, and confirm their email if email is set up).

### 7.2 Work through the launch checklist
The **Overview** page shows a checklist until everything is done. In short:
1. **Settings → Business details** — confirm address, phone, email, FSSAI, tick "checked".
2. **Products** — both products are already **published** (visible in the
   shop, shown as *Sold out* until you add stock). For each product: check
   every text against the pack, check the **selling price** (₹149 / ₹120 =
   MRP), decide which **claims and benefits** to approve and approve the
   shelf life — nothing unapproved is shown. See [OWNER_CHECKLIST.md](OWNER_CHECKLIST.md).
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

**Invoices are emailed automatically** (once email is set up, Part 3): the
PDF invoice is attached to the "payment confirmed" email for online
payments, and sent when you mark cash on delivery or a UPI payment as
received. To resend one, open the order → **Email invoice (PDF) to
customer**. Switch automatic invoices off in Settings → Emails.

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
- Keep **two-step sign-in** on for staff (Dashboard → Settings →
  Security). Staff sign-ins expire after 12 hours by default. If a phone or
  laptop is lost, open Account → Security → **Sign out everywhere else**.
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
1. Open `/api/health`. If it says `"database":"not configured"`, the
   database settings are missing (Part 2 and Part 5) — products are stored
   in the database, so nothing can be shown without it.
2. With the database connected, both products appear automatically
   (published, shown as *Sold out* while stock is 0). If one is missing,
   check **/admin → Products**: it may have been set to *Draft* or
   *Archived* — open it and choose *Published*.
3. To make them buyable, enter stock in **Inventory** (Part 7).

### Checkout says delivery isn't available
Activate a shipping zone: **/admin → Shipping** → edit *All India —
Standard* → enter your charge → tick **Active** → Save.

### "Accounts are not available yet"
The database isn't connected yet (see "Products don't appear" above).

### Emails land in the spam folder
- `EMAIL_FROM` must use the same address as `SMTP_USER` (Dashboard →
  Integrations warns you if not).
- New senders are often filtered at first: ask the first customers (and
  yourself) to open the spam folder and press **Not spam**.
- Best fix: your own domain with Hostinger email. Hostinger adds the SPF,
  DKIM and DMARC records when the domain uses Hostinger's nameservers
  (check hPanel → Emails → your domain → DNS / Deliverability). Emails that
  link to a temporary *.hostingersite.com address are filtered more often.

### A customer says the confirmation email never arrived
Ask them to sign in with their email and password — the site sends a fresh
confirmation link (at most 3 per hour). If none arrive, check Part 3 and the
**Integrations → Send test email** button.
