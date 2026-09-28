import { env } from "cloudflare:workers";
import type { MizufiUser } from "./supabase-server";

export const BETA_ADMIN_EMAIL = "letiah89@gmail.com";

export type FinanceSpace = {
  id: string;
  name: string;
  kind: "personal" | "demo" | "shared";
  role: "owner" | "editor" | "viewer";
  ownerEmail: string;
  memberCount: number;
  updatedAt: number;
};

export type BetaStats = {
  registered: number;
  started: number;
  active7: number;
  active30: number;
  adClicks: number;
  affiliateClicks: number;
  subscribers: number;
  capacity: {
    profileCount: number;
    stateBytes: number;
    storageLimitBytes: number;
    storagePercent: number;
    averageProfileBytes: number;
    largestProfileBytes: number;
    profileLimitBytes: number;
    largestProfilePercent: number;
    nextUserReview: number;
    alerts: Array<{ level: "good" | "info" | "warning" | "critical"; title: string; message: string }>;
  };
  feedback: Array<{ id: number; type: string; message: string; context: string; email: string; createdAt: number }>;
};

export async function submitBetaFeedback(user: MizufiUser, input: { type: string; message: string; context: string }) {
  await env.DB.prepare(
    `INSERT INTO beta_feedback (user_id, email, type, message, context, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`,
  ).bind(user.id, user.email.toLowerCase(), input.type, input.message, input.context, Date.now()).run();
}

