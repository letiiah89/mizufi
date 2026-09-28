import { activateLifetimeVip } from "../../../finance-store";
import { verifyStripeWebhook } from "../../../stripe";

type CheckoutEvent = {
  id: string;
  type: string;
  livemode?: boolean;
  data?: { object?: {
    client_reference_id?: string;
    payment_intent?: string;
    payment_status?: string;
    amount_total?: number;
    currency?: string;
    metadata?: Record<string, string>;
  } };
};

export async function POST(request: Request) {
  const payload = await request.text();
  if (!await verifyStripeWebhook(payload, request.headers.get("stripe-signature"))) {
    return Response.json({ error: "Firma no válida" }, { status: 400 });
  }
  const event = JSON.parse(payload) as CheckoutEvent;
  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const userId = session?.metadata?.user_id ?? session?.client_reference_id;
    if (
      session?.payment_status === "paid" &&
      userId &&
      session.amount_total === 499 &&
      session.currency?.toLowerCase() === "eur"
    ) {
      await activateLifetimeVip({
        stripeEventId: event.id,
        userId,
        paymentIntentId: session.payment_intent,
        amount: session.amount_total,
        currency: session.currency,
        livemode: event.livemode === true,
      });
    }
  }
  return Response.json({ received: true });
}
