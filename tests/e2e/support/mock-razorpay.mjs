// Minimal local stand-in for the Razorpay REST API — used ONLY by the
// automated tests (point RAZORPAY_API_BASE_URL at it). Never used in production.
import http from "node:http";
import crypto from "node:crypto";
const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "rzp_test_localmock01";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "local_mock_secret_123";
const orders = new Map();
const payments = new Map();
let scenario = "captured"; // captured | authorized | failed
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
