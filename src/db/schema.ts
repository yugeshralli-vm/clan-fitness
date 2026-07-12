import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const checkInTypeEnum = pgEnum("check_in_type", ["gym", "steps", "food"]);
export const goalPeriodEnum = pgEnum("goal_period", ["daily", "weekly"]);
export const clanRoleEnum = pgEnum("clan_role", ["admin", "member"]);
export const checkInVisibilityEnum = pgEnum("check_in_visibility", [
  "public_to_clan",
  "private",
]);
export const genderEnum = pgEnum("gender", ["female", "male", "other", "prefer_not_to_say"]);
export const unitsPreferenceEnum = pgEnum("units_preference", ["metric", "imperial"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  name: text("name").notNull(),
  email: text("email").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Profile details below are user-entered, private to the user, and never touched by the
  // Clerk sync upsert in getOrSyncCurrentUser() (its onConflictDoUpdate only sets name/email/avatarUrl).
  heightCm: integer("height_cm"),
  weightKg: numeric("weight_kg", { precision: 5, scale: 1 }),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  gender: genderEnum("gender"),
  unitsPreference: unitsPreferenceEnum("units_preference").notNull().default("metric"),
  bio: text("bio"),
});

export const clans = pgTable("clans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  inviteCode: text("invite_code").notNull().unique(),
  maxSize: integer("max_size").notNull().default(15),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clanMemberships = pgTable(
  "clan_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    clanId: uuid("clan_id")
      .notNull()
      .references(() => clans.id),
    role: clanRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("clan_memberships_user_clan_idx").on(t.userId, t.clanId),
    uniqueIndex("clan_memberships_one_admin_idx")
      .on(t.clanId)
      .where(sql`${t.role} = 'admin'`),
    index("clan_memberships_clan_idx").on(t.clanId),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    type: checkInTypeEnum("type").notNull(),
    targetValue: integer("target_value").notNull(),
    period: goalPeriodEnum("period").notNull(),
  },
  (t) => [uniqueIndex("goals_user_type_idx").on(t.userId, t.type)],
);

export const checkIns = pgTable(
  "check_ins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // No clanId: a check-in is a personal record, visible in every clan the user is a member of
    // (see getClanFeed's join against clanMemberships), not owned by a single clan.
    type: checkInTypeEnum("type").notNull(),
    value: jsonb("value").notNull(),
    visibility: checkInVisibilityEnum("visibility").notNull().default("public_to_clan"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("check_ins_created_at_idx").on(t.createdAt),
    // Covers getTodaysCheckIn/getUserWeeklyCount/getWeeklyCounts/getWeeklyStepsTotals (equality on
    // userId+type, range on createdAt) and helps getUserStreak/getStreaks (equality-only prefix)
    // avoid a full scan. Lost when the multi-clan migration dropped clanId without a replacement.
    index("check_ins_user_type_created_at_idx").on(t.userId, t.type, t.createdAt),
  ],
);

export const systemPostTypeEnum = pgEnum("system_post_type", ["weekly_recap"]);