export async function trackUser(user: MizufiUser) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO user_accounts
      (user_id, email, plan, subscription_status, first_seen_at, last_seen_at, visit_count)
     VALUES (?, ?, 'free', 'inactive', ?, ?, 1)
     ON CONFLICT(user_id) DO UPDATE SET
       email = excluded.email,
       last_seen_at = excluded.last_seen_at,
       visit_count = user_accounts.visit_count + 1`,
  ).bind(user.id, user.email.toLowerCase(), now, now).run();
}

function normalizedSpaceKind(value: string): FinanceSpace["kind"] {
  return value === "demo" || value === "shared" ? value : "personal";
}

export async function ensureFinanceSpaces(user: MizufiUser) {
  const email = user.email.toLowerCase();
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE finance_space_members
     SET user_id = ?, status = 'active', joined_at = COALESCE(joined_at, ?)
     WHERE lower(email) = ? AND status = 'pending'`,
  ).bind(user.id, now, email).run();

  const personal = await env.DB.prepare(
    `SELECT space.id
     FROM finance_spaces AS space
     JOIN finance_space_members AS member ON member.space_id = space.id
     WHERE member.user_id = ? AND member.status = 'active' AND space.kind = 'personal'
     LIMIT 1`,
  ).bind(user.id).first<{ id: string }>();
  if (personal) return;

  let legacy = await env.DB.prepare(
    "SELECT state, updated_at FROM finance_profiles_by_user WHERE user_id = ?",
  ).bind(user.id).first<{ state: string; updated_at: number }>();
  if (!legacy) {
    legacy = await env.DB.prepare(
      `SELECT profile.state, profile.updated_at
       FROM user_accounts AS account
       JOIN finance_profiles_by_user AS profile ON profile.user_id = account.user_id
       WHERE lower(account.email) = ? AND account.user_id <> ?
       ORDER BY account.last_seen_at DESC LIMIT 1`,
    ).bind(email, user.id).first<{ state: string; updated_at: number }>();
  }
  if (!legacy) {
    legacy = await env.DB.prepare(
      "SELECT state, updated_at FROM finance_profiles WHERE email = ?",
    ).bind(email).first<{ state: string; updated_at: number }>();
  }
  const spaceId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO finance_spaces
       (id, name, kind, owner_user_id, owner_email, state, created_at, updated_at)
       VALUES (?, 'Mis finanzas', 'personal', ?, ?, ?, ?, ?)`,
    ).bind(spaceId, user.id, email, legacy?.state ?? "{}", now, legacy?.updated_at ?? now),
    env.DB.prepare(
      `INSERT INTO finance_space_members
       (space_id, email, user_id, role, status, invited_at, joined_at)
       VALUES (?, ?, ?, 'owner', 'active', ?, ?)`,
    ).bind(spaceId, email, user.id, now, now),
  ]);
}

export async function listFinanceSpaces(user: MizufiUser): Promise<FinanceSpace[]> {
  await ensureFinanceSpaces(user);
  const rows = await env.DB.prepare(
    `SELECT space.id, space.name, space.kind, space.owner_email AS ownerEmail,
            member.role, space.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM finance_space_members AS count_member
             WHERE count_member.space_id = space.id AND count_member.status = 'active') AS memberCount
     FROM finance_spaces AS space
     JOIN finance_space_members AS member ON member.space_id = space.id
     WHERE member.user_id = ? AND member.status = 'active'
     ORDER BY CASE space.kind WHEN 'personal' THEN 0 WHEN 'shared' THEN 1 ELSE 2 END,
              space.created_at ASC`,
  ).bind(user.id).all<FinanceSpace>();
  return (rows.results ?? []).map((row: FinanceSpace) => ({
    ...row,
    kind: normalizedSpaceKind(row.kind),
    role: row.role === "owner" || row.role === "viewer" ? row.role : "editor",
    memberCount: Number(row.memberCount ?? 1),
    updatedAt: Number(row.updatedAt),
  }));
}

async function getFinanceSpaceAccess(user: MizufiUser, requestedSpaceId?: string | null) {
  await ensureFinanceSpaces(user);
  const row = requestedSpaceId
    ? await env.DB.prepare(
      `SELECT space.id, space.state, member.role
       FROM finance_spaces AS space
       JOIN finance_space_members AS member ON member.space_id = space.id
       WHERE space.id = ? AND member.user_id = ? AND member.status = 'active'`,
    ).bind(requestedSpaceId, user.id).first<{ id: string; state: string; role: string }>()
    : await env.DB.prepare(
      `SELECT space.id, space.state, member.role
       FROM finance_spaces AS space
       JOIN finance_space_members AS member ON member.space_id = space.id
       WHERE member.user_id = ? AND member.status = 'active'
       ORDER BY CASE space.kind WHEN 'personal' THEN 0 WHEN 'shared' THEN 1 ELSE 2 END, space.created_at ASC
       LIMIT 1`,
    ).bind(user.id).first<{ id: string; state: string; role: string }>();
  if (!row) throw new Error("SPACE_NOT_FOUND");
  return row;
}

export async function createFinanceSpace(user: MizufiUser, input: { name: string; kind: FinanceSpace["kind"] }) {
  const name = input.name.trim().slice(0, 50);
  if (!name) throw new Error("SPACE_NAME_REQUIRED");
  const kind = normalizedSpaceKind(input.kind);
  const now = Date.now();
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO finance_spaces
       (id, name, kind, owner_user_id, owner_email, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '{}', ?, ?)`,
    ).bind(id, name, kind, user.id, user.email.toLowerCase(), now, now),
    env.DB.prepare(
      `INSERT INTO finance_space_members
       (space_id, email, user_id, role, status, invited_at, joined_at)
       VALUES (?, ?, ?, 'owner', 'active', ?, ?)`,
    ).bind(id, user.email.toLowerCase(), user.id, now, now),
  ]);
  return id;
}

export async function updateFinanceSpace(user: MizufiUser, input: { spaceId: string; name: string; kind: FinanceSpace["kind"] }) {
  const name = input.name.trim().slice(0, 50);
  if (!name) throw new Error("SPACE_NAME_REQUIRED");
  const result = await env.DB.prepare(
    "UPDATE finance_spaces SET name = ?, kind = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?",
  ).bind(name, normalizedSpaceKind(input.kind), Date.now(), input.spaceId, user.id).run();
  if (!result.meta.changes) throw new Error("SPACE_NOT_OWNED");
}

