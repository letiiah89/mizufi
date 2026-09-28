import { getMizufiUser } from "../../supabase-server";
import { recordMonetizationClick } from "../../finance-store";

const allowedTypes = new Set(["ad_click", "affiliate_click"]);

export async function POST(request: Request) {
  const user = await getMizufiUser(request);
  if (!user) return Response.json({ error: "Inicio de sesión necesario" }, { status: 401 });

  const body = (await request.json()) as {
    type?: string;
    placement?: string;
    partner?: string;
  };
  if (!body.type || !allowedTypes.has(body.type) || !body.placement) {
    return Response.json({ error: "Evento no válido" }, { status: 400 });
  }
  if (body.placement.length > 80 || (body.partner?.length ?? 0) > 80) {
    return Response.json({ error: "Evento no válido" }, { status: 400 });
  }

  await recordMonetizationClick(
    user.id,
    body.type as "ad_click" | "affiliate_click",
    body.placement,
    body.partner,
  );
  return Response.json({ recorded: true });
}
