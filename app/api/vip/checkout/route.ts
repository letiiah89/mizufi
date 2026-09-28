import { BETA_ADMIN_EMAIL, getAccountPlan, getVipPurchaseCount } from "../../../finance-store";
import { getMizufiUser } from "../../../supabase-server";
import { createVipCheckout, stripeIsTestMode } from "../../../stripe";

export async function POST(request: Request) {
  const user = await getMizufiUser(request);
  if (!user) return Response.json({ error: "Inicio de sesión necesario" }, { status: 401 });
  const body = await request.json().catch(() => null) as { acceptedTerms?: boolean } | null;
  if (body?.acceptedTerms !== true) {
    return Response.json({ error: "Debes aceptar las condiciones de compra" }, { status: 400 });
  }
  if (stripeIsTestMode() && user.email.toLowerCase() !== BETA_ADMIN_EMAIL) {
    return Response.json({ error: "El pago estará disponible muy pronto" }, { status: 503 });
  }
  const account = await getAccountPlan(user.id);
  if (account.plan === "vip" && account.status === "active") {
    return Response.json({ error: "Tu cuenta ya es VIP" }, { status: 409 });
  }
  if (await getVipPurchaseCount() >= 100) {
    return Response.json({ error: "La oferta fundadora ha terminado" }, { status: 409 });
  }
  try {
    const origin = new URL(request.url).origin;
    return Response.json({ url: await createVipCheckout({ userId: user.id, email: user.email, origin }) });
  } catch (error) {
    console.error("Unable to create Stripe Checkout Session", error);
    return Response.json({ error: "El pago todavía no está disponible" }, { status: 503 });
  }
}
