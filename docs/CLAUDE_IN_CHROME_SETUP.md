Task: connect my UNAR online shop (hosted on Hostinger) to a new Supabase database, using my Chrome where I am already signed in to GitHub and Hostinger.

Ground rules — follow these strictly:
- Never type, show, summarise or repeat any key, password or secret in your replies to me, in notes, or anywhere except the exact Hostinger setting named below.
- Use only the free Supabase plan. Never enter payment details, upgrade a plan, or delete anything.
- Do not change any Hostinger setting other than the ones listed in Part C.
- If a page looks different from these steps, or anything asks for payment or verification, stop and ask me.
- After each part, tell me in one line that it is done and what you saw (without secrets).

PART A — Create the Supabase project
1. Open https://supabase.com/dashboard . If not signed in, choose "Continue with GitHub" and let me approve.
2. Click "New project". If asked for an organization, use my personal/free one.
3. Project name: unar-shop
4. Database password: click "Generate a password". Then STOP and tell me: "Please save the database password shown on screen in your password manager, then reply OK." Wait for my OK.
5. Region: South Asia (Mumbai). Keep the Free plan. Click "Create new project".
6. Wait until the project dashboard has finished setting up (1–3 minutes).

PART B — Create the database tables (run once only)
1. In a new tab open:
   https://github.com/customiseremindme-netizen/Unar-foods/blob/claude/gifted-dirac-rkndzu/supabase/setup/all-migrations.sql
2. Click the "Copy raw file" button (two overlapping squares icon above the code).
3. Back in Supabase, open "SQL Editor" in the left menu → "New query".
4. Click into the editor and paste (Ctrl+V). Check the editor now holds a long script starting with "-- UNAR — complete database setup".
5. Click "Run". If Supabase warns about destructive operations, confirm the run.
6. Confirm the result says "Success. No rows returned". If there is any error, stop and tell me the error text. Do NOT run it a second time.

PART C — Put the database details into Hostinger
1. In Supabase, open Project Settings (gear icon) → "API Keys". If no publishable/secret keys exist yet, click "Create new API keys".
2. Find these three values (the Project URL is under the "Connect" button at the top, or Project Settings → Data API):
   - Project URL (looks like https://xxxx.supabase.co)
   - Publishable key (starts with sb_publishable_)
   - Secret key (starts with sb_secret_ — click Reveal/Copy)
3. Open https://hpanel.hostinger.com → Websites → my Node.js app for the UNAR site (its address ends in .hostingersite.com) → Deployments → "Settings and redeploy".
4. In "Environment variables", set ONLY these (edit the existing rows):
   - NEXT_PUBLIC_SUPABASE_URL = the Project URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = the Publishable key
   - SUPABASE_SECRET_KEY = the Secret key
   - NEXT_PUBLIC_SITE_URL = none
   Leave all other variables exactly as they are.
5. Make sure "Node version" is 22.x (change it if it shows 20.x).
6. Click "Save and redeploy" and wait until the deployment finishes. If it fails, open the build log and tell me the last 20 lines (they contain no secrets).

PART D — Check it worked
1. Open the site address Hostinger shows for the app, adding /api/health at the end
   (example: https://something.hostingersite.com/api/health).
2. Tell me exactly what that page says. Success looks like: "ok":true and "database":"ok".
3. Then open the site's homepage and tell me whether you see the full UNAR homepage (large hero section with the Banana Chewy packs) instead of a plain "UNAR — One Healthy Habit a Day" page.

Then stop. I will do the next steps (creating my owner account and publishing products) myself.
