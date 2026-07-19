import { createHmac, timingSafeEqual } from "node:crypto";

const API_VERSION = "2026-02-25.clover";
const PRODUCTS = {
  "cinematic-storyboard": { name: "Cinematic Storyboard Director", amount: 89900, creator: "Mira Chen" },
  "product-spec": { name: "Production Feature Spec", amount: 149900, creator: "DevFoundry" },
};

export function createStripeProvider() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  const request = async (path, body) => {
    const response = await fetch(`https://api.stripe.com${path}`, { method: "POST", headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/x-www-form-urlencoded", "Stripe-Version": API_VERSION }, body: new URLSearchParams(body) });
    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload?.error?.message || "Stripe request failed."), { status: response.status });
    return payload;
  };
  return {
    name: "stripe",
    apiVersion: API_VERSION,
    product(assetId) { return PRODUCTS[assetId] || null; },
    async createCheckout({ assetId, customerEmail, userId, successUrl, cancelUrl }) {
      const product = PRODUCTS[assetId];
      if (!product) throw Object.assign(new Error("Paid product is unavailable."), { status: 404 });
      return request("/v1/checkout/sessions", {
        mode: "payment", success_url: successUrl, cancel_url: cancelUrl,
        "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "inr",
        "line_items[0][price_data][unit_amount]": String(product.amount),
        "line_items[0][price_data][product_data][name]": product.name,
        client_reference_id: userId,
        "metadata[user_id]": userId, "metadata[asset_id]": assetId,
        "metadata[title]": product.name, "metadata[creator]": product.creator,
        ...(customerEmail ? { customer_email: customerEmail } : {}),
      });
    },
    verifyWebhook(rawBody, signatureHeader) {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret || !signatureHeader) return null;
      const values = Object.fromEntries(signatureHeader.split(",").map((part) => part.split("=")));
      if (!values.t || !values.v1 || Math.abs(Date.now() / 1000 - Number(values.t)) > 300) return null;
      const expected = createHmac("sha256", secret).update(`${values.t}.${rawBody}`).digest("hex");
      const a = Buffer.from(expected); const b = Buffer.from(values.v1);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
      return JSON.parse(rawBody);
    },
  };
}
