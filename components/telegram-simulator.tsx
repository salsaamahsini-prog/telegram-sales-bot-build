"use client"

import * as React from "react"
import QRCode from "qrcode"
import { sendSimulatorCommandAction } from "@/app/actions/store-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  SendIcon,
  BotIcon,
  UserIcon,
  QrCodeIcon,
  CheckCircle2Icon,
  SparklesIcon,
  CopyIcon,
  RotateCcwIcon,
  WalletIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { toast } from "sonner"
import type { BotResponsePayload, InlineButton } from "@/lib/bot-engine"

interface ChatMessage {
  id: string
  sender: "user" | "bot"
  text: string
  timestamp: string
  inlineKeyboard?: InlineButton[][]
  qrisCard?: BotResponsePayload["qrisCard"]
  deliveredCredentials?: BotResponsePayload["deliveredCredentials"]
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function renderFormattedText(raw: string) {
  const lines = raw.split("\n")
  return lines.map((line, idx) => {
    const parts = line.split(/(\*[^*]+\*|`[^`]+`|~[^~]+~)/g)
    return (
      <React.Fragment key={idx}>
        {parts.map((part, pIdx) => {
          if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return (
              <strong key={pIdx} className="font-semibold text-foreground">
                {part.slice(1, -1)}
              </strong>
            )
          }
          if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
            return (
              <code
                key={pIdx}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary"
              >
                {part.slice(1, -1)}
              </code>
            )
          }
          if (part.startsWith("~") && part.endsWith("~") && part.length > 2) {
            return (
              <span key={pIdx} className="line-through text-muted-foreground">
                {part.slice(1, -1)}
              </span>
            )
          }
          return <span key={pIdx}>{part}</span>
        })}
        {idx < lines.length - 1 && <br />}
      </React.Fragment>
    )
  })
}

function DynamicQrisImage({
  payload,
  nmid,
}: {
  payload: string
  nmid: string
}) {
  const [url, setUrl] = React.useState<string>("")
  React.useEffect(() => {
    let mounted = true
    QRCode.toDataURL(payload || "QRIS", {
      width: 140,
      margin: 1,
      color: { dark: "#111827", light: "#FFFFFF" },
    })
      .then((res) => {
        if (mounted) setUrl(res)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [payload])

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-foreground/15 bg-white p-2 shrink-0">
      {url ? (
        <img
          src={url}
          alt="QRIS Dinamis"
          className="size-28 rounded-xs bg-white"
        />
      ) : (
        <div className="size-28 bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-500">
          QRIS...
        </div>
      )}
      <span className="mt-1 font-mono text-[9px] font-bold text-neutral-700">
        NMID: {nmid.slice(0, 14)}
      </span>
    </div>
  )
}

export function TelegramSimulator({
  botName,
  botUsername,
  simulatorUserBalance,
  onStateChange,
}: {
  botName: string
  botUsername: string
  simulatorUserBalance: number
  onStateChange: () => void
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => [
    {
      id: "init-bot-welcome",
      sender: "bot",
      text: [
        `*${botName || "GarudaStore AutoOrder Bot"}*`,
        `Selamat datang di GarudaStore Auto-Order Bot! Semua pesanan akun premium, lisensi, dan source code dikirim otomatis 24 jam nonstop detik itu juga setelah pembayaran QRIS atau Saldo Deposit berhasil.`,
        ``,
        `*Informasi Akun Kamu:*`,
        `• ID Telegram : \`998877665\``,
        `• Username : @pembeli_simulator`,
        `• Status Member : *VIP*`,
        `• Saldo Deposit : *${formatRupiah(simulatorUserBalance)}*`,
        ``,
        `Silakan pilih menu di bawah ini untuk mulai berbelanja:`,
      ].join("\n"),
      timestamp: "Live",
      inlineKeyboard: [
        [
          { text: "Katalog Produk & Beli", callbackData: "/katalog" },
          { text: "Cek Stok Real-Time", callbackData: "/stok" },
        ],
        [
          { text: "Top-Up Saldo QRIS", callbackData: "/topup" },
          { text: "Cek Saldo & Profil", callbackData: "/saldo" },
        ],
        [
          { text: "Riwayat Pesanan", callbackData: "/riwayat" },
          { text: "Panduan Order", callbackData: "/caraorder" },
        ],
      ],
    },
  ])
  const [inputText, setInputText] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const onStateChangeRef = React.useRef(onStateChange)
  React.useEffect(() => {
    onStateChangeRef.current = onStateChange
  }, [onStateChange])

