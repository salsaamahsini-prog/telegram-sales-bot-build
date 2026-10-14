"use server"

import { db } from "@/lib/db"
import {
  botSettings,
  products,
  productStocks,
  botUsers,
  orders,
  deposits,
} from "@/lib/db/schema"
import {
  processBotInteraction,
  processIncomingQrisMutation,
} from "@/lib/bot-engine"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function sendSimulatorCommandAction(params: {
  telegramId?: string
  username?: string
  fullName?: string
  input: string
}) {
  const response = await processBotInteraction({
    telegramId: params.telegramId || "998877665",
    username: params.username || "pembeli_simulator",
    fullName: params.fullName || "Rizky Pratama (Simulator)",
    input: params.input,
  })
  revalidatePath("/")
  return response
}

export async function createProductAction(input: {
  code: string
  name: string
  category: string
  price: number
  originalPrice: number
  description: string
  termsInstructions: string
  initialStocks?: string
}) {
  const cleanCode = input.code.trim().toUpperCase().replace(/\s+/g, "")
  const [created] = await db
    .insert(products)
    .values({
      code: cleanCode,
      name: input.name.trim(),
      category: input.category.trim(),
      price: Number(input.price),
      originalPrice: Number(input.originalPrice || input.price),
      description: input.description.trim(),
      termsInstructions:
        input.termsInstructions.trim() ||
        "Garansi penuh sesuai durasi. Dilarang mengubah data utama akun.",
      isActive: true,
      soldCount: 0,
    })
    .returning()

  if (input.initialStocks && input.initialStocks.trim().length > 0) {
    const lines = input.initialStocks
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length > 0) {
      await db.insert(productStocks).values(
        lines.map((cred) => ({
          productId: created.id,
          productCode: created.code,
          credentials: cred,
          status: "available",
        }))
      )
    }
  }

  revalidatePath("/")
  return { ok: true, product: created }
}

export async function toggleProductActiveAction(
  productId: number,
  isActive: boolean
) {
  await db
    .update(products)
    .set({ isActive })
    .where(eq(products.id, productId))
  revalidatePath("/")
  return { ok: true }
}

export async function deleteProductAction(productId: number) {
  await db.delete(productStocks).where(eq(productStocks.productId, productId))
  await db.delete(products).where(eq(products.id, productId))
  revalidatePath("/")
  return { ok: true }
}

export async function bulkAddStockAction(input: {
  productId: number
  rawCredentials: string
}) {
  const [prod] = await db
    .select()
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1)

  if (!prod) throw new Error("Produk tidak ditemukan")

  const lines = input.rawCredentials
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    throw new Error("Masukkan minimal 1 baris data akun/voucher")
  }

  await db.insert(productStocks).values(
    lines.map((cred) => ({
      productId: prod.id,
      productCode: prod.code,
      credentials: cred,
      status: "available",
    }))
  )

  revalidatePath("/")
  return { ok: true, addedCount: lines.length }
}

export async function deleteStockItemAction(stockId: number) {
  await db.delete(productStocks).where(eq(productStocks.id, stockId))
  revalidatePath("/")
  return { ok: true }
}

export async function approvePendingOrderAction(invoiceId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.invoiceId, invoiceId))
    .limit(1)

  if (!order || order.status === "paid") {
    return { ok: false, message: "Order sudah lunas atau tidak ditemukan" }
  }

  // Trigger the exact same auto-delivery logic
  await processBotInteraction({
    telegramId: order.telegramId,
    username: order.buyerUsername,
    fullName: order.buyerName,
    input: `SIMULATE_PAY:${invoiceId}`,
  })

  revalidatePath("/")
  return { ok: true }
}

export async function approveDepositAction(depositId: string) {
  const [dep] = await db
    .select()
    .from(deposits)
    .where(eq(deposits.depositId, depositId))
    .limit(1)

  if (!dep || dep.status === "approved") {
    return { ok: false, message: "Deposit sudah diapprove" }
  }

  await processBotInteraction({
    telegramId: dep.telegramId,
    username: dep.username,
    fullName: dep.fullName,
    input: `SIMULATE_DEPOSIT:${depositId}`,
  })

  revalidatePath("/")
  return { ok: true }
}

export async function adjustUserBalanceAction(input: {
  telegramId: string
  amountDelta: number
  role?: string
}) {
  const [user] = await db
    .select()
    .from(botUsers)
    .where(eq(botUsers.telegramId, input.telegramId))
    .limit(1)

  if (!user) throw new Error("User tidak ditemukan")

  const nextBalance = Math.max(0, user.balance + Number(input.amountDelta))
  await db
    .update(botUsers)
    .set({
      balance: nextBalance,
      role: input.role || user.role,
    })
    .where(eq(botUsers.id, user.id))

  revalidatePath("/")
  return { ok: true, newBalance: nextBalance }
}

export async function updateBotSettingsAction(input: {
  botName: string
  botUsername: string
  botToken: string
  adminTelegramId: string
  adminUsername: string
  qrisMerchantName: string
  qrisNmid: string
  qrisString: string
  welcomeMessage: string
  autoDeliveryEnabled: boolean
  qrisUniqueCodeEnabled: boolean
  maintenanceMode: boolean
}) {
  const [existing] = await db.select().from(botSettings).limit(1)

  if (existing) {
    await db
      .update(botSettings)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(botSettings.id, existing.id))
  } else {
    await db.insert(botSettings).values(input)
  }

  revalidatePath("/")
  return { ok: true }
}

export async function connectTelegramWebhookAction(
  botToken: string,
  webhookUrl: string
) {
  const cleanToken = botToken.trim()
  if (!cleanToken) {
    return { ok: false, message: "Masukkan Bot Token dari @BotFather terlebih dahulu." }
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${cleanToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"],
        }),
      }
    )
    const data = await res.json()
    if (data.ok) {
      const [existing] = await db.select().from(botSettings).limit(1)
      if (existing) {
        await db
          .update(botSettings)
          .set({ botToken: cleanToken, updatedAt: new Date() })
          .where(eq(botSettings.id, existing.id))
      }
      revalidatePath("/")
      return {
        ok: true,
        message: `Webhook berhasil terhubung ke Telegram API: ${data.description || "OK"}`,
      }
    }
    return {
      ok: false,
      message: `Gagal setWebhook: ${data.description || "Token tidak valid"}`,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error"
    return { ok: false, message: `Error koneksi ke api.telegram.org: ${msg}` }
  }
}

export async function simulateQrisMutationWebhookAction(input: {
  rawNotification: string
  sourceApp: string
  amountOverride?: number
}) {
  const res = await processIncomingQrisMutation(input)
  revalidatePath("/")
  return res
}

export async function saveStaticQrisConfigAction(input: {
  qrisString: string
  qrisMerchantName: string
  qrisNmid: string
  qrisUniqueCodeEnabled: boolean
}) {
  const [existing] = await db.select().from(botSettings).limit(1)
  if (existing) {
    await db
      .update(botSettings)
      .set({
        qrisString: input.qrisString.trim(),
        qrisMerchantName: input.qrisMerchantName.trim(),
        qrisNmid: input.qrisNmid.trim(),
        qrisUniqueCodeEnabled: input.qrisUniqueCodeEnabled,
        updatedAt: new Date(),
      })
      .where(eq(botSettings.id, existing.id))
  }
  revalidatePath("/")
  return { ok: true }
}

