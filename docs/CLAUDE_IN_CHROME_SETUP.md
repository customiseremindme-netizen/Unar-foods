Task: finish setting up my UNAR online shop, a Node.js app on Hostinger at https://coral-seahorse-181020.hostingersite.com. Use my Chrome, where I am signed in to Hostinger (hpanel.hostinger.com) and to my Google account. Work through Parts A–F in order.

Ground rules — follow these strictly:
- Never type, show, summarise or repeat any password, secret, key or code in your replies, notes or anywhere except the exact field named below. Whenever a password or secret must be created, copied or entered, STOP and ask me to do it myself in that field, then wait for my "done".
- Never enter payment details, buy or upgrade anything, create a new website, or delete anything.
- In Hostinger's environment variables, change only the rows named below; leave every other row exactly as it is.
- If a page looks different from these steps, asks for payment or identity verification, or you are unsure, stop and ask me.
- After each part, tell me in one or two lines what you did and saw (without secrets).

PART A — Read the database details (fixes "refused the user name or password")
1. Open https://coral-seahorse-181020.hostingersite.com/api/health and tell me what it says. If it already says "database":"ok", skip Parts A and B.
2. If it shows a "login_check" part, tell me db_user_used, db_name_used, db_host_used and password_length (these are not secrets).
3. Open hPanel → Websites → coral-seahorse-181020.hostingersite.com → Databases → Management (or type "Databases" in hPanel's search).
4. Tell me the FULL database name and FULL username exactly as listed (they start with u381419490_), and the MySQL host if one is shown. If there is no database, STOP and tell me.
5. Compare them with db_name_used and db_user_used from step 2 and tell me whether they match letter for letter.

PART B — New database password, and put the details into the app
1. In the database list, open the menu (⋮ or "Change password") for that database user.
2. STOP and say: "Please type a new password for the database user — letters and numbers only, at least 16 characters, no symbols or spaces — save it in your password manager, and reply done." Wait, then save.
3. Open hPanel → Websites → coral-seahorse-181020.hostingersite.com → the Node.js app → Settings / "Settings and redeploy" → Environment variables. Set ONLY:
   - DB_NAME = the full database name from Part A (copy exactly)
   - DB_USER = the full username from Part A (copy exactly; NOT my Hostinger login email)
   - DB_HOST = localhost
   - DB_PORT = 3306
   - DB_PASSWORD = STOP and say: "Please type the new database password into the DB_PASSWORD value and reply done." Wait.
   - NEXT_PUBLIC_SITE_URL = https://coral-seahorse-181020.hostingersite.com (if not already)
4. Do NOT redeploy yet — continue with Part C (one redeploy at the end saves time).

PART C — Email for order emails, invoices, account confirmation and password reset
1. In hPanel, check whether I own a domain with email (hPanel → Emails). Tell me what you find.
2. IF I have a domain with Hostinger Email:
   a. Create a mailbox orders@<my domain>. STOP and ask me to type its password myself and reply done.
   b. In the Node.js app's environment variables set: EMAIL_FROM = UNAR <orders@<my domain>>, SMTP_HOST = smtp.hostinger.com, SMTP_PORT = 465, SMTP_USER = orders@<my domain>. For SMTP_PASSWORD, STOP and ask me to type the mailbox password into it and reply done.
3. IF I have no domain (only the temporary hostingersite.com address): a Hostinger mailbox isn't possible yet, so use my Gmail instead:
   a. Open https://myaccount.google.com/security and tell me whether 2-Step Verification is on. If it is off, STOP and ask me to turn it on myself.
   b. Open https://myaccount.google.com/apppasswords. STOP and say: "Please create an app password named 'UNAR shop', keep the page open, and reply done." Wait.
   c. In the Node.js app's environment variables set: EMAIL_FROM = UNAR <the Gmail address I use for the shop>, SMTP_HOST = smtp.gmail.com, SMTP_PORT = 465, SMTP_USER = that Gmail address. For SMTP_PASSWORD, STOP and say: "Please copy the 16-letter app password into SMTP_PASSWORD (without spaces) and reply done." Wait.
4. Leave RESEND_API_KEY as it is.

PART D — "Continue with Google" sign-in
1. Open https://console.cloud.google.com. Create a project named "UNAR shop" (or select it if it exists). If Google asks for billing or payment, STOP and tell me.
2. Go to APIs & Services → OAuth consent screen (it may be called "Google Auth Platform → Branding/Audience"). Choose External. App name: UNAR. User support email and developer contact: my Gmail address. Save. Under Audience/Publishing status, choose "Publish app" / "In production" (only the basic profile and email permissions are used, so no Google review should be needed — if Google says verification is required, tell me and continue).
3. Go to APIs & Services → Credentials → Create credentials → OAuth client ID → Application type: Web application → Name: UNAR website.
   - Authorised JavaScript origins: https://coral-seahorse-181020.hostingersite.com
   - Authorised redirect URIs: https://coral-seahorse-181020.hostingersite.com/auth/google/callback
   - Click Create. If Google refuses the hostingersite.com address, STOP and tell me the exact message (Google sign-in will then wait until my own domain is connected) and skip to Part E.
4. Copy the Client ID (it ends in .apps.googleusercontent.com — not a secret) into the Node.js app's environment variable GOOGLE_CLIENT_ID.
5. For GOOGLE_CLIENT_SECRET, STOP and say: "Please copy the Client secret from Google into GOOGLE_CLIENT_SECRET and reply done." Wait.
6. If the environment variables list has no rows for PHONEPE_CLIENT_ID, PHONEPE_CLIENT_SECRET, PHONEPE_ENV, PHONEPE_WEBHOOK_USERNAME, PHONEPE_WEBHOOK_PASSWORD, add each with the value none, and PHONEPE_CLIENT_VERSION with the value 1.

PART E — Redeploy and check
1. Check the branch is claude/gifted-dirac-rkndzu and the Node version is 22.x. Click "Save and redeploy" and wait until it finishes. If it fails, tell me the last 20 lines of the build log (no secrets in them).
2. Open https://coral-seahorse-181020.hostingersite.com/api/health and tell me exactly what it says.
   - "database":"ok" → continue.
   - Still "refused the user name or password": go back to the environment variables, change ONLY DB_HOST to 127.0.0.1, Save and redeploy, check again. If it still fails and Part A showed a different MySQL host, try that host the same way. If it still fails, stop and tell me the full /api/health text.
   - "email" should say "smtp" and "google_sign_in" should say "set up".
3. Open https://coral-seahorse-181020.hostingersite.com and tell me whether both products appear under "Shop the Goodness" (they say "Sold out" until stock is entered — that's expected).
4. Open https://coral-seahorse-181020.hostingersite.com/login and tell me whether a "Continue with Google" button is shown.

PART F — Stop here
Tell me everything is ready. I will open /setup myself to create my owner account (it asks for my SETUP_KEY), then enter stock, shipping charges and my UPI ID in the dashboard.
