import { getMizufiUser } from "../../supabase-server";
import { BETA_ADMIN_EMAIL, getAccountPlan, getBetaStats, getVipPurchaseCount, listFinanceSpaces, trackUser } from "../../finance-store";

export async function GET(request: Request) {
  const user = await getMizufiUser(request);
  if (!user) return Response.json({ error: "Inicio de sesión necesario" }, { status: 401 });

  const isBetaAdmin = user.email === BETA_ADMIN_EMAIL;
  let betaStats;
  try {
    await trackUser(user);
    betaStats = isBetaAdmin ? await getBetaStats(user.id) : undefined;
  } catch (error) {
    console.error("Unable to update beta account statistics", error);
  }
  const accountPlan = await getAccountPlan(user.id);
  const vipPurchases = await getVipPurchaseCount();
  const spaces = await listFinanceSpaces(user);
  return Response.json({
    displayName: user.displayName,
    isBetaAdmin,
    betaStats,
    plan: accountPlan.plan,
    vipActive: accountPlan.plan === "vip" && accountPlan.status === "active",
    vipRemaining: Math.max(0, 100 - vipPurchases),
    spaces,
  });
}
