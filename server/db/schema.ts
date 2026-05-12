import {
  pgTable,
  serial,
  varchar,
  timestamp,
  numeric,
  integer,
  boolean,
  text,
  date,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const visitTypeEnum = pgEnum("visit_type", ["first_visit", "last_visit"]);
export const extractionStatusEnum = pgEnum("extraction_status", [
  "running",
  "completed",
  "failed",
]);
export const extractionSourceEnum = pgEnum("extraction_source", [
  "shopify",
  "manual",
]);
export const userRoleEnum = pgEnum("user_role", ["admin", "viewer"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 128 }),
    role: userRoleEnum("role").notNull().default("admin"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    shopifyOrderId: varchar("shopify_order_id", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull(),
    financialStatus: varchar("financial_status", { length: 32 }),
    fulfillmentStatus: varchar("fulfillment_status", { length: 32 }),
    customerEmail: varchar("customer_email", { length: 320 }),
    customerName: varchar("customer_name", { length: 256 }),
    sourceName: varchar("source_name", { length: 128 }),
    appName: varchar("app_name", { length: 128 }),
    discountCodes: text("discount_codes"),
    tags: text("tags"),
    orderName: varchar("order_name", { length: 64 }),
    cogsAmount: numeric("cogs_amount", { precision: 12, scale: 2 }),
    cogsSource: varchar("cogs_source", { length: 32 }),
    cogsUpdatedAt: timestamp("cogs_updated_at", { withTimezone: true }),
    extractedAt: timestamp("extracted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_shopify_order_id_key").on(t.shopifyOrderId),
    index("orders_created_at_idx").on(t.createdAt),
  ],
);

export const orderAttribution = pgTable(
  "order_attribution",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    shopifyOrderId: varchar("shopify_order_id", { length: 64 }).notNull(),
    channelName: varchar("channel_name", { length: 64 }),
    subChannelName: varchar("sub_channel_name", { length: 64 }),
    channelHandle: varchar("channel_handle", { length: 64 }),
    isMarketplace: boolean("is_marketplace"),
    customerOrderIndex: integer("customer_order_index"),
    daysToConversion: integer("days_to_conversion"),
    journeyReady: boolean("journey_ready"),
    firstVisitSource: varchar("first_visit_source", { length: 128 }),
    lastVisitSource: varchar("last_visit_source", { length: 128 }),
    firstVisitReferrerUrl: text("first_visit_referrer_url"),
    lastVisitReferrerUrl: text("last_visit_referrer_url"),
    firstVisitOccurredAt: timestamp("first_visit_occurred_at", {
      withTimezone: true,
    }),
    lastVisitOccurredAt: timestamp("last_visit_occurred_at", {
      withTimezone: true,
    }),
  },
  (t) => [
    uniqueIndex("order_attribution_order_id_key").on(t.orderId),
    index("order_attribution_channel_name_idx").on(t.channelName),
  ],
);

export const utmParameters = pgTable(
  "utm_parameters",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    shopifyOrderId: varchar("shopify_order_id", { length: 64 }).notNull(),
    visitType: visitTypeEnum("visit_type").notNull(),
    utmSource: varchar("utm_source", { length: 128 }),
    utmMedium: varchar("utm_medium", { length: 128 }),
    utmCampaign: varchar("utm_campaign", { length: 128 }),
    utmContent: varchar("utm_content", { length: 256 }),
    utmTerm: varchar("utm_term", { length: 256 }),
  },
  (t) => [
    index("utm_parameters_order_id_idx").on(t.orderId),
    index("utm_parameters_campaign_idx").on(t.utmCampaign),
  ],
);

export const monthlyGoals = pgTable(
  "monthly_goals",
  {
    id: serial("id").primaryKey(),
    month: varchar("month", { length: 7 }).notNull(),
    revenueGoal: numeric("revenue_goal", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    grossProfitGoal: numeric("gross_profit_goal", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("monthly_goals_month_key").on(t.month)],
);

export const dailyWeights = pgTable(
  "daily_weights",
  {
    id: serial("id").primaryKey(),
    month: varchar("month", { length: 7 }).notNull(),
    day: integer("day").notNull(),
    weight: numeric("weight", { precision: 6, scale: 3 })
      .notNull()
      .default("1"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("daily_weights_month_day_key").on(t.month, t.day)],
);

export const channelGoals = pgTable(
  "channel_goals",
  {
    id: serial("id").primaryKey(),
    channel: varchar("channel", { length: 64 }).notNull(),
    month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
    revenueGoal: numeric("revenue_goal", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    ordersGoal: integer("orders_goal").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("channel_goals_channel_month_key").on(t.channel, t.month)],
);

export const extractionLogs = pgTable(
  "extraction_logs",
  {
    id: serial("id").primaryKey(),
    source: extractionSourceEnum("source").notNull().default("manual"),
    status: extractionStatusEnum("status").notNull().default("running"),
    dateFrom: timestamp("date_from", { withTimezone: true }).notNull(),
    dateTo: timestamp("date_to", { withTimezone: true }).notNull(),
    ordersExtracted: integer("orders_extracted").notNull().default(0),
    ordersNew: integer("orders_new").notNull().default(0),
    ordersSkipped: integer("orders_skipped").notNull().default(0),
    errorsCount: integer("errors_count").notNull().default(0),
    errorMessage: text("error_message"),
    executionTimeMs: integer("execution_time_ms"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("extraction_logs_started_at_idx").on(t.startedAt)],
);

// Insights diários de plataformas de anúncios (Google Ads, Meta, etc).
// Granularidade: 1 linha por (platform, account_id, date). Forma genérica
// para permitir adicionar Meta/TikTok futuramente sem migrar schema.
export const adsInsights = pgTable(
  "ads_insights",
  {
    id: serial("id").primaryKey(),
    platform: varchar("platform", { length: 32 }).notNull(),
    accountId: varchar("account_id", { length: 64 }).notNull(),
    date: date("date").notNull(),
    spend: numeric("spend", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 8 }),
    clicks: integer("clicks"),
    impressions: integer("impressions"),
    conversions: numeric("conversions", { precision: 10, scale: 2 }),
    conversionValue: numeric("conversion_value", { precision: 14, scale: 2 }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ads_insights_platform_account_date_key").on(
      t.platform,
      t.accountId,
      t.date,
    ),
    index("ads_insights_platform_date_idx").on(t.platform, t.date),
  ],
);

// Cache de tokens OAuth para integrações externas que precisam refresh.
// Necessário porque cache in-memory não persiste entre invocações serverless.
export const serviceTokens = pgTable("service_tokens", {
  service: varchar("service", { length: 64 }).primaryKey(),
  accessToken: text("access_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderAttribution = typeof orderAttribution.$inferSelect;
export type UtmParameter = typeof utmParameters.$inferSelect;
export type ChannelGoal = typeof channelGoals.$inferSelect;
export type MonthlyGoal = typeof monthlyGoals.$inferSelect;
export type DailyWeight = typeof dailyWeights.$inferSelect;
export type ExtractionLog = typeof extractionLogs.$inferSelect;
export type AdsInsight = typeof adsInsights.$inferSelect;
export type ServiceToken = typeof serviceTokens.$inferSelect;
