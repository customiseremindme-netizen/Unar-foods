Task: connect automatic WhatsApp order updates for my UNAR online shop (https://coral-seahorse-181020.hostingersite.com), using Meta's official WhatsApp Cloud API. Use my Chrome, where I am signed in to Facebook / Meta Business (business.facebook.com, developers.facebook.com), Hostinger (hpanel.hostinger.com) and my shop's dashboard. Work through Parts A–G in order.

Ground rules — follow these strictly:
- Never type, show, summarise or repeat any password, access token, secret or verification code in your replies, notes or anywhere except the exact field named below. Whenever one must be created, copied or entered, STOP and ask me to do it myself, then wait for my "done".
- Never enter payment or card details, buy anything, or accept paid plans. If Meta asks for a payment method, business verification, ID documents or a phone call, STOP and tell me exactly what it asks.
- Never delete anything, and never remove or change an existing WhatsApp number, app or user.
- In Hostinger's environment variables, add or change ONLY the two rows named below; leave every other row exactly as it is.
- If a page looks different from these steps or you are unsure, stop and ask me.
- After each part, tell me in one or two lines what you did and saw (without secrets).

PART A — Business portfolio and app
1. Open https://business.facebook.com and tell me the name of my business portfolio (create one named "UNAR" only if none exists — ask me first).
2. Open https://developers.facebook.com/apps → Create app. Choose the use case "Connect with customers through WhatsApp" (or type "Business" if asked for an app type). App name: UNAR shop. Contact email: my email. Connect it to the UNAR business portfolio. Create. If it already exists, just open it.
3. In the app, open WhatsApp → API Setup (or "Quickstart"). Tell me what you see.

PART B — The sending phone number
1. STOP and ask me: "Which phone number should send the WhatsApp updates? It must NOT be in use in the normal WhatsApp or WhatsApp Business app (or you must delete WhatsApp from it first). Reply with 'use the number ending in XXXX'." Wait.
2. In API Setup → "Add phone number": display name UNAR (if Meta refuses, try "UNAR Foods" and tell me), category Food & Grocery, then the number I gave.
3. When Meta sends a verification code, STOP and say: "Please type the code Meta sent to your phone into the box and reply done." Wait.
4. Tell me the Phone number ID shown for this number (a long number — it is not a secret) and whether the display name is "Approved" or "Pending".

PART C — Message templates (6 templates)
Open WhatsApp Manager (business.facebook.com → WhatsApp accounts → the account → Message templates, or from the app: WhatsApp → API Setup → "Manage message templates"). Create each template below with: Category = Utility, Language = English, Header = none, Footer = none, Buttons = none. Type the body EXACTLY as written (keep {{1}} {{2}} {{3}} — every template must have all three, in this order). When Meta asks for sample values use: {{1}} = Meena, {{2}} = UNAR-1001, {{3}} = https://coral-seahorse-181020.hostingersite.com/orders/UNAR-1001

1. Name: unar_order_received
   Body: Hi {{1}}, thank you for your UNAR order {{2}}. We have received it and will keep you updated here. View your order: {{3}} . Team UNAR
2. Name: unar_payment_confirmed
   Body: Hi {{1}}, we have received your payment for UNAR order {{2}}. Your order details and invoice: {{3}} . Team UNAR
3. Name: unar_order_shipped
   Body: Hi {{1}}, your UNAR order {{2}} has been shipped. Track your parcel here: {{3}} . Team UNAR
4. Name: unar_order_delivered
   Body: Hi {{1}}, your UNAR order {{2}} has been delivered. Order details: {{3}} . Team UNAR
5. Name: unar_order_cancelled
   Body: Hi {{1}}, your UNAR order {{2}} has been cancelled. Details: {{3}} . For any questions, please contact us through our website. Team UNAR
6. Name: unar_new_order   (this one is sent to ME, the shop owner)
   Body: New UNAR order {{1}} from {{2}}. Open it in the dashboard: {{3}} . Team UNAR
   Sample values for this one: {{1}} = UNAR-1001, {{2}} = Meena Customer · ₹596 · Cash on Delivery, {{3}} = https://coral-seahorse-181020.hostingersite.com/admin/orders

Submit each one. If Meta changes the category to Marketing or rejects a template, tell me the exact reason. Then tell me the status of all six (Approved / In review / Rejected). Approval usually takes minutes to a day — continue with Part D meanwhile.

PART D — Permanent access token
1. Open https://business.facebook.com/settings → Users → System users. If a system user named "unar-shop" exists, select it; otherwise click Add, name: unar-shop, role: Admin.
2. Click "Assign assets" (Add assets): Apps → UNAR shop → Full control (Manage app). Then WhatsApp accounts → my WhatsApp account → Full control. Save.
3. Click "Generate new token" → App: UNAR shop → Token expiration: Never → permissions: whatsapp_business_messaging and whatsapp_business_management → Generate.
4. STOP and say: "Please copy the token now (it is shown only once), keep this tab open, and reply done." Wait. Do not read the token aloud or into notes.

PART E — Payment method check (do not enter anything)
Open WhatsApp Manager → the WhatsApp account → Settings / Payment settings (or Billing). Tell me whether a payment method is already added or required. If one is needed, STOP and tell me — I will add it myself. (Meta charges per business-started message; check Meta's current WhatsApp pricing.)

PART F — Put the details into the shop and redeploy
1. Open hPanel → Websites → coral-seahorse-181020.hostingersite.com → the Node.js app → Settings / "Settings and redeploy" → Environment variables.
2. Set WHATSAPP_PHONE_NUMBER_ID = the Phone number ID from Part B (copy exactly).
3. For WHATSAPP_ACCESS_TOKEN, STOP and say: "Please paste the token from Part D into the WHATSAPP_ACCESS_TOKEN value and reply done." Wait.
4. Check the branch is claude/gifted-dirac-rkndzu and Node is 22.x, click "Save and redeploy", and wait until it finishes. If it fails, tell me the last 20 lines of the build log (no secrets in them).
5. Open https://coral-seahorse-181020.hostingersite.com/admin/integrations and tell me what the "WhatsApp order updates" card shows (it should say connected; the token is shown masked).

PART G — Switch it on in the dashboard
1. Open https://coral-seahorse-181020.hostingersite.com/admin/settings → Emails section.
2. Tick "Send automatic WhatsApp order updates".
3. WhatsApp template language code: en
4. Fill the template names ONLY for templates that are Approved now (leave the others empty and tell me which — I'll add them after approval):
   - order received → unar_order_received
   - payment confirmed → unar_payment_confirmed
   - shipped → unar_order_shipped
   - delivered → unar_order_delivered
   - cancelled → unar_order_cancelled
   - new order (to you) → unar_new_order
5. STOP and ask me: "Which mobile number(s) should get a WhatsApp message for every new order? (Not the shop's sending number from Part B.)" Type my answer into "WhatsApp me about every new order", one number per line. Make sure "Email me about new orders" stays as it is.
6. Save, and tell me the message shown.
7. Stop here and tell me everything is ready. I will test it myself: place an order on the shop with my own mobile number and "Send me order updates on WhatsApp" ticked, check that both WhatsApp messages arrive (the customer one and the new-order one), then cancel that order in the dashboard.
