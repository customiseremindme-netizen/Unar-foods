// Test double for https://checkout.razorpay.com/v1/checkout.js (LOCAL TESTS ONLY).
(function () {
  function Razorpay(opts) { this.opts = opts; this.handlers = {}; }
  Razorpay.prototype.on = function (ev, fn) { this.handlers[ev] = fn; };
  Razorpay.prototype.open = async function () {
    var mode = window.localStorage.getItem("rzpMode") || "success";
    var pid = "pay_" + this.opts.order_id.slice(6);
    if (mode === "fail") { this.handlers["payment.failed"] && this.handlers["payment.failed"]({ error: { description: "Card declined (mock)" } }); this.opts.modal.ondismiss(); return; }
    if (mode === "dismiss") { this.opts.modal.ondismiss(); return; }
    var sigKey = mode === "tamper" ? "wrong_secret" : window.__RZP_TEST_SECRET__ || "local_mock_secret_123";
    var key = await crypto.subtle.importKey("raw", new TextEncoder().encode(sigKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    var sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(this.opts.order_id + "|" + pid));
    var hex = Array.from(new Uint8Array(sig)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    this.opts.handler({ razorpay_payment_id: pid, razorpay_order_id: this.opts.order_id, razorpay_signature: hex });
  };
  window.Razorpay = Razorpay;
})();