export async function removeFinanceSpace(user: MizufiUser, spaceId: string) {
  const membership = await env.DB.prepare(
    `SELECT space.owner_user_id AS ownerUserId, space.kind, member.role
     FROM finance_spaces AS space
     JOIN finance_space_members AS member ON member.space_id = space.id
     WHERE space.id = ? AND member.user_id = ? AND member.status = 'active'`,
  ).bind(spaceId, user.id).first<{ ownerUserId: string; kind: string; role: string }>();
  if (!membership) throw new Error("SPACE_NOT_FOUND");

  if (membership.ownerUserId !== user.id || membership.role !== "owner") {
    await env.DB.prepare(
      "DELETE FROM finance_space_members WHERE space_id = ? AND user_id = ?",
    ).bind(spaceId, user.id).run();
    return "left" as const;
  }

  if (membership.kind === "personal") {
    const otherPersonal = await env.DB.prepare(
      "SELECT id FROM finance_spaces WHERE owner_user_id = ? AND kind = 'personal' AND id <> ? LIMIT 1",
    ).bind(user.id, spaceId).first<{ id: string }>();
    if (!otherPersonal) throw new Error("LAST_PERSONAL_SPACE");
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM finance_space_members WHERE space_id = ?").bind(spaceId),
    env.DB.prepare("DELETE FROM finance_spaces WHERE id = ? AND owner_user_id = ?").bind(spaceId, user.id),
  ]);
  return "deleted" as const;
}

