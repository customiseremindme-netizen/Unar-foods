/** How an order was paid, in plain words (safe to use in the browser too). */
export function paymentMethodLabel(method: string): string {
  switch (method) {
    case "cod":
      return "Cash on Delivery";
    case "razorpay":
      return "Online (Razorpay)";
    case "phonepe":
      return "Online (PhonePe)";
    case "upi_manual":
      return "UPI";
    default:
      return method;
  }
}
