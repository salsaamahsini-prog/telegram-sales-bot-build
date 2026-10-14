import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core"

export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  botName: text("bot_name").notNull().default("TeleStore AutoOrder Bot"),
  botUsername: text("bot_username").notNull().default("telestore_autobot"),
  botToken: text("bot_token").notNull().default(""),
  adminTelegramId: text("admin_telegram_id").notNull().default("682910442"),
  adminUsername: text("admin_username").notNull().default("bos_store"),
  qrisMerchantName: text("qris_merchant_name")
    .notNull()
    .default("TELESTORE DIGITAL ID"),
  qrisNmid: text("qris_nmid").notNull().default("ID1024319884210"),
  qrisString: text("qris_string")
    .notNull()
    .default(
      "00020101021126610014COM.GO-JEK.WWW01189360091431988421020215ID10243198842100303UMI51440014ID.CO.QRIS.WWW0215ID10243198842100303UMI5204581553033605802ID5920GARUDA DIGITAL STORE6007JAKARTA61051219063042C94"
    ),
  welcomeMessage: text("welcome_message")
    .notNull()
    .default(
      "Selamat datang di TeleStore Auto-Order Bot! Semua produk digital dikirim otomatis detik itu juga setelah pembayaran QRIS atau Saldo terverifikasi."
    ),
  autoDeliveryEnabled: boolean("auto_delivery_enabled").notNull().default(true),
  qrisUniqueCodeEnabled: boolean("qris_unique_code_enabled")
    .notNull()
    .default(true),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  originalPrice: integer("original_price").notNull().default(0),
  description: text("description").notNull(),
  termsInstructions: text("terms_instructions").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  soldCount: integer("sold_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
})

export const productStocks = pgTable("product_stocks", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  productCode: text("product_code").notNull(),
  credentials: text("credentials").notNull(),
  status: text("status").notNull().default("available"), // available | sold
  orderInvoice: text("order_invoice"),
  buyerTelegramId: text("buyer_telegram_id"),
  soldAt: timestamp("sold_at"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const botUsers = pgTable("bot_users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username").notNull(),
  fullName: text("full_name").notNull(),
  balance: integer("balance").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  role: text("role").notNull().default("member"), // member | reseller | vip
  isBanned: boolean("is_banned").notNull().default(false),
  joinedAt: timestamp("joined_at").defaultNow(),
})

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().unique(),
  telegramId: text("telegram_id").notNull(),
  buyerUsername: text("buyer_username").notNull(),
  buyerName: text("buyer_name").notNull(),
  productId: integer("product_id").notNull(),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(),
  uniqueCode: integer("unique_code").notNull().default(0),
  totalAmount: integer("total_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // QRIS | BALANCE
  status: text("status").notNull().default("pending"), // pending | paid | cancelled
  deliveredContent: text("delivered_content"),
  createdAt: timestamp("created_at").defaultNow(),
  paidAt: timestamp("paid_at"),
})

export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  depositId: text("deposit_id").notNull().unique(),
  telegramId: text("telegram_id").notNull(),
  username: text("username").notNull(),
  fullName: text("full_name").notNull(),
  amount: integer("amount").notNull(),
  uniqueCode: integer("unique_code").notNull().default(0),
  totalTransfer: integer("total_transfer").notNull(),
  method: text("method").notNull().default("QRIS"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
})

export const qrisMutations = pgTable("qris_mutations", {
  id: serial("id").primaryKey(),
  sourceApp: text("source_app").notNull().default("GoPay Merchant"),
  rawNotification: text("raw_notification").notNull(),
  amount: integer("amount").notNull(),
  matchedReference: text("matched_reference"),
  status: text("status").notNull().default("matched"), // matched | unmatched
  createdAt: timestamp("created_at").defaultNow(),
})
