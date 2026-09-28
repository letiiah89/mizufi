import { createFinanceSpace, inviteToFinanceSpace, listFinanceSpaces, removeFinanceSpace, updateFinanceSpace } from "../../finance-store";
import { getMizufiUser } from "../../supabase-server";

export async function GET(request: Request) {
  const user = await getMizufiUser(request);
  if (!user) return Response.json({ error: "Inicio de sesión necesario" }, { status: 401 });
  return Response.json({ spaces: await listFinanceSpaces(user) });
}

export async function POST(request: Request) {
  const user = await getMizufiUser(request);
  if (!user) return Response.json({ error: "Inicio de sesión necesario" }, { status: 401 });
  const body = await request.json() as { action?: string; name?: string; kind?: string; spaceId?: string; email?: string; role?: string };
  try {
    if (body.action === "invite") {
      await inviteToFinanceSpace(user, {
        spaceId: body.spaceId ?? "",
        email: body.email ?? "",
        role: body.role === "viewer" ? "viewer" : "editor",
      });
      return Response.json({ invited: true, spaces: await listFinanceSpaces(user) });
    }
    if (body.action === "update") {
      const kind = body.kind === "demo" || body.kind === "shared" ? body.kind : "personal";
      await updateFinanceSpace(user, { spaceId: body.spaceId ?? "", name: body.name ?? "", kind });
      return Response.json({ updated: true, spaces: await listFinanceSpaces(user) });
    }
    if (body.action === "delete") {
      const result = await removeFinanceSpace(user, body.spaceId ?? "");
      return Response.json({ result, spaces: await listFinanceSpaces(user) });
    }
    const kind = body.kind === "demo" || body.kind === "shared" ? body.kind : "personal";
    const id = await createFinanceSpace(user, { name: body.name ?? "", kind });
    return Response.json({ id, spaces: await listFinanceSpaces(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "SPACE_NAME_REQUIRED") return Response.json({ error: "Escribe un nombre para el espacio" }, { status: 400 });
    if (message === "INVALID_INVITATION") return Response.json({ error: "Revisa el correo de la invitación" }, { status: 400 });
    if (message === "SPACE_NOT_OWNED") return Response.json({ error: "Solo la persona propietaria puede invitar" }, { status: 403 });
    if (message === "LAST_PERSONAL_SPACE") return Response.json({ error: "No puedes eliminar tu único espacio personal. Crea otro espacio personal primero." }, { status: 400 });
    if (message === "SPACE_NOT_FOUND") return Response.json({ error: "Este espacio ya no está disponible" }, { status: 404 });
    return Response.json({ error: "No se ha podido completar la operación" }, { status: 500 });
  }
}
