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
  jsonb,
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
export const cogsSyncStatusEnum = pgEnum("cogs_sync_status", [
  "running",
  "completed",
  "failed",
]);
export const cogsSyncSourceEnum = pgEnum("cogs_sync_source", [
  "manual",
  "cron",
]);
export const mpSyncStatusEnum = pgEnum("mp_sync_status", [
  "running",
  "completed",
  "failed",
]);
export const mpSyncSourceEnum = pgEnum("mp_sync_source", ["manual", "cron"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "viewer"]);
export const cogsChangeReasonEnum = pgEnum("cogs_change_reason", [
  "dsers_initial", // primeira vez que o DSers informa o custo deste pedido
  "dsers_update", // valor mudou em um sync subsequente
  "manual_set", // usuário definiu manualmente
  "manual_clear", // usuário limpou manualmente
  "backfill", // import histórico ao criar a tabela
]);

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

export const cogsSyncLogs = pgTable(
  "cogs_sync_logs",
  {
    id: serial("id").primaryKey(),
    source: cogsSyncSourceEnum("source").notNull().default("manual"),
    status: cogsSyncStatusEnum("status").notNull().default("running"),
    dateFrom: timestamp("date_from", { withTimezone: true }).notNull(),
    dateTo: timestamp("date_to", { withTimezone: true }).notNull(),
    totalDsersOrders: integer("total_dsers_orders"),
    ourOrdersInRange: integer("our_orders_in_range"),
    ourOrdersWithName: integer("our_orders_with_name"),
    matched: integer("matched").notNull().default(0),
    cleared: integer("cleared").notNull().default(0),
    failedChunks: text("failed_chunks"),
    unmatchedSample: text("unmatched_sample"),
    errorMessage: text("error_message"),
    executionTimeMs: integer("execution_time_ms"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("cogs_sync_logs_started_at_idx").on(t.startedAt)],
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

// Pagamentos Mercado Pago. Granular por payment_id pra upsert idempotente;
// dashboard /custos agrega por dia. Não acopla com orders — propositalmente
// desacoplado pra ficar simples de re-sincronizar.
export const mpPayments = pgTable(
  "mp_payments",
  {
    id: varchar("id", { length: 64 }).primaryKey(), // MP payment id
    status: varchar("status", { length: 32 }),
    statusDetail: varchar("status_detail", { length: 64 }),
    dateCreated: timestamp("date_created", { withTimezone: true }),
    dateApproved: timestamp("date_approved", { withTimezone: true }),
    transactionAmount: numeric("transaction_amount", {
      precision: 12,
      scale: 2,
    }),
    feeAmount: numeric("fee_amount", { precision: 12, scale: 2 }),
    netReceivedAmount: numeric("net_received_amount", {
      precision: 12,
      scale: 2,
    }),
    externalReference: varchar("external_reference", { length: 128 }),
    paymentMethodId: varchar("payment_method_id", { length: 64 }),
    paymentTypeId: varchar("payment_type_id", { length: 64 }),
    currency: varchar("currency", { length: 8 }),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("mp_payments_date_approved_idx").on(t.dateApproved),
    index("mp_payments_external_ref_idx").on(t.externalReference),
  ],
);

export const mpSyncLogs = pgTable(
  "mp_sync_logs",
  {
    id: serial("id").primaryKey(),
    source: mpSyncSourceEnum("source").notNull().default("manual"),
    status: mpSyncStatusEnum("status").notNull().default("running"),
    dateFrom: timestamp("date_from", { withTimezone: true }).notNull(),
    dateTo: timestamp("date_to", { withTimezone: true }).notNull(),
    paymentsFetched: integer("payments_fetched").notNull().default(0),
    paymentsUpserted: integer("payments_upserted").notNull().default(0),
    totalFees: numeric("total_fees", { precision: 14, scale: 2 }),
    errorMessage: text("error_message"),
    executionTimeMs: integer("execution_time_ms"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("mp_sync_logs_started_at_idx").on(t.startedAt)],
);

// Contas Meta Ads descobertas via /me/adaccounts.
// O campo `enabled` é controlado pelo usuário na UI e decide quais contas
// participam do sync.
export const metaAdAccounts = pgTable("meta_ad_accounts", {
  id: varchar("id", { length: 64 }).primaryKey(), // formato "act_X"
  name: varchar("name", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 8 }),
  accountStatus: integer("account_status"),
  enabled: boolean("enabled").notNull().default(false),
  discoveredAt: timestamp("discovered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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

// Snapshot do estado atual de cada pedido segundo o DSers.
// 1 linha por dsers_order_id. UPSERT — mantém first_seen_at, atualiza last_seen_at.
// Independente da tabela `orders`: se a API quebrar, esta tabela preserva
// tudo o que o DSers já entregou (pode ser usada para recuperar custos perdidos).
export const dsersOrders = pgTable(
  "dsers_orders",
  {
    dsersOrderId: varchar("dsers_order_id", { length: 64 }).primaryKey(),
    orderName: varchar("order_name", { length: 64 }),
    productCostCents: integer("product_cost_cents"),
    shippingCostCents: integer("shipping_cost_cents"),
    totalCostCents: integer("total_cost_cents"),
    rawJson: jsonb("raw_json"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSyncId: integer("last_sync_id"),
  },
  (t) => [
    index("dsers_orders_order_name_idx").on(t.orderName),
    index("dsers_orders_last_seen_idx").on(t.lastSeenAt),
  ],
);

// Histórico append-only de mudanças no cogsAmount de cada pedido.
// Permite reconstruir o valor em qualquer ponto no tempo + auditar origem
// de cada alteração. Nunca é atualizado, só inserido.
export const orderCogsHistory = pgTable(
  "order_cogs_history",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    cogsAmount: numeric("cogs_amount", { precision: 12, scale: 2 }),
    cogsSource: varchar("cogs_source", { length: 32 }),
    changeReason: cogsChangeReasonEnum("change_reason").notNull(),
    syncLogId: integer("sync_log_id"),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("order_cogs_history_order_idx").on(t.orderId),
    index("order_cogs_history_changed_at_idx").on(t.changedAt),
  ],
);

// Sessões diárias obtidas via ShopifyQL Analytics API.
// 1 linha por data. Upsert diário — o cron sync-sessions popula isso.
export const dailySessions = pgTable(
  "daily_sessions",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    sessions: integer("sessions").notNull().default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_sessions_date_key").on(t.date),
    index("daily_sessions_date_idx").on(t.date),
  ],
);

export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderAttribution = typeof orderAttribution.$inferSelect;
export type UtmParameter = typeof utmParameters.$inferSelect;
export type ChannelGoal = typeof channelGoals.$inferSelect;
export type MonthlyGoal = typeof monthlyGoals.$inferSelect;
export type DailyWeight = typeof dailyWeights.$inferSelect;
export type ExtractionLog = typeof extractionLogs.$inferSelect;
export type CogsSyncLog = typeof cogsSyncLogs.$inferSelect;
export type MpPayment = typeof mpPayments.$inferSelect;
export type MpSyncLog = typeof mpSyncLogs.$inferSelect;
export type AdsInsight = typeof adsInsights.$inferSelect;
export type MetaAdAccount = typeof metaAdAccounts.$inferSelect;
export type ServiceToken = typeof serviceTokens.$inferSelect;
export type DsersOrderRecord = typeof dsersOrders.$inferSelect;
export type OrderCogsHistoryRecord = typeof orderCogsHistory.$inferSelect;
export type DailySession = typeof dailySessions.$inferSelect;
