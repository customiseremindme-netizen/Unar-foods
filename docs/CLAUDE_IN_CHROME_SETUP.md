Task: connect my UNAR online shop (a Node.js app on Hostinger) to a new MySQL database in the same Hostinger account, using my Chrome where I am already signed in to Hostinger.

Ground rules — follow these strictly:
- Never type, show, summarise or repeat any password or secret in your replies to me, in notes, or anywhere except the exact Hostinger field named below. Whenever a password or secret must be entered, STOP and ask me to type it myself into that field, then wait for my "done".
- Never enter payment details, upgrade a plan, or delete anything.
- Do not change any Hostinger setting other than the ones listed below.
- If a page looks different from these steps, or anything asks for payment or verification, stop and ask me.
- After each part, tell me in one line that it is done and what you saw (without secrets).

PART A — Create the MySQL database
1. Open https://hpanel.hostinger.com → Websites → the website that holds my UNAR Node.js app → Databases (it may be called "Databases → Management").
2. Under "Create a new MySQL database":
   - Database name: unar
   - Username: unar
   - Password: STOP and say: "Please type a strong new database password into the Password field, save it in your password manager, and reply done." Wait for my "done".
3. Click Create.
4. In the list of databases, tell me the FULL database name and FULL username exactly as shown (they start with something like u123456789_). These are not secrets. Also tell me the MySQL host shown for it, if one is shown.

PART B — Put the database details into the app
1. hPanel → Websites → my Node.js app for the UNAR site (its address ends in .hostingersite.com, or my own domain) → Deployments → "Settings and redeploy".
2. In "Environment variables", add or edit ONLY these rows (if a row already exists, edit it; leave every other variable exactly as it is):
   - DB_HOST = localhost
   - DB_PORT = 3306
   - DB_NAME = the full database name from Part A
   - DB_USER = the full username from Part A
   - DB_PASSWORD = STOP and say: "Please type the database password into the DB_PASSWORD value and reply done." Wait.
   - SETUP_KEY = STOP and say: "Please make up a long secret phrase (at least 12 characters, e.g. four random words), save it in your password manager, type it into the SETUP_KEY value and reply done." Wait.
   - NEXT_PUBLIC_SITE_URL = none (unless it already holds my real https:// domain — then leave it)
   If you see old rows named NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY, delete those three rows (they are no longer used).
3. Make sure "Node version" is 22.x (change it if it shows 20.x).
4. Click "Save and redeploy" and wait until the deployment finishes. If it fails, open the build log and tell me the last 20 lines (they contain no secrets).

PART C — Check it worked
1. Open the app's address with /api/health at the end (example: https://something.hostingersite.com/api/health). The first load can take a few seconds.
2. Tell me exactly what that page says. Success looks like: "ok":true and "database":"ok".
3. If it says "unreachable" and Part A showed a MySQL host other than localhost: go back to Part B, set DB_HOST to that host, Save and redeploy, then check again. If it says anything else that is not ok, tell me the full text and stop.
4. Open the site's homepage and tell me whether you see the full UNAR homepage.

Then stop. I will open /setup myself to create my owner account (it asks for the SETUP_KEY), and publish products from the dashboard.