// A weekly recap posted as "Clan Fitness" itself, not a real user — topThree/wallOfShame store
// only {userId, score}, not a name/avatar snapshot, since users are never deleted in this app
// (unlike clans), so rendering can safely live-join `users` for current name/avatar.
export const systemPosts = pgTable(
  "system_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clanId: uuid("clan_id")
      .notNull()
      .references(() => clans.id),
    type: systemPostTypeEnum("type").notNull().default("weekly_recap"),
    weekStart: timestamp("week_start").notNull(),
    weekEnd: timestamp("week_end").notNull(),
    topThree: jsonb("top_three").notNull().$type<{ userId: string; score: number }[]>(),
    wallOfShame: jsonb("wall_of_shame").notNull().$type<{ userId: string; score: number }[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  // Lets the weekly cron job onConflictDoNothing to stay idempotent if it ever fires twice.
  (t) => [uniqueIndex("system_posts_clan_type_week_idx").on(t.clanId, t.type, t.weekStart)],
);

// checkInId/systemPostId: exactly one of the two is set, enforced at the application layer (not a
// DB CHECK constraint) — a reaction/comment targets either a real check-in or a system post, never
// both/neither. Two partial unique indexes rather than one combined index across both nullable
// columns: Postgres treats NULL <> NULL in unique indexes, so a single index spanning both columns
// would stop enforcing uniqueness among check-in reactions entirely (every row has systemPostId
// NULL, and NULLs never collide) — the same partial-index pattern is already used for
// clan_memberships_one_admin_idx above.
export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    checkInId: uuid("check_in_id").references(() => checkIns.id),
    systemPostId: uuid("system_post_id").references(() => systemPosts.id),
    // The clan this reaction happened in — reactions are clan-scoped even though the underlying
    // check-in is visible across all of the owner's clans, so the same user can react to the same
    // check-in independently once per clan they share with the owner.
    clanId: uuid("clan_id")
      .notNull()
      .references(() => clans.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("reactions_check_in_clan_user_emoji_idx")
      .on(t.checkInId, t.clanId, t.userId, t.emoji)
      .where(sql`${t.checkInId} is not null`),
    uniqueIndex("reactions_system_post_clan_user_emoji_idx")
      .on(t.systemPostId, t.clanId, t.userId, t.emoji)
      .where(sql`${t.systemPostId} is not null`),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    checkInId: uuid("check_in_id").references(() => checkIns.id),
    systemPostId: uuid("system_post_id").references(() => systemPosts.id),
    // Same clan-scoping rationale as reactions.clanId above.
    clanId: uuid("clan_id")
      .notNull()
      .references(() => clans.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("comments_check_in_id_clan_id_idx").on(t.checkInId, t.clanId)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

export const notificationTypeEnum = pgEnum("notification_type", [
  "comment",
  "mention",
  "reaction",
  "check_in",
  "missed_log", // reserved for a future cron-driven reminder; unused for now
  "nudge",
  "feedback",
  "broadcast",
  "weekly_recap",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    checkInId: uuid("check_in_id").references(() => checkIns.id),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("notifications_user_created_at_idx").on(t.userId, t.createdAt),
    index("notifications_user_unread_idx").on(t.userId).where(sql`${t.readAt} is null`),
  ],
);

// Admin-tunable settings (leaderboard weights, default goal fallbacks, etc.) as key/value so a
// new knob never needs a migration — only reading a new key in code and adding it to the admin
// form does. Absent keys fall back to defaults in code (see src/features/admin/config.ts), so
// this table can start (and stay, for untouched keys) completely empty.
export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notificationChannelEnum = pgEnum("notification_channel", ["push", "email"]);
export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", [
  "sent",
  "failed",
  "skipped",
]);

// One row per actual send attempt (one per push subscription, one per email) — push has had
// ongoing reliability issues with zero durable record of why; this is that record. Starts empty
// and only reflects delivery attempts from the moment it ships, not retroactively.
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    channel: notificationChannelEnum("channel").notNull(),
    status: notificationDeliveryStatusEnum("status").notNull(),
    // e.g. "missing VAPID env vars", "404 Gone (subscription removed)", a truncated provider error
    detail: text("detail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("notification_deliveries_created_at_idx").on(t.createdAt)],
);

export const feedbackSenderEnum = pgEnum("feedback_sender", ["user", "admin"]);

// Each user has exactly one thread with "the team" — userId alone identifies it on both sides,
// no separate conversation id needed. sender records who actually wrote this particular message
// (the thread owner, or the admin replying into it).
export const feedbackMessages = pgTable(
  "feedback_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    sender: feedbackSenderEnum("sender").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("feedback_messages_user_created_at_idx").on(t.userId, t.createdAt)],
);

export const broadcastTargetTypeEnum = pgEnum("broadcast_target_type", ["clan", "user"]);

// targetNames is a snapshot of the target clans'/users' names at send time (db column kept as
// clan_names from the original clan-only implementation — holds user names too when targetType
// is "user"), not a live join/FK list, so history stays correct even if a targeted clan is later
// deleted or a user renames themselves (see deleteClan).
export const broadcastMessages = pgTable(
  "broadcast_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    targetType: broadcastTargetTypeEnum("target_type").notNull().default("clan"),
    targetNames: jsonb("clan_names").notNull().$type<string[]>(),
    recipientCount: integer("recipient_count").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (t) => [index("broadcast_messages_sent_at_idx").on(t.sentAt)],
);
