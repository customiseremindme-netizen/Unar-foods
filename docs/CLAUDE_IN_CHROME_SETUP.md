Task: connect my UNAR online shop (a Node.js app on Hostinger at https://seashell-donkey-270999.hostingersite.com) to a new MySQL database in the same Hostinger account, using my Chrome where I am already signed in to Hostinger.

Ground rules — follow these strictly:
- Never type, show, summarise or repeat any password or secret in your replies to me, in notes, or anywhere except the exact Hostinger field named below. Whenever a password or secret must be entered, STOP and ask me to type it myself into that field, then wait for my "done".
- Never enter payment details, upgrade a plan, or delete anything (except the old variables named in Part B).
- Do not change any Hostinger setting other than the ones listed below.
- If a page looks different from these steps, or anything asks for payment or verification, stop and ask me.
- After each part, tell me in one line that it is done and what you saw (without secrets).

PART A — Create the MySQL database
1. Open https://hpanel.hostinger.com → Websites → seashell-donkey-270999.hostingersite.com → Dashboard → Databases → Management. (If you can't find it, type "Databases" in hPanel's search box.)
2. If a database whose name ends in "_unar" already exists in the list, do not create another one — skip to step 5.
3. Under "Create a new MySQL database":
   - Database name: unar
   - Username: unar
   - Password: STOP and say: "Please type a strong new database password into the Password field, save it in your password manager, and reply done." Wait for my "done".
4. Click Create.
5. Tell me the FULL database name and FULL username exactly as shown in the list (they start with something like u123456789_). These are not secrets. Also tell me the MySQL host shown for it, if one is shown.

PART B — Put the database details into the app
1. hPanel → Websites → seashell-donkey-270999.hostingersite.com → open the Node.js app → Deployments → "Settings and redeploy" → Environment variables.
2. Edit ONLY these rows (leave every other variable exactly as it is):
   - DB_HOST = localhost
   - DB_PORT = 3306
   - DB_NAME = the full database name from Part A
   - DB_USER = the full username from Part A
   - DB_PASSWORD = STOP and say: "Please type the database password into the DB_PASSWORD value and reply done." Wait.
   - SETUP_KEY: look at its value WITHOUT telling me what it is. If it is "none", empty, or starts with "PASTE_", STOP and say: "Please type your own secret phrase (at least 12 characters, saved in your password manager) into the SETUP_KEY value and reply done." Wait.
   - CRON_SECRET: same check as SETUP_KEY. If it is "none", empty, or starts with "PASTE_", STOP and say: "Please type a long random password (40+ characters, saved in your password manager) into the CRON_SECRET value and reply done." Wait.
   If you see old rows named NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY, delete those three rows.
3. Make sure "Node version" is 22.x and the branch is claude/gifted-dirac-rkndzu.
4. Click "Save and redeploy" and wait until the deployment finishes. If it fails, open the build log and tell me the last 20 lines (they contain no secrets).

PART C — Check it worked
1. Open https://seashell-donkey-270999.hostingersite.com/api/health (the first load can take a few seconds) and tell me exactly what it says.
2. Success looks like: "ok":true and "database":"ok".
3. If it says "not configured": read the "database_settings" part. Every DB_ setting should say "set". For any that says "none", "missing" or "still the PASTE_ template text", go back to Part B, fix that row (asking me to type it if it's DB_PASSWORD), Save and redeploy, and check again.
4. If it says "unreachable" and Part A showed a MySQL host other than localhost: set DB_HOST to that host, Save and redeploy, then check again.
5. If it says the database "refused the user name or password": STOP and ask me to re-type DB_PASSWORD (and check DB_USER is the full username with the u123456789_ prefix), then Save and redeploy and check again.
6. If "setup_key" does not say "set", tell me what it says (it never shows the key itself).
7. Open https://seashell-donkey-270999.hostingersite.com and tell me whether you see the full UNAR homepage.

Then stop. I will open /setup myself to create my owner account (it asks for the SETUP_KEY), and publish products from the dashboard.
