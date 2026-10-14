import { NextRequest, NextResponse } from "next/server"
import { processIncomingQrisMutation } from "@/lib/bot-engine"

/**
 * Webhook Endpoint Auto-Cek Mutasi QRIS Statis
 * Mendukung:
 * 1. Android Notification Forwarder / MacroDroid / Tasker (GoPay Merchant, DANA Bisnis, ShopeePay, SeaBank, BCA, Livin, OrderKuota)
 * 2. Callback OrderKuota / OkeConnect / Custom Poller
 *
 * Contoh Payload JSON POST:
 * {
 *   "app": "GoPay Merchant",
 *   "text": "Pembayaran QRIS Rp 35.142 berhasil diterima di GARUDA DIGITAL STORE",
 *   "amount": 35142
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const rawNotification =
      body.text ||
      body.notification ||
      body.message ||
      body.title ||
      body.content ||
      (body.amount ? `Mutasi QRIS Masuk Rp ${body.amount}` : "")

    const sourceApp =
      body.app ||
      body.source ||
      body.package ||
      "Android Notification Forwarder"

    const amountOverride =
      typeof body.amount === "number"
        ? body.amount
        : typeof body.nominal === "number"
          ? body.nominal
          : undefined

    const result = await processIncomingQrisMutation({
      rawNotification: String(rawNotification),
      sourceApp: String(sourceApp),
      amountOverride,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] QRIS Mutasi Webhook Error:", error)
    return NextResponse.json(
      { ok: false, error: "Gagal memproses mutasi QRIS" },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const text = searchParams.get("text") || searchParams.get("msg") || ""
  const app = searchParams.get("app") || "MacroDroid GET Webhook"
  const amountParam = searchParams.get("amount")

  if (!text && !amountParam) {
    return NextResponse.json({
      ok: true,
      endpoint: "/api/qris/mutasi",
      status: "READY",
      description:
        "Endpoint Auto-Mutasi QRIS Statis aktif! Kirim POST JSON { text, app } dari Notification Forwarder / MacroDroid atau GET ?text=Pembayaran+Rp+35.142",
    })
  }

  const result = await processIncomingQrisMutation({
    rawNotification: text || `Mutasi QRIS Rp ${amountParam}`,
    sourceApp: app,
    amountOverride: amountParam ? parseInt(amountParam, 10) : undefined,
  })

  return NextResponse.json(result)
}