export async function inviteToFinanceSpace(user: MizufiUser, input: { spaceId: string; email: string; role: "editor" | "viewer" }) {
  const email = input.email.trim().toLowerCase();
  if (!email || email === user.email.toLowerCase()) throw new Error("INVALID_INVITATION");
  const owned = await env.DB.prepare(
    "SELECT id FROM finance_spaces WHERE id = ? AND owner_user_id = ? AND kind IN ('shared', 'demo')",
  ).bind(input.spaceId, user.id).first<{ id: string }>();
  if (!owned) throw new Error("SPACE_NOT_OWNED");
  const existingUser = await env.DB.prepare(
    "SELECT user_id FROM user_accounts WHERE lower(email) = ? ORDER BY last_seen_at DESC LIMIT 1",
  ).bind(email).first<{ user_id: string }>();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO finance_space_members
     (space_id, email, user_id, role, status, invited_at, joined_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(space_id, email) DO UPDATE SET
       user_id = excluded.user_id,
       role = excluded.role,
       status = excluded.status,
       invited_at = excluded.invited_at,
       joined_at = excluded.joined_at`,
  ).bind(
    input.spaceId,
    email,
    existingUser?.user_id ?? null,
    input.role,
    existingUser ? "active" : "pending",
    now,
    existingUser ? now : null,
  ).run();
}

export async function getAccountPlan(userId: string) {
  const account = await env.DB.prepare(
    "SELECT plan, subscription_status FROM user_accounts WHERE user_id = ?",
  ).bind(userId).first<{ plan: string; subscription_status: string }>();
  return {
    plan: account?.plan === "vip" ? "vip" as const : "free" as const,
    status: account?.subscription_status ?? "inactive",
  };
}

export async function getVipPurchaseCount() {
  const result = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM vip_purchases WHERE livemode = 1",
  ).first<{ total: number }>();
  return Number(result?.total ?? 0);
}

export async function activateLifetimeVip(input: {
  stripeEventId: string;
  userId: string;
  paymentIntentId?: string;
  amount: number;
  currency: string;
  livemode: boolean;
}) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO vip_purchases
       (stripe_event_id, user_id, payment_intent_id, amount, currency, livemode, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(input.stripeEventId, input.userId, input.paymentIntentId ?? null, input.amount, input.currency, input.livemode ? 1 : 0, now),
    env.DB.prepare(
      `UPDATE user_accounts
       SET plan = 'vip', subscription_status = 'active', subscription_ends_at = NULL
       WHERE user_id = ?`,
    ).bind(input.userId),
  ]);
}

export async function loadFinanceState(user: MizufiUser, spaceId?: string | null) {
  const space = await getFinanceSpaceAccess(user, spaceId);
  return space.state === "{}" ? null : JSON.parse(space.state);
}

export async function saveFinanceState(user: MizufiUser, state: unknown, spaceId?: string | null) {
  const space = await getFinanceSpaceAccess(user, spaceId);
  if (space.role === "viewer") throw new Error("SPACE_READ_ONLY");
  await env.DB.prepare(
    "UPDATE finance_spaces SET state = ?, updated_at = ? WHERE id = ?",
  ).bind(JSON.stringify(state), Date.now(), space.id).run();
}

export async function deleteFinanceState(user: MizufiUser, spaceId?: string | null) {
  if (spaceId) {
    const space = await getFinanceSpaceAccess(user, spaceId);
    if (space.role === "viewer") throw new Error("SPACE_READ_ONLY");
    await env.DB.prepare(
      "UPDATE finance_spaces SET state = '{}', updated_at = ? WHERE id = ?",
    ).bind(Date.now(), space.id).run();
    return;
  }
  await env.DB.prepare(
    "DELETE FROM finance_profiles_by_user WHERE user_id = ?",
  ).bind(user.id).run();
  await env.DB.prepare(
    "DELETE FROM finance_profiles WHERE email = ?",
  ).bind(user.email.toLowerCase()).run();
}

export async function deleteMizufiAccount(user: MizufiUser) {
  await env.DB.prepare(
    "DELETE FROM finance_space_members WHERE space_id IN (SELECT id FROM finance_spaces WHERE owner_user_id = ?)",
  ).bind(user.id).run();
  await env.DB.prepare(
    "DELETE FROM finance_space_members WHERE user_id = ? OR lower(email) = ?",
  ).bind(user.id, user.email.toLowerCase()).run();
  await env.DB.prepare(
    "DELETE FROM finance_spaces WHERE owner_user_id = ?",
  ).bind(user.id).run();
  await deleteFinanceState(user);
  await env.DB.prepare(
    "DELETE FROM beta_feedback WHERE user_id = ?",
  ).bind(user.id).run();
  await env.DB.prepare(
    "DELETE FROM monetization_events WHERE user_id = ?",
  ).bind(user.id).run();
  await env.DB.prepare(
    "DELETE FROM user_accounts WHERE user_id = ?",
  ).bind(user.id).run();
  await env.DB.prepare(
    "DELETE FROM beta_participants WHERE email = ?",
  ).bind(user.email.toLowerCase()).run();
}

export async function getBetaStats(adminUserId: string): Promise<BetaStats> {
  const now = Date.now();
  const users = await env.DB.prepare(
    `SELECT
       COUNT(*) AS registered,
       COALESCE(SUM(CASE WHEN EXISTS (
         SELECT 1 FROM finance_spaces AS profile
         WHERE profile.owner_user_id = account.user_id AND profile.state <> '{}'
       ) THEN 1 ELSE 0 END), 0) AS started,
       COALESCE(SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END), 0) AS active7,
       COALESCE(SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END), 0) AS active30,
       COALESCE(SUM(CASE WHEN plan = 'vip' AND subscription_status = 'active' THEN 1 ELSE 0 END), 0) AS subscribers
     FROM user_accounts AS account
     WHERE user_id <> ?`,
  ).bind(
    now - 7 * 24 * 60 * 60 * 1000,
    now - 30 * 24 * 60 * 60 * 1000,
    adminUserId,
  ).first<Omit<BetaStats, "adClicks" | "affiliateClicks">>();

  const clicks = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'ad_click' THEN 1 ELSE 0 END), 0) AS adClicks,
       COALESCE(SUM(CASE WHEN type = 'affiliate_click' THEN 1 ELSE 0 END), 0) AS affiliateClicks
     FROM monetization_events
     WHERE user_id <> ?`,
  ).bind(adminUserId).first<Pick<BetaStats, "adClicks" | "affiliateClicks">>();

  const feedback = await env.DB.prepare(
    `SELECT id, type, message, context, email, created_at AS createdAt
     FROM beta_feedback WHERE status = 'open' ORDER BY created_at DESC LIMIT 20`,
  ).all<{ id: number; type: string; message: string; context: string; email: string; createdAt: number }>();

  const capacityRow = await env.DB.prepare(
    `SELECT
       COUNT(*) AS profileCount,
       COALESCE(SUM(length(CAST(state AS BLOB))), 0) AS stateBytes,
       COALESCE(AVG(length(CAST(state AS BLOB))), 0) AS averageProfileBytes,
       COALESCE(MAX(length(CAST(state AS BLOB))), 0) AS largestProfileBytes
     FROM finance_spaces
     WHERE owner_user_id <> ?`,
  ).bind(adminUserId).first<{ profileCount: number; stateBytes: number; averageProfileBytes: number; largestProfileBytes: number }>();
  const storageLimitBytes = 500 * 1024 * 1024;
  const profileLimitBytes = 2_000_000;
  const stateBytes = Number(capacityRow?.stateBytes ?? 0);
  const largestProfileBytes = Number(capacityRow?.largestProfileBytes ?? 0);
  const storagePercent = Math.min(100, stateBytes / storageLimitBytes * 100);
  const largestProfilePercent = Math.min(100, largestProfileBytes / profileLimitBytes * 100);
  const registered = Number(users?.registered ?? 0);
  const nextUserReview = [100, 250, 400, 1000].find((milestone) => registered < milestone) ?? 1000;
  const alerts: BetaStats["capacity"]["alerts"] = [];
  if (storagePercent >= 75) alerts.push({ level: "critical", title: "Ampliación necesaria", message: "El almacenamiento financiero ha superado el 75 %. Conviene ampliar capacidad antes de incorporar más usuarios." });
  else if (storagePercent >= 60) alerts.push({ level: "warning", title: "Preparar ampliación", message: "El almacenamiento ha superado el 60 %. Es momento de preparar el cambio de plan." });
  else alerts.push({ level: "good", title: "Almacenamiento con margen", message: "El volumen actual está por debajo del nivel de preparación del 60 %." });
  if (largestProfilePercent >= 75) alerts.push({ level: "critical", title: "Una cuenta se acerca a su límite", message: "La cuenta con más datos supera el 75 % del tamaño seguro. Hay que separar sus movimientos en registros independientes." });
  else if (largestProfilePercent >= 50) alerts.push({ level: "warning", title: "Revisar la cuenta más grande", message: "Una cuenta ha superado la mitad del tamaño máximo recomendado." });
  if (registered >= 400) alerts.push({ level: "warning", title: "Revisión de 400 usuarios", message: "Revisa capacidad, uso diario y arquitectura antes de continuar el crecimiento." });
  else if (registered >= 250) alerts.push({ level: "info", title: "Revisión de 250 usuarios", message: "Comprueba almacenamiento y actividad diaria. La siguiente revisión importante será a los 400 usuarios." });
  else if (registered >= 100) alerts.push({ level: "info", title: "Primera revisión completada", message: "Ya hay 100 usuarios. Comprueba mensualmente el crecimiento del almacenamiento." });

  return {
    registered,
    started: Number(users?.started ?? 0),
    active7: Number(users?.active7 ?? 0),
    active30: Number(users?.active30 ?? 0),
    subscribers: Number(users?.subscribers ?? 0),
    adClicks: Number(clicks?.adClicks ?? 0),
    affiliateClicks: Number(clicks?.affiliateClicks ?? 0),
    capacity: {
      profileCount: Number(capacityRow?.profileCount ?? 0),
      stateBytes,
      storageLimitBytes,
      storagePercent,
      averageProfileBytes: Number(capacityRow?.averageProfileBytes ?? 0),
      largestProfileBytes,
      profileLimitBytes,
      largestProfilePercent,
      nextUserReview,
      alerts,
    },
    feedback: feedback.results ?? [],
  };
}

export async function recordMonetizationClick(
  userId: string,
  type: "ad_click" | "affiliate_click",
  placement: string,
  partner?: string,
) {
  await env.DB.prepare(
    "INSERT INTO monetization_events (user_id, type, placement, partner, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(userId, type, placement, partner ?? null, Date.now()).run();
}
