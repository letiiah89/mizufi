import { deleteSupabaseUser } from "../../supabase-admin";
import { getMizufiUser } from "../../supabase-server";
import { deleteFinanceState, deleteMizufiAccount, loadFinanceState, saveFinanceState } from "../../finance-store";

type FinancePayload = {
  accounts: unknown[];
  movements: unknown[];
  programs: unknown[];
  preferences?: {
    period?: string;
    cycleStartDay?: number;
  };
};

export async function GET(request: Request) {
  const user = await getMizufiUser(request);
  if (!user) return Response.json({ error: "Inicio de sesión necesario" }, { status: 401 });
  const spaceId = request.headers.get("x-mizufi-space-id");
  try {
    return Response.json(await loadFinanceState(user, spaceId));
  } catch {
    return Response.json({ error: "No tienes acceso a este espacio" }, { status: 403 });
  }
}

export async function PUT(request: Request) {
  const user = await getMizufiUser(request);
  if (!user) return Response.json({ error: "Inicio de sesión necesario" }, { status: 401 });

  const state = (await request.json()) as Partial<FinancePayload>;
  if (!Array.isArray(state.accounts) || !Array.isArray(state.movements) || !Array.isArray(state.programs)) {
    return Response.json({ error: "Datos financieros no válidos" }, { status: 400 });
  }

  const spaceId = request.headers.get("x-mizufi-space-id");
  try {
    await saveFinanceState(user, state, spaceId);
  } catch (error) {
    if (error instanceof Error && error.message === "SPACE_READ_ONLY") {
      return Response.json({ error: "Este espacio es de solo lectura" }, { status: 403 });
    }
    return Response.json({ error: "No tienes acceso a este espacio" }, { status: 403 });
  }

  return Response.json({ saved: true });
}

export async function DELETE(request: Request) {
  const user = await getMizufiUser(request);
  if (!user) return Response.json({ error: "Inicio de sesión necesario" }, { status: 401 });

  const scope = new URL(request.url).searchParams.get("scope");
  if (scope === "account") {
    try {
      // Delete access first. If Supabase rejects the admin request, no user data is touched.
      await deleteSupabaseUser(user.id);
      await deleteMizufiAccount(user);
      return Response.json({ deleted: "account" });
    } catch (error) {
      console.error("Account deletion failed", error);
      return Response.json(
        { error: "No se ha podido eliminar la cuenta. Inténtalo de nuevo en unos minutos." },
        { status: 503 },
      );
    }
  }

  const spaceId = request.headers.get("x-mizufi-space-id");
  await deleteFinanceState(user, spaceId);
  return Response.json({ deleted: "data" });
}
