"use client"

import * as React from "react"
import {
  updateBotSettingsAction,
  connectTelegramWebhookAction,
} from "@/app/actions/store-actions"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  CopyIcon,
  DownloadIcon,
  WebhookIcon,
  Code2Icon,
  Settings2Icon,
  CheckCircle2Icon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"

export interface BotSettingsData {
  id: number
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
}

export function SourceCodeGenerator({
  settings,
  onMutate,
}: {
  settings: BotSettingsData
  onMutate: () => void
}) {
  const [form, setForm] = React.useState<BotSettingsData>(settings)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isConnectingWebhook, setIsConnectingWebhook] = React.useState(false)
  const [originUrl, setOriginUrl] = React.useState(
    "https://nama-project-kamu.vercel.app"
  )

  React.useEffect(() => {
    if (settings) {
      setForm(settings)
    }
  }, [settings])

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOriginUrl(window.location.origin)
    }
  }, [])

  const webhookEndpoint = `${originUrl}/api/telegram/webhook`

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await updateBotSettingsAction(form)
      toast.success("Konfigurasi Bot & QRIS berhasil disimpan ke database!")
      onMutate()
    } catch (err) {
      toast.error("Gagal menyimpan pengaturan")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetWebhook = async () => {
    if (!form.botToken.trim()) {
      toast.error("Masukkan Bot Token dari @BotFather terlebih dahulu!")
      return
    }
    setIsConnectingWebhook(true)
    try {
      const res = await connectTelegramWebhookAction(
        form.botToken,
        webhookEndpoint
      )
      if (res.ok) {
        toast.success(res.message)
        onMutate()
      } else {
        toast.error(res.message)
      }
    } finally {
      setIsConnectingWebhook(false)
    }
  }

  const standaloneTelegrafCode = `/**
 * ============================================================================
 * SOURCE CODE BOT AUTO-ORDER TELEGRAM + QRIS + SALDO DEPOSIT (TELEGRAF + PG)
 * Generated from: ${form.botName} (@${form.botUsername})
 * Admin: @${form.adminUsername} (ID: ${form.adminTelegramId})
 * Merchant QRIS: ${form.qrisMerchantName} (NMID: ${form.qrisNmid})
 * ============================================================================
 * Cara Menjalankan di VPS / Lokal:
 * 1. npm init -y && npm install telegraf pg dotenv
 * 2. Buat file .env berisi:
 *    BOT_TOKEN=${form.botToken || "ISI_TOKEN_BOTFATHER_KAMU"}
 *    DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
 * 3. Jalankan: node bot.js
 */

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');

const bot = new Telegraf(process.env.BOT_TOKEN || '${form.botToken || "YOUR_BOT_TOKEN"}');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const formatRp = (num) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0
}).format(num);

// Pastikan user terdaftar di tabel bot_users
async function getOrCreateUser(ctx) {
  const tgId = String(ctx.from.id);
  const username = ctx.from.username || 'tanpa_username';
  const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Telegram User';

  const { rows } = await pool.query('SELECT * FROM bot_users WHERE telegram_id = $1 LIMIT 1', [tgId]);
  if (rows.length > 0) return rows[0];

  const insert = await pool.query(
    'INSERT INTO bot_users (telegram_id, username, full_name, balance, role) VALUES ($1, $2, $3, 0, $4) RETURNING *',
    [tgId, username, fullName, 'member']
  );
  return insert.rows[0];
}

// Command: /start
bot.start(async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const prodCount = await pool.query('SELECT COUNT(*) FROM products WHERE is_active = true');
  const stockCount = await pool.query("SELECT COUNT(*) FROM product_stocks WHERE status = 'available'");

  const msg = [
    '*${form.botName}*',
    '${form.welcomeMessage.replace(/'/g, "\\'")}',
    '',
    '*Informasi Akun Kamu:*',
    '• ID Telegram : \`' + user.telegram_id + '\`',
    '• Username : @' + user.username,
    '• Saldo Deposit : *' + formatRp(user.balance) + '*',
    '• Total Order : *' + user.total_orders + 'x Transaksi*',
    '',
    '*Statistik Toko Live:*',
    '• Produk Aktif : *' + prodCount.rows[0].count + ' Produk*',
    '• Stok Siap Kirim : *' + stockCount.rows[0].count + ' Akun/Voucher*'
  ].join('\\n');

  return ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
    [Markup.button.callback('Katalog Produk & Beli', 'MENU_KATALOG'), Markup.button.callback('Cek Stok Live', 'MENU_STOK')],
    [Markup.button.callback('Top-Up Saldo QRIS', 'MENU_TOPUP'), Markup.button.callback('Dompet Saldo', 'MENU_SALDO')],
    [Markup.button.callback('Riwayat Order', 'MENU_RIWAYAT')]
  ]));
});

// Menu Katalog & Pembelian Instan
bot.command('katalog', async (ctx) => sendCatalog(ctx));
bot.action('MENU_KATALOG', async (ctx) => {
  await ctx.answerCbQuery();
  return sendCatalog(ctx);
});

async function sendCatalog(ctx) {
  const { rows: products } = await pool.query('SELECT * FROM products WHERE is_active = true ORDER BY id ASC');
  const { rows: stocks } = await pool.query("SELECT product_id, COUNT(*) as cnt FROM product_stocks WHERE status = 'available' GROUP BY product_id");
  const stockMap = Object.fromEntries(stocks.map(s => [s.product_id, Number(s.cnt)]));

  let text = '*KATALOG PRODUK DIGITAL AUTO-DELIVERY*\\n━━━━━━━━━━━━━━━━━━━━━━\\n';
  const buttons = [];

  for (const p of products) {
    const sisa = stockMap[p.id] || 0;
    text += \`*[\${p.code}] \${p.name}*\\n├ Harga: *\${formatRp(p.price)}*\\n└ Stok Ready: *\${sisa} akun*\\n\\n\`;
    buttons.push([Markup.button.callback(\`Beli \${p.name} (\${formatRp(p.price)}) [\${sisa}]\`, \`DETAIL:\${p.code}\`)]);
  }

  return ctx.replyWithMarkdown(text, Markup.inlineKeyboard(buttons));
}

// Detail Produk & Checkout
bot.action(/^DETAIL:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const code = ctx.match[1];
  const user = await getOrCreateUser(ctx);
  const { rows } = await pool.query('SELECT * FROM products WHERE code = $1 LIMIT 1', [code]);
  if (!rows.length) return ctx.reply('Produk tidak ditemukan.');
  const prod = rows[0];

  const { rows: stk } = await pool.query("SELECT COUNT(*) as cnt FROM product_stocks WHERE product_id = $1 AND status = 'available'", [prod.id]);
  const sisa = Number(stk[0].cnt);

  const text = [
    '*DETAIL PRODUK & CHECKOUT*',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '• Produk : *' + prod.name + '*',
    '• Kode : \`' + prod.code + '\`',
    '• Harga : *' + formatRp(prod.price) + '*',
    '• Stok Tersedia : *' + sisa + ' Akun*',
    '',
    prod.description,
    '',
    '*Saldo Kamu:* *' + formatRp(user.balance) + '*'
  ].join('\\n');

  return ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('Bayar Pakai Saldo (Kirim Detik Ini)', \`BUY_BAL:\${prod.code}\`)],
    [Markup.button.callback('Bayar Pakai QRIS Otomatis', \`BUY_QRIS:\${prod.code}\`)],
    [Markup.button.callback('Kembali ke Katalog', 'MENU_KATALOG')]
  ]));
});

// Auto-Delivery Pembayaran Saldo
bot.action(/^BUY_BAL:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const code = ctx.match[1];
  const user = await getOrCreateUser(ctx);
  const { rows: prods } = await pool.query('SELECT * FROM products WHERE code = $1 LIMIT 1', [code]);
  if (!prods.length) return;
  const prod = prods[0];

  if (user.balance < prod.price) {
    return ctx.replyWithMarkdown(\`*Saldo Tidak Cukup!*\\nHarga: \${formatRp(prod.price)}\\nSaldo kamu: \${formatRp(user.balance)}\`);
  }

  const { rows: avail } = await pool.query(
    "SELECT * FROM product_stocks WHERE product_id = $1 AND status = 'available' ORDER BY id ASC LIMIT 1",
    [prod.id]
  );
  if (!avail.length) return ctx.reply('Maaf, stok produk ini sedang habis.');

  const stockItem = avail[0];
  const invoiceId = 'INV-' + Date.now();

  await pool.query("UPDATE product_stocks SET status = 'sold', order_invoice = $1, buyer_telegram_id = $2, sold_at = NOW() WHERE id = $3", [invoiceId, user.telegram_id, stockItem.id]);
  await pool.query("UPDATE bot_users SET balance = balance - $1, total_spent = total_spent + $1, total_orders = total_orders + 1 WHERE id = $2", [prod.price, user.id]);
  await pool.query(
    "INSERT INTO orders (invoice_id, telegram_id, buyer_username, buyer_name, product_id, product_code, product_name, quantity, unit_price, unique_code, total_amount, payment_method, status, delivered_content, paid_at) VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,0,$8,'BALANCE','paid',$9,NOW())",
    [invoiceId, user.telegram_id, user.username, user.full_name, prod.id, prod.code, prod.name, prod.price, stockItem.credentials]
  );

  return ctx.replyWithMarkdown([
    '*TRANSAKSI LUNAS & PRODUK TERKIRIM OTOMATIS!*',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '• Invoice : \`' + invoiceId + '\`',
    '• Produk : *' + prod.name + '*',
    '• Total Bayar : *' + formatRp(prod.price) + '*',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '*DATA AKUN / VOUCHER KAMU:*',
    '\`' + stockItem.credentials + '\`',
    '━━━━━━━━━━━━━━━━━━━━━━',
    prod.terms_instructions
  ].join('\\n'));
});

// Konversi QRIS Statis ke QRIS Dinamis (EMVCo Tag 54 + CRC16-CCITT)
function calculateCRC16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function makeDynamicQris(staticQris, nominal) {
  const clean = staticQris.trim().slice(0, -4).replace('010211', '010212');
  const amtStr = String(Math.round(nominal));
  const tag54 = '54' + amtStr.length.toString().padStart(2, '0') + amtStr;
  const injected = clean.replace('5802ID', tag54 + '5802ID');
  return injected + calculateCRC16(injected);
}

// Beli Pakai QRIS Statis -> Dinamis + Kode Unik 3 Digit
bot.action(/^BUY_QRIS:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const code = ctx.match[1];
  const user = await getOrCreateUser(ctx);
  const { rows } = await pool.query('SELECT * FROM products WHERE code = $1 LIMIT 1', [code]);
  if (!rows.length) return ctx.reply('Produk tidak ditemukan.');
  const prod = rows[0];

  const uniqueCode = Math.floor(101 + Math.random() * 399);
  const totalAmount = prod.price + uniqueCode;
  const invoiceId = 'INV-' + Date.now();
  const dynamicQris = makeDynamicQris('${form.qrisString}', totalAmount);

  await pool.query(
    "INSERT INTO orders (invoice_id, telegram_id, buyer_username, buyer_name, product_id, product_code, product_name, quantity, unit_price, unique_code, total_amount, payment_method, status) VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,'QRIS','pending')",
    [invoiceId, user.telegram_id, user.username, user.full_name, prod.id, prod.code, prod.name, prod.price, uniqueCode, totalAmount]
  );

  return ctx.replyWithMarkdown([
    '*TAGIHAN QRIS DINAMIS OTOMATIS*',
    '• Invoice : \`' + invoiceId + '\`',
    '• Produk : *' + prod.name + '*',
    '• Kode Unik : *+' + uniqueCode + '*',
    '• *TOTAL TRANSFER : ' + formatRp(totalAmount) + '*',
    '',
    'Payload QRIS Dinamis (Otomatis Terisi Nominal):',
    '\`' + dynamicQris + '\`',
    '',
    'Begitu kamu transfer tepat *' + formatRp(totalAmount) + '*, sistem Auto-Mutasi akan langsung mengirimkan akun ke chat ini detik itu juga!'
  ].join('\\n'));
});

bot.launch().then(() => console.log('Bot Auto-Order Telegram + Auto-Mutasi QRIS berjalan!'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
`

  const handleDownloadScript = () => {
    const blob = new Blob([standaloneTelegrafCode], {
      type: "text/javascript;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sc-bot-autoorder-${form.botUsername || "telegram"}.js`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("File Source Code (bot.js) berhasil didownload!")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Bot & QRIS Settings + Webhook Connector */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2Icon className="size-4 text-primary" />
              Konfigurasi Bot Telegram & QRIS Toko
            </CardTitle>
            <CardDescription>
              Atur identitas bot, nomor merchant QRIS, kode unik otomatis, atau
              hubungkan langsung token @BotFather ke Webhook server ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSettings} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-name">Nama Toko / Bot</Label>
                  <Input
                    id="cfg-name"
                    value={form.botName}
                    onChange={(e) =>
                      setForm({ ...form, botName: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-user">Username Bot (Tanpa @)</Label>
                  <Input
                    id="cfg-user"
                    value={form.botUsername}
                    onChange={(e) =>
                      setForm({ ...form, botUsername: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-token">
                  Telegram Bot Token (Dari @BotFather)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="cfg-token"
                    type="password"
                    placeholder="Contoh: 7182910442:AAHxxx..."
                    value={form.botToken}
                    onChange={(e) =>
                      setForm({ ...form, botToken: e.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isConnectingWebhook}
                    onClick={handleSetWebhook}
                  >
                    <WebhookIcon data-icon="inline-start" />
                    Set Webhook
                  </Button>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Webhook URL aktif:{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono">
                    {webhookEndpoint}
                  </code>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-admin">Username Admin Support</Label>
                  <Input
                    id="cfg-admin"
                    value={form.adminUsername}
                    onChange={(e) =>
                      setForm({ ...form, adminUsername: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-admin-id">ID Telegram Admin</Label>
                  <Input
                    id="cfg-admin-id"
                    value={form.adminTelegramId}
                    onChange={(e) =>
                      setForm({ ...form, adminTelegramId: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-merchant">Nama Merchant QRIS</Label>
                  <Input
                    id="cfg-merchant"
                    value={form.qrisMerchantName}
                    onChange={(e) =>
                      setForm({ ...form, qrisMerchantName: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-nmid">NMID QRIS</Label>
                  <Input
                    id="cfg-nmid"
                    value={form.qrisNmid}
                    onChange={(e) =>
                      setForm({ ...form, qrisNmid: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-qris-str">Payload String QRIS Statis/Dinamis</Label>
                <Input
                  id="cfg-qris-str"
                  className="font-mono text-xs"
                  value={form.qrisString}
                  onChange={(e) =>
                    setForm({ ...form, qrisString: e.target.value })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-welcome">Pesan Sambutan (/start)</Label>
                <Textarea
                  id="cfg-welcome"
                  rows={2}
                  value={form.welcomeMessage}
                  onChange={(e) =>
                    setForm({ ...form, welcomeMessage: e.target.value })
                  }
                />
              </div>

              <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium">
                      Auto-Delivery Stok Instan
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Kirim akun/voucher otomatis begitu invoice lunas
                    </div>
                  </div>
                  <Switch
                    checked={form.autoDeliveryEnabled}
                    onCheckedChange={(v) =>
                      setForm({ ...form, autoDeliveryEnabled: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium">
                      Kode Unik QRIS Otomatis (3 Digit)
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Tambah 3 angka acak agar mutasi QRIS terverifikasi otomatis
                    </div>
                  </div>
                  <Switch
                    checked={form.qrisUniqueCodeEnabled}
                    onCheckedChange={(v) =>
                      setForm({ ...form, qrisUniqueCodeEnabled: v })
                    }
                  />
                </div>
              </div>

              <Button type="submit" disabled={isSaving} className="w-full">
                <CheckCircle2Icon data-icon="inline-start" />
                Simpan Pengaturan Bot & QRIS
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Generated Node.js Telegraf Source Code (SC) */}
        <Card className="lg:col-span-7 flex flex-col">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Code2Icon className="size-4 text-primary" />
                  Generator Source Code (SC) Bot Auto-Order
                </CardTitle>
                <Badge variant="secondary">Telegraf + Postgres</Badge>
              </div>
              <CardDescription>
                Selain memakai Webhook bawaan web ini, Anda juga bisa download
                file SC mandiri (`bot.js`) yang sudah terhubung ke database toko
                Anda.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(standaloneTelegrafCode)
                  toast.success("Source code bot.js berhasil disalin!")
                }}
              >
                <CopyIcon data-icon="inline-start" />
                Salin SC
              </Button>
              <Button size="sm" onClick={handleDownloadScript}>
                <DownloadIcon data-icon="inline-start" />
                Download bot.js
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <SparklesIcon className="size-3.5 text-primary" />
                  Cara 1: Tanpa VPS (Serverless Webhook — Recommended)
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Cukup tempel <strong>Bot Token</strong> dari @BotFather di
                  panel kiri lalu klik <strong>Set Webhook</strong>. Bot Anda
                  langsung aktif 24 jam penuh mengikuti stok & katalog di
                  dashboard ini!
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <Code2Icon className="size-3.5 text-primary" />
                  Cara 2: Jalankan SC Mandiri di VPS / Panel Pterodactyl
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Download file <code>bot.js</code> di atas, pasang{" "}
                  <code>npm i telegraf pg dotenv</code>, lalu jalankan{" "}
                  <code>node bot.js</code> menggunakan{" "}
                  <code>DATABASE_URL</code> Neon Anda.
                </p>
              </div>
            </div>

            <div className="relative flex-1 rounded-xl border border-border bg-neutral-950 text-neutral-100 p-4 overflow-auto max-h-[430px]">
              <pre className="font-mono text-xs leading-relaxed">
                <code>{standaloneTelegrafCode}</code>
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
