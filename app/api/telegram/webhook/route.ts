import { NextRequest, NextResponse } from "next/server"
import { processBotInteraction } from "@/lib/bot-engine"
import { db } from "@/lib/db"
import { botSettings } from "@/lib/db/schema"

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()

    // Extract message or callback_query from Telegram Update payload
    const message = update.message
    const callbackQuery = update.callback_query

    let chatId: string | null = null
    let telegramId = "998877665"
    let username = "user_telegram"
    let fullName = "Telegram User"
    let input = "/start"

    if (callbackQuery) {
      chatId = String(callbackQuery.message?.chat?.id || callbackQuery.from?.id)
      telegramId = String(callbackQuery.from?.id || chatId)
      username = callbackQuery.from?.username || "user_telegram"
      fullName =
        [callbackQuery.from?.first_name, callbackQuery.from?.last_name]
          .filter(Boolean)
          .join(" ") || "Telegram User"
      input = callbackQuery.data || "/start"
    } else if (message) {
      chatId = String(message.chat?.id || message.from?.id)
      telegramId = String(message.from?.id || chatId)
      username = message.from?.username || "user_telegram"
      fullName =
        [message.from?.first_name, message.from?.last_name]
          .filter(Boolean)
          .join(" ") || "Telegram User"
      input = message.text || "/start"
    }

    if (!chatId) {
      return NextResponse.json({ ok: true, note: "Ignored non-chat update" })
    }

    const reply = await processBotInteraction({
      telegramId,
      username,
      fullName,
      input,
    })

    // Check if botToken is configured in DB or env to send real Telegram HTTP reply
    const [settings] = await db.select().from(botSettings).limit(1)
    const token = settings?.botToken || process.env.TELEGRAM_BOT_TOKEN

    if (token) {
      const replyMarkup = reply.inlineKeyboard
        ? {
            inline_keyboard: reply.inlineKeyboard.map((row) =>
              row.map((btn) => ({
                text: btn.text,
                callback_data: btn.callbackData,
              }))
            ),
          }
        : undefined

      if (callbackQuery?.id) {
        await fetch(
          `https://api.telegram.org/bot${token}/answerCallbackQuery`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callbackQuery.id }),
          }
        )
      }

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply.text,
          parse_mode: "Markdown",
          reply_markup: replyMarkup,
        }),
      })
    }

    return NextResponse.json({
      ok: true,
      reply,
    })
  } catch (error) {
    console.error("[v0] Telegram webhook error:", error)
    return NextResponse.json(
      { ok: false, error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/telegram/webhook",
    status: "Active — Ready to receive Telegram Bot updates via POST",
  })
}
