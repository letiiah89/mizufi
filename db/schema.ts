import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const financeProfiles = sqliteTable("finance_profiles", {
  email: text("email").primaryKey(),
  state: text("state").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const betaParticipants = sqliteTable("beta_participants", {
  email: text("email").primaryKey(),
  firstSeenAt: integer("first_seen_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  visitCount: integer("visit_count").notNull().default(1),
});

export const userAccounts = sqliteTable("user_accounts", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  plan: text("plan").notNull().default("free"),
  subscriptionStatus: text("subscription_status").notNull().default("inactive"),
  subscriptionEndsAt: integer("subscription_ends_at"),
  firstSeenAt: integer("first_seen_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  visitCount: integer("visit_count").notNull().default(1),
});

export const financeProfilesByUser = sqliteTable("finance_profiles_by_user", {
  userId: text("user_id").primaryKey(),
  state: text("state").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const financeSpaces = sqliteTable(
  "finance_spaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("personal"),
    ownerUserId: text("owner_user_id").notNull(),
    ownerEmail: text("owner_email").notNull(),
    state: text("state").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_finance_spaces_owner_user_id").on(table.ownerUserId)],
);

export const financeSpaceMembers = sqliteTable(
  "finance_space_members",
  {
    spaceId: text("space_id").notNull(),
    email: text("email").notNull(),
    userId: text("user_id"),
    role: text("role").notNull().default("editor"),
    status: text("status").notNull().default("pending"),
    invitedAt: integer("invited_at").notNull(),
    joinedAt: integer("joined_at"),
  },
  (table) => [
    uniqueIndex("idx_finance_space_members_space_email").on(table.spaceId, table.email),
    index("idx_finance_space_members_user_id").on(table.userId),
    index("idx_finance_space_members_email").on(table.email),
    index("idx_finance_space_members_space_id").on(table.spaceId),
  ],
);

export const monetizationEvents = sqliteTable(
  "monetization_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    placement: text("placement").notNull(),
    partner: text("partner"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_monetization_events_type_created_at").on(table.type, table.createdAt),
    index("idx_monetization_events_user_created_at").on(table.userId, table.createdAt),
  ],
);

export const vipPurchases = sqliteTable(
  "vip_purchases",
  {
    stripeEventId: text("stripe_event_id").primaryKey(),
    userId: text("user_id").notNull(),
    paymentIntentId: text("payment_intent_id"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    livemode: integer("livemode", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_vip_purchases_user_id").on(table.userId)],
);

export const betaFeedback = sqliteTable(
  "beta_feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    type: text("type").notNull(),
    message: text("message").notNull(),
    context: text("context").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_beta_feedback_status_created_at").on(table.status, table.createdAt),
    index("idx_beta_feedback_user_created_at").on(table.userId, table.createdAt),
  ],
);
