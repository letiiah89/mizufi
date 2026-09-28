import { env } from "cloudflare:workers";

const stripeEnv = () => env as unknown as Record<string, string | undefined>;

export function stripeConfig() {
  const values = stripeEnv();
  return {
    secretKey: values.STRIPE_SECRET_KEY,
    webhookSecret: values.STRIPE_WEBHOOK_SECRET,
    priceId: values.STRIPE_PRICE_ID ?? "price_1UFW8OColFC5jNk3fo6inqJP",
  };
}

export function stripeIsTestMode() {
  const { secretKey } = stripeConfig();
  return Boolean(secretKey?.startsWith("rk_test_") || secretKey?.startsWith("sk_test_"));
}

export async function createVipCheckout(input: { userId: string; email: string; origin: string }) {
  const { secretKey, priceId } = stripeConfig();
  if (!secretKey) throw new Error("Stripe no está configurado");

  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    customer_email: input.email,
    client_reference_id: input.userId,
    "metadata[user_id]": input.userId,
    "metadata[email]": input.email,
    success_url: `${input.origin}/?vip=success`,
    cancel_url: `${input.origin}/?vip=cancelled`,
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const result = await response.json() as { url?: string; error?: { message?: string } };
  if (!response.ok || !result.url) throw new Error(result.error?.message ?? "No se ha podido abrir el pago");
  return result.url;
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyStripeWebhook(payload: string, signatureHeader: string | null) {
  const { webhookSecret } = stripeConfig();
  if (!webhookSecret || !signatureHeader) return false;
  const values = Object.fromEntries(signatureHeader.split(",").map((part) => part.split("=", 2)));
  const timestamp = values.t;
  const signature = values.v1;
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  return safeEqual(hex(digest), signature);
}