  const scrollToBottom = React.useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  const triggerBotCommand = React.useCallback(
    async (command: string, labelForUserBubble?: string) => {
      const nowTime = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })

      const userMsg: ChatMessage = {
        id: `usr-${Date.now()}-${Math.random()}`,
        sender: "user",
        text: labelForUserBubble || command,
        timestamp: nowTime,
      }

      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)
      scrollToBottom()

      try {
        const res = await sendSimulatorCommandAction({
          telegramId: "998877665",
          username: "pembeli_simulator",
          fullName: "Rizky Pratama (Simulator)",
          input: command,
        })

        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}-${Math.random()}`,
          sender: "bot",
          text: res.text,
          timestamp: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          inlineKeyboard: res.inlineKeyboard,
          qrisCard: res.qrisCard,
          deliveredCredentials: res.deliveredCredentials,
        }

        setMessages((prev) => [...prev, botMsg])
        onStateChangeRef.current()
        scrollToBottom()
      } catch (err) {
        toast.error("Gagal memproses perintah bot")
      } finally {
        setIsLoading(false)
      }
    },
    [scrollToBottom]
  )

  const handleSendForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || isLoading) return
    const cmd = inputText.trim()
    setInputText("")
    await triggerBotCommand(cmd, cmd)
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-xs overflow-hidden h-[680px]">
      {/* Telegram Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
            <BotIcon className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {botName || "GarudaStore AutoOrder Bot"}
              </h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                bot resmi
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              @{botUsername || "garudastore_bot"} • Auto-Delivery 24 Jam Aktif
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
            <WalletIcon className="size-3.5 text-primary" />
            <span className="text-muted-foreground">Saldo Simulator:</span>
            <span className="font-semibold text-foreground">
              {formatRupiah(simulatorUserBalance)}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMessages([])
              setTimeout(() => triggerBotCommand("/start", "/start"), 50)
            }}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Reset Chat
          </Button>
        </div>
      </div>

      {/* Quick Slash Command Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-muted/20 px-3 py-2 text-xs">
        <span className="text-muted-foreground font-medium shrink-0 mr-1">
          Shortcut:
        </span>
        {[
          { cmd: "/start", label: "/start (Menu)" },
          { cmd: "/katalog", label: "/katalog (Beli Produk)" },
          { cmd: "/stok", label: "/stok (Cek Gudang)" },
          { cmd: "/saldo", label: "/saldo (Dompet)" },
          { cmd: "/topup", label: "/topup (Isi QRIS)" },
          { cmd: "/riwayat", label: "/riwayat (Orderan)" },
        ].map((item) => (
          <button
            key={item.cmd}
            type="button"
            disabled={isLoading}
            onClick={() => triggerBotCommand(item.cmd, item.cmd)}
            className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Chat Transcript Viewport */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-muted/10"
      >
        {messages.map((m) => {
          const isUser = m.sender === "user"
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div className="flex items-end gap-2 max-w-[92%] sm:max-w-[85%]">
                {!isUser && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <BotIcon className="size-4" />
                  </div>
                )}

                <div className="flex flex-col gap-1.5 w-full">
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "bg-card border border-border text-card-foreground rounded-bl-xs"
                    }`}
                  >
                    <div className="break-words">
                      {isUser ? m.text : renderFormattedText(m.text)}
                    </div>

                    {/* Visual QRIS Card inside Bot Message */}
                    {m.qrisCard && (
                      <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3 text-foreground">
                        <div className="flex items-center justify-between border-b border-border pb-2 mb-2.5">
                          <div className="flex items-center gap-1.5">
                            <QrCodeIcon className="size-4 text-primary" />
                            <span className="font-semibold text-xs uppercase tracking-wider">
                              QRIS National Payment
                            </span>
                          </div>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {m.qrisCard.referenceId}
                          </Badge>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <DynamicQrisImage
                            payload={m.qrisCard.qrisString}
                            nmid={m.qrisCard.nmid}
                          />

                          <div className="flex-1 flex flex-col gap-1 text-xs w-full">
                            <div className="font-semibold text-foreground">
                              {m.qrisCard.merchantName}
                            </div>
                            <div className="text-muted-foreground">
                              Item: {m.qrisCard.itemName}
                            </div>
                            <div className="mt-1 rounded-lg bg-background border border-border p-2 flex flex-col gap-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-muted-foreground">
                                  Nominal Dasar:
                                </span>
                                <span>{formatRupiah(m.qrisCard.baseAmount)}</span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-muted-foreground">
                                  Kode Unik Otomatis:
                                </span>
                                <span className="font-mono font-semibold text-primary">
                                  +{m.qrisCard.uniqueCode}
                                </span>
                              </div>
                              <div className="border-t border-border pt-1 flex justify-between font-semibold text-xs">
                                <span>Total Transfer:</span>
                                <span className="text-primary font-mono">
                                  {formatRupiah(m.qrisCard.totalAmount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Auto-Delivered Account Credentials Card */}
                    {m.deliveredCredentials && (
                      <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-foreground">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                            <ShieldCheckIcon className="size-4" />
                            <span>Auto-Delivery Berhasil Terkirim</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                m.deliveredCredentials!.credentials
                              )
                              toast.success(
                                "Data akun/voucher berhasil disalin ke clipboard!"
                              )
                            }}
                          >
                            <CopyIcon data-icon="inline-start" />
                            Salin Akun
                          </Button>
                        </div>
                        <div className="rounded-lg bg-background border border-border p-2.5 font-mono text-xs break-all select-all">
                          {m.deliveredCredentials.credentials}
                        </div>
                      </div>
                    )}

                    <div
                      className={`mt-1 text-right text-[10px] ${
                        isUser
                          ? "text-primary-foreground/75"
                          : "text-muted-foreground"
                      }`}
                    >
                      {m.timestamp}
                    </div>
                  </div>

                  {/* Telegram Inline Keyboard Buttons */}
                  {!isUser && m.inlineKeyboard && m.inlineKeyboard.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {m.inlineKeyboard.map((row, rIdx) => (
                        <div
                          key={rIdx}
                          className="grid gap-1.5"
                          style={{
                            gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {row.map((btn, bIdx) => {
                            const isSimulatePay =
                              btn.callbackData.startsWith("SIMULATE_") ||
                              btn.callbackData.startsWith("BUY_BALANCE:")
                            return (
                              <button
                                key={bIdx}
                                type="button"
                                disabled={isLoading}
                                onClick={() =>
                                  triggerBotCommand(btn.callbackData, btn.text)
                                }
                                className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all active:scale-[0.99] disabled:opacity-50 ${
                                  isSimulatePay
                                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-semibold"
                                    : "border-border bg-card/90 text-foreground hover:bg-accent hover:text-accent-foreground"
                                }`}
                              >
                                {isSimulatePay && (
                                  <SparklesIcon className="size-3.5 shrink-0" />
                                )}
                                <span className="truncate">{btn.text}</span>
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <UserIcon className="size-4" />
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
            <span className="inline-block size-2 rounded-full bg-primary animate-ping" />
            <span>Bot sedang memproses & mengecek database gudang...</span>
          </div>
        )}
      </div>

      {/* Message Composer */}
      <form
        onSubmit={handleSendForm}
        className="flex items-center gap-2 border-t border-border bg-card p-3"
      >
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              (e.nativeEvent.isComposing || e.keyCode === 229)
            ) {
              e.preventDefault()
            }
          }}
          placeholder="Ketik perintah bot (/katalog, /stok, /topup 50000) atau klik tombol di atas..."
          disabled={isLoading}
          className="flex-1 text-sm"
        />
        <Button type="submit" disabled={isLoading || !inputText.trim()}>
          <SendIcon data-icon="inline-start" />
          Kirim
        </Button>
      </form>
    </div>
  )
}
