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

export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    checkInId: uuid("check_in_id")
      .notNull()
      .references(() => checkIns.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("reactions_check_in_user_emoji_idx").on(t.checkInId, t.userId, t.emoji)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    checkInId: uuid("check_in_id")
      .notNull()
      .references(() => checkIns.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("comments_check_in_id_idx").on(t.checkInId)],
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
