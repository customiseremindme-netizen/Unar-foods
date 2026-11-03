// Minimal local stand-ins for outside services — used ONLY by the automated
// tests, never in production:
// - Razorpay REST API (RAZORPAY_API_BASE_URL=http://127.0.0.1:4010/v1)
// - Google sign-in (GOOGLE_OAUTH_BASE_URL=http://127.0.0.1:4010/google)
// - PhonePe Payment Gateway (PHONEPE_API_BASE_URL=http://127.0.0.1:4010/phonepe)
import http from "node:http";
import crypto from "node:crypto";
const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "rzp_test_localmock01";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "local_mock_secret_123";
const orders = new Map();
const payments = new Map();
let scenario = "captured"; // captured | authorized | failed
// Google sign-in: the next person who "chooses an account" (set by the test).
let googleUser = { sub: "100000000000000000001", email: "google.user@example.com", name: "Google User", email_verified: true };
const googleCodes = new Map();
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "local_google_secret";
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
// PhonePe: what the customer does on the payment page (success | fail | abandon | tamper).
let phonepeScenario = "success";
const phonepeOrders = new Map();
const PHONEPE_ID = process.env.PHONEPE_CLIENT_ID ?? "TEST_PHONEPE_CLIENT";
const PHONEPE_SECRET = process.env.PHONEPE_CLIENT_SECRET ?? "local_phonepe_secret";
const phonepeTokens = new Set();
const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
const rand = (n) => crypto.randomBytes(n).toString("hex").slice(0, n);
function paymentFor(order) {
  const id = "pay_" + order.id.slice(6);
  if (!payments.has(id)) payments.set(id, { id, entity: "payment", order_id: order.id, amount: order.amount, currency: "INR", status: scenario, captured: scenario === "captured", method: "upi", email: "priya.test@example.com", contact: "+919876543210", created_at: Math.floor(Date.now() / 1000), error_code: scenario === "failed" ? "BAD_REQUEST_ERROR" : null, error_description: scenario === "failed" ? "Payment failed (mock)" : null });
  return payments.get(id);
}
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (p === "/__scenario") { scenario = JSON.parse(body).status; return json(res, 200, { scenario }); }
    if (p === "/__state") return json(res, 200, { orders: [...orders.values()], payments: [...payments.values()] });
    if (p === "/__phonepe") { phonepeScenario = JSON.parse(body).scenario; return json(res, 200, { phonepeScenario }); }
    if (p === "/__phonepe_state") return json(res, 200, { orders: [...phonepeOrders.values()] });
    if (p.startsWith("/phonepe/")) {
      const pp = p.slice("/phonepe".length);
      if (pp === "/v1/oauth/token" && req.method === "POST") {
        const f = new URLSearchParams(body);
        if (f.get("client_id") !== PHONEPE_ID || f.get("client_secret") !== PHONEPE_SECRET || f.get("grant_type") !== "client_credentials") return json(res, 401, { code: "UNAUTHORIZED", message: "Bad client credentials" });
        const token = rand(24);
        phonepeTokens.add(token);
        return json(res, 200, { access_token: token, token_type: "O-Bearer", expires_at: Math.floor(Date.now() / 1000) + 3600 });
      }
      if (pp === "/pay-page") {
        // The customer's visit to PhonePe's payment page.
        const o = phonepeOrders.get(url.searchParams.get("m"));
        if (!o) return json(res, 404, { message: "unknown order" });
        if (phonepeScenario === "success" || phonepeScenario === "tamper") {
          o.state = "COMPLETED";
          o.paidAmount = phonepeScenario === "tamper" ? o.amount - 100 : o.amount;
          o.transactionId = "T" + rand(18);
        } else if (phonepeScenario === "fail") o.state = "FAILED";
        res.writeHead(302, { Location: o.redirectUrl });
        return res.end();
      }
      if ((req.headers.authorization ?? "").replace("O-Bearer ", "") === "" || !phonepeTokens.has((req.headers.authorization ?? "").replace("O-Bearer ", ""))) {
        return json(res, 401, { code: "UNAUTHORIZED", message: "Invalid token" });
      }
      if (pp === "/checkout/v2/pay" && req.method === "POST") {
        const b = JSON.parse(body);
        if (phonepeOrders.has(b.merchantOrderId)) return json(res, 400, { code: "DUPLICATE", message: "merchantOrderId already used" });
        const o = { merchantOrderId: b.merchantOrderId, orderId: "OMO" + rand(16), amount: b.amount, state: "PENDING", redirectUrl: b.paymentFlow.merchantUrls.redirectUrl };
        phonepeOrders.set(b.merchantOrderId, o);
        return json(res, 200, { orderId: o.orderId, state: "PENDING", expireAt: Date.now() + b.expireAfter * 1000, redirectUrl: `http://127.0.0.1:4010/phonepe/pay-page?m=${encodeURIComponent(b.merchantOrderId)}` });
      }
      let mm;
      if (req.method === "GET" && (mm = pp.match(/^\/checkout\/v2\/order\/([^/]+)\/status$/))) {
        const o = phonepeOrders.get(decodeURIComponent(mm[1]));
        if (!o) return json(res, 404, { code: "ORDER_NOT_FOUND", message: "not found" });
        const amount = o.state === "COMPLETED" ? o.paidAmount : o.amount;
        return json(res, 200, { orderId: o.orderId, state: o.state, amount, paymentDetails: o.state === "PENDING" ? [] : [{ paymentMode: "UPI_QR", transactionId: o.transactionId ?? "TFAILED" + rand(8), amount, state: o.state }] });
      }
      if (pp === "/payments/v2/refund" && req.method === "POST") {
        const b = JSON.parse(body);
        const o = phonepeOrders.get(b.originalMerchantOrderId);
        if (!o || o.state !== "COMPLETED") return json(res, 400, { code: "INVALID", message: "Order not refundable" });
        return json(res, 200, { refundId: "OMR" + rand(16), amount: b.amount, state: "PENDING" });
      }
      return json(res, 404, { message: `mock phonepe: no route ${req.method} ${pp}` });
    }
    if (p === "/__google") { googleUser = { ...googleUser, ...JSON.parse(body) }; return json(res, 200, googleUser); }
    if (p === "/google/auth") {
      // Pretend the person picked their Google account: go straight back with a one-time code.
      const code = rand(20);
      googleCodes.set(code, { user: googleUser, nonce: url.searchParams.get("nonce"), clientId: url.searchParams.get("client_id"), challenge: url.searchParams.get("code_challenge"), redirect: url.searchParams.get("redirect_uri") });
      const back = new URL(url.searchParams.get("redirect_uri"));
      back.searchParams.set("code", code);
      back.searchParams.set("state", url.searchParams.get("state") ?? "");
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }
    if (p === "/google/token" && req.method === "POST") {
      const f = new URLSearchParams(body);
      const entry = googleCodes.get(f.get("code"));
      googleCodes.delete(f.get("code"));
      const challenge = crypto.createHash("sha256").update(f.get("code_verifier") ?? "").digest("base64url");
      if (!entry || f.get("client_secret") !== GOOGLE_SECRET || f.get("client_id") !== entry.clientId || challenge !== entry.challenge || f.get("redirect_uri") !== entry.redirect) {
        return json(res, 400, { error: "invalid_grant" });
      }
      const now = Math.floor(Date.now() / 1000);
      const claims = { iss: "http://127.0.0.1:4010", aud: entry.clientId, sub: entry.user.sub, email: entry.user.email, email_verified: entry.user.email_verified, name: entry.user.name, nonce: entry.nonce, iat: now, exp: now + 300 };
      return json(res, 200, { access_token: rand(20), id_token: `${b64url({ alg: "RS256" })}.${b64url(claims)}.mock-signature`, token_type: "Bearer", expires_in: 3599 });
    }
    const auth = Buffer.from((req.headers.authorization ?? "").replace("Basic ", ""), "base64").toString();
    if (auth !== `${KEY_ID}:${KEY_SECRET}`) return json(res, 401, { error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" } });
    let m;
    if (req.method === "POST" && p === "/v1/orders") {
      const b = JSON.parse(body);
      const o = { id: "order_" + rand(14), entity: "order", amount: b.amount, amount_paid: 0, currency: b.currency, receipt: b.receipt, notes: b.notes, status: "created", created_at: Math.floor(Date.now() / 1000) };
      orders.set(o.id, o);
      return json(res, 200, o);
    }
    if (req.method === "GET" && (m = p.match(/^\/v1\/payments\/(pay_\w+)$/))) {
      const order = orders.get("order_" + m[1].slice(4));
      if (!order) return json(res, 404, { error: { code: "BAD_REQUEST_ERROR", description: "The id provided does not exist" } });
      return json(res, 200, paymentFor(order));
    }
    if (req.method === "GET" && (m = p.match(/^\/v1\/orders\/(order_\w+)\/payments$/))) {
      const order = orders.get(m[1]);
      if (!order) return json(res, 404, { error: { description: "not found" } });
      const pid = "pay_" + order.id.slice(6);
      return json(res, 200, { entity: "collection", count: payments.has(pid) ? 1 : 0, items: payments.has(pid) ? [payments.get(pid)] : [] });
    }
    if (req.method === "POST" && (m = p.match(/^\/v1\/payments\/(pay_\w+)\/capture$/))) {
      const pay = payments.get(m[1]);
      if (!pay) return json(res, 404, { error: { description: "not found" } });
      pay.status = "captured"; pay.captured = true;
      return json(res, 200, pay);
    }
    if (req.method === "POST" && (m = p.match(/^\/v1\/payments\/(pay_\w+)\/refund$/))) {
      const b = JSON.parse(body);
      return json(res, 200, { id: "rfnd_" + rand(14), entity: "refund", amount: b.amount, payment_id: m[1], currency: "INR", status: "processed", created_at: Math.floor(Date.now() / 1000) });
    }
    json(res, 404, { error: { description: `mock: no route ${req.method} ${p}` } });
  });
}).listen(Number(process.env.MOCK_RAZORPAY_PORT ?? 4010), "127.0.0.1", () => console.log("mock razorpay on :4010"));
