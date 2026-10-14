import { db } from "@/lib/db"
import {
  botSettings,
  products,
  productStocks,
  botUsers,
  orders,
  deposits,
  qrisMutations,
} from "@/lib/db/schema"
import { ensureSeeded } from "@/lib/db/seed"
import {
  convertStaticToDynamicQris,
  extractAmountFromNotificationText,
} from "@/lib/qris-utils"
import { and, desc, eq } from "drizzle-orm"

export interface InlineButton {
  text: string
  callbackData: string
}

export interface BotResponsePayload {
  text: string
  inlineKeyboard?: InlineButton[][]
  qrisCard?: {
    type: "ORDER" | "DEPOSIT"
    referenceId: string
    merchantName: string
    nmid: string
    qrisString: string
    baseAmount: number
    uniqueCode: number
    totalAmount: number
    itemName: string
  }
  deliveredCredentials?: {
    invoiceId: string
    productName: string
    credentials: string
    instructions: string
  }
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export async function getOrCreateBotUser(
  telegramId: string,
  username = "pembeli_simulator",
  fullName = "Rizky Pratama (Simulator)"
) {
  await ensureSeeded()
  const existing = await db
    .select()
    .from(botUsers)
    .where(eq(botUsers.telegramId, telegramId))
    .limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  const [created] = await db
    .insert(botUsers)
    .values({
      telegramId,
      username,
      fullName,
      balance: 75000,
      totalSpent: 0,
      totalOrders: 0,
      role: "member",
    })
    .returning()

  return created
}

export async function processBotInteraction(params: {
  telegramId: string
  username?: string
  fullName?: string
  input: string // text command or callback_data
}): Promise<BotResponsePayload> {
  await ensureSeeded()

  const user = await getOrCreateBotUser(
    params.telegramId,
    params.username || "pembeli_simulator",
    params.fullName || "Rizky Pratama (Simulator)"
  )

  const [settings] = await db.select().from(botSettings).limit(1)
  const rawInput = params.input.trim()

  if (settings?.maintenanceMode && !rawInput.startsWith("/start")) {
    return {
      text: `Mohon maaf, *${settings.botName}* sedang dalam pemeliharaan sistem sementara. Silakan coba beberapa saat lagi atau hubungi @${settings.adminUsername}.`,
      inlineKeyboard: [[{ text: "Refresh Menu Utama", callbackData: "/start" }]],
    }
  }

  // 1. /start or MENU_MAIN
  if (
    rawInput === "/start" ||
    rawInput === "MENU_MAIN" ||
    rawInput.toLowerCase() === "halo" ||
    rawInput.toLowerCase() === "menu"
  ) {
    const allProducts = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
    const availableStocks = await db
      .select()
      .from(productStocks)
      .where(eq(productStocks.status, "available"))

    const text = [
      `*${settings?.botName || "GarudaStore AutoOrder Bot"}*`,
      `${settings?.welcomeMessage || "Selamat datang di Bot Auto-Order Produk Digital 24 Jam!"}`,
      ``,
      `*Informasi Akun Kamu:*`,
      `• ID Telegram : \`${user.telegramId}\``,
      `• Username : @${user.username}`,
      `• Status Member : *${user.role.toUpperCase()}*`,
      `• Saldo Deposit : *${formatRupiah(user.balance)}*`,
      `• Total Transaksi : *${user.totalOrders}x Order (${formatRupiah(user.totalSpent)})*`,
      ``,
      `*Statistik Toko Live:*`,
      `• Produk Aktif : *${allProducts.length} Produk*`,
      `• Stok Siap Kirim : *${availableStocks.length} Akun/Voucher*`,
      ``,
      `Silakan pilih menu di bawah ini untuk mulai berbelanja:`,
    ].join("\n")

    return {
      text,
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
    }
  }

  // 2. /katalog - Show interactive product catalog
  if (rawInput === "/katalog" || rawInput.toLowerCase() === "katalog") {
    const activeProducts = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.id)

    const availableStocks = await db
      .select()
      .from(productStocks)
      .where(eq(productStocks.status, "available"))

    const stockMap = new Map<number, number>()
    for (const s of availableStocks) {
      stockMap.set(s.productId, (stockMap.get(s.productId) || 0) + 1)
    }

    const lines = [
      `*KATALOG PRODUK DIGITAL AUTO-DELIVERY*`,
      `Pilih produk di bawah ini untuk melihat detail & melakukan pembelian instan:`,
      ``,
    ]

    const buttons: InlineButton[][] = []
    let currentRow: InlineButton[] = []

    for (const prod of activeProducts) {
      const stk = stockMap.get(prod.id) || 0
      const statusLabel = stk > 0 ? `Tersedia (${stk})` : `HABIS`
      lines.push(
        `*[${prod.code}] ${prod.name}*`,
        `├ Harga : *${formatRupiah(prod.price)}* ${prod.originalPrice > prod.price ? `~${formatRupiah(prod.originalPrice)}~` : ""}`,
        `├ Kategori : ${prod.category}`,
        `└ Stok Gudang : *${statusLabel}* | Terjual: ${prod.soldCount}x`,
        ``
      )

      currentRow.push({
        text: `${prod.name.split(" ")[0]} (${formatRupiah(prod.price / 1000)}rb) [${stk}]`,
        callbackData: `DETAIL:${prod.code}`,
      })

      if (currentRow.length === 2) {
        buttons.push(currentRow)
        currentRow = []
      }
    }
    if (currentRow.length > 0) {
      buttons.push(currentRow)
    }
    buttons.push([{ text: "Kembali ke Menu Utama", callbackData: "/start" }])

    return {
      text: lines.join("\n"),
      inlineKeyboard: buttons,
    }
  }

  // 3. /stok - Summary of all stock
  if (rawInput === "/stok" || rawInput.toLowerCase() === "stok") {
    const activeProducts = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.id)

    const availableStocks = await db
      .select()
      .from(productStocks)
      .where(eq(productStocks.status, "available"))

    const stockMap = new Map<number, number>()
    for (const s of availableStocks) {
      stockMap.set(s.productId, (stockMap.get(s.productId) || 0) + 1)
    }

    const lines = [
      `*LAPORAN STOK GUDang REAL-TIME*`,
      `Update otomatis dari database server:`,
      ``,
    ]

    const buttons: InlineButton[][] = []
    for (const p of activeProducts) {
      const stk = stockMap.get(p.id) || 0
      const indicator = stk > 0 ? "[READY]" : "[KOSONG]"
      lines.push(
        `${indicator} *${p.name}*`,
        `   Kode: \`${p.code}\` • Harga: *${formatRupiah(p.price)}* • Sisa: *${stk} stok*`
      )
      if (stk > 0) {
        buttons.push([
          {
            text: `Beli ${p.name} — ${formatRupiah(p.price)}`,
            callbackData: `DETAIL:${p.code}`,
          },
        ])
      }
    }

    buttons.push([{ text: "Kembali ke Menu Utama", callbackData: "/start" }])

    return {
      text: lines.join("\n"),
      inlineKeyboard: buttons,
    }
  }

  // 4. DETAIL:<CODE> - Product Detail & Checkout options
  if (
    rawInput.startsWith("DETAIL:") ||
    rawInput.toUpperCase().startsWith("/BELI ")
  ) {
    const code = rawInput.startsWith("DETAIL:")
      ? rawInput.replace("DETAIL:", "").trim().toUpperCase()
      : rawInput.slice(6).trim().toUpperCase()

    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.code, code))
      .limit(1)

    if (!prod) {
      return {
        text: `Produk dengan kode \`${code}\` tidak ditemukan. Silakan buka /katalog untuk melihat daftar kode produk yang tersedia.`,
        inlineKeyboard: [
          [{ text: "Lihat Katalog Produk", callbackData: "/katalog" }],
        ],
      }
    }

    const availRows = await db
      .select()
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, prod.id),
          eq(productStocks.status, "available")
        )
      )

    const stockCount = availRows.length
    const enoughBalance = user.balance >= prod.price

    const text = [
      `*DETAIL PRODUK & CHECKOUT INSTAN*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*Nama Produk* : ${prod.name}`,
      `*Kode Produk* : \`${prod.code}\``,
      `*Kategori* : ${prod.category}`,
      `*Harga* : *${formatRupiah(prod.price)}* ${prod.originalPrice > prod.price ? `(Normal ~${formatRupiah(prod.originalPrice)}~)` : ""}`,
      `*Stok Tersedia* : *${stockCount} Akun / Voucher*`,
      `*Total Terjual* : ${prod.soldCount}x`,
      ``,
      `*Deskripsi Produk:*`,
      `${prod.description}`,
      ``,
      `*Syarat & Instruksi Pemakaian:*`,
      `${prod.termsInstructions}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*Saldo Kamu Saat Ini:* *${formatRupiah(user.balance)}*`,
      stockCount === 0
        ? `\n*Maaf, stok produk ini sedang habis.* Silakan pilih produk lain atau hubungi admin.`
        : `\nPilih metode pembayaran di bawah ini untuk memproses pesanan secara otomatis:`,
    ].join("\n")

    const buttons: InlineButton[][] = []
    if (stockCount > 0) {
      buttons.push([
        {
          text: enoughBalance
            ? `Bayar Pakai Saldo (${formatRupiah(prod.price)}) — INSTAN`
            : `Saldo Kurang (${formatRupiah(user.balance)}) — Topup Dulu`,
          callbackData: enoughBalance
            ? `BUY_BALANCE:${prod.code}`
            : `/topup`,
        },
      ])
      buttons.push([
        {
          text: `Bayar Pakai QRIS Otomatis (${formatRupiah(prod.price)})`,
          callbackData: `BUY_QRIS:${prod.code}`,
        },
      ])
    }

    buttons.push([
      { text: "Kembali ke Katalog", callbackData: "/katalog" },
      { text: "Menu Utama", callbackData: "/start" },
    ])

    return {
      text,
      inlineKeyboard: buttons,
    }
  }

  // 5. BUY_BALANCE:<CODE> - Instant purchase with Bot Balance + Auto-Delivery
  if (rawInput.startsWith("BUY_BALANCE:")) {
    const code = rawInput.replace("BUY_BALANCE:", "").trim().toUpperCase()
    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.code, code))
      .limit(1)

    if (!prod) {
      return {
        text: `Produk tidak ditemukan.`,
        inlineKeyboard: [[{ text: "Ke Katalog", callbackData: "/katalog" }]],
      }
    }

    if (user.balance < prod.price) {
      return {
        text: [
          `*SALDO DEPOSIT TIDAK MENCUKUPI*`,
          ``,
          `Harga Produk : *${formatRupiah(prod.price)}*`,
          `Saldo Kamu : *${formatRupiah(user.balance)}*`,
          `Kekurangan : *${formatRupiah(prod.price - user.balance)}*`,
          ``,
          `Silakan isi saldo deposit via QRIS terlebih dahulu atau gunakan metode *Bayar Pakai QRIS Langsung*.`,
        ].join("\n"),
        inlineKeyboard: [
          [
            { text: "Top-Up Saldo Sekarang", callbackData: "/topup" },
            {
              text: "Bayar Pakai QRIS Langsung",
              callbackData: `BUY_QRIS:${prod.code}`,
            },
          ],
        ],
      }
    }

    const [availableStock] = await db
      .select()
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, prod.id),
          eq(productStocks.status, "available")
        )
      )
      .orderBy(productStocks.id)
      .limit(1)

    if (!availableStock) {
      return {
        text: `Mohon maaf, stok untuk *${prod.name}* baru saja habis terjual. Saldo kamu tidak terpotong.`,
        inlineKeyboard: [[{ text: "Pilih Produk Lain", callbackData: "/katalog" }]],
      }
    }

    const invoiceId = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`

    // Mark stock sold
    await db
      .update(productStocks)
      .set({
        status: "sold",
        orderInvoice: invoiceId,
        buyerTelegramId: user.telegramId,
        soldAt: new Date(),
      })
      .where(eq(productStocks.id, availableStock.id))

    // Deduct user balance & increment stats
    const newBalance = user.balance - prod.price
    await db
      .update(botUsers)
      .set({
        balance: newBalance,
        totalSpent: user.totalSpent + prod.price,
        totalOrders: user.totalOrders + 1,
      })
      .where(eq(botUsers.id, user.id))

    // Increment product sold count
    await db
      .update(products)
      .set({
        soldCount: prod.soldCount + 1,
      })
      .where(eq(products.id, prod.id))

    // Create Paid Order
    await db.insert(orders).values({
      invoiceId,
      telegramId: user.telegramId,
      buyerUsername: user.username,
      buyerName: user.fullName,
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      quantity: 1,
      unitPrice: prod.price,
      uniqueCode: 0,
      totalAmount: prod.price,
      paymentMethod: "BALANCE",
      status: "paid",
      deliveredContent: availableStock.credentials,
      paidAt: new Date(),
    })

    const text = [
      `*TRANSAKSI BERHASIL & PRODUK TERKIRIM OTOMATIS!*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• No. Invoice : \`${invoiceId}\``,
      `• Produk : *${prod.name}*`,
      `• Metode Bayar : *Saldo Bot (Potong Otomatis)*`,
      `• Total Bayar : *${formatRupiah(prod.price)}*`,
      `• Sisa Saldo : *${formatRupiah(newBalance)}*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*DATA AKUN / VOUCHER / AKSES KAMU:*`,
      `\`${availableStock.credentials}\``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*Panduan Penggunaan:*`,
      `${prod.termsInstructions}`,
      ``,
      `Terima kasih telah berbelanja di *${settings?.botName}*! Simpan pesan ini sebagai bukti garansi.`,
    ].join("\n")

    return {
      text,
      deliveredCredentials: {
        invoiceId,
        productName: prod.name,
        credentials: availableStock.credentials,
        instructions: prod.termsInstructions,
      },
      inlineKeyboard: [
        [
          { text: "Beli Lagi", callbackData: `DETAIL:${prod.code}` },
          { text: "Katalog Produk", callbackData: "/katalog" },
        ],
        [{ text: "Menu Utama", callbackData: "/start" }],
      ],
    }
  }

  // 6. BUY_QRIS:<CODE> - Generate QRIS Invoice with Unique Code
  if (rawInput.startsWith("BUY_QRIS:")) {
    const code = rawInput.replace("BUY_QRIS:", "").trim().toUpperCase()
    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.code, code))
      .limit(1)

    if (!prod) {
      return {
        text: `Produk tidak ditemukan.`,
        inlineKeyboard: [[{ text: "Ke Katalog", callbackData: "/katalog" }]],
      }
    }

    const [availableStock] = await db
      .select()
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, prod.id),
          eq(productStocks.status, "available")
        )
      )
      .limit(1)

    if (!availableStock) {
      return {
        text: `Mohon maaf, stok untuk *${prod.name}* sedang habis.`,
        inlineKeyboard: [[{ text: "Ke Katalog", callbackData: "/katalog" }]],
      }
    }

    const uniqueCode = settings?.qrisUniqueCodeEnabled
      ? Math.floor(101 + Math.random() * 399)
      : 0
    const totalAmount = prod.price + uniqueCode
    const invoiceId = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`

    await db.insert(orders).values({
      invoiceId,
      telegramId: user.telegramId,
      buyerUsername: user.username,
      buyerName: user.fullName,
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      quantity: 1,
      unitPrice: prod.price,
      uniqueCode,
      totalAmount,
      paymentMethod: "QRIS",
      status: "pending",
    })

    const text = [
      `*TAGIHAN PEMBAYARAN QRIS OTOMATIS*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• No. Invoice : \`${invoiceId}\``,
      `• Produk : *${prod.name}*`,
      `• Harga Produk : ${formatRupiah(prod.price)}`,
      `• Kode Unik Verifikasi : *+${uniqueCode}*`,
      `• *TOTAL TRANSFER : ${formatRupiah(totalAmount)}*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*PENTING:* Harap scan QRIS di bawah ini dan transfer tepat sebesar *${formatRupiah(totalAmount)}* (beserta kode unik *${uniqueCode}*) agar sistem mendeteksi pembayaranmu secara otomatis tanpa antre admin!`,
      ``,
      `Setelah membayar, klik tombol *Cek Status / Simulasi Bayar Lunas* di bawah ini:`,
    ].join("\n")

    const staticQris = settings?.qrisString || ""
    const dynamicQris = convertStaticToDynamicQris(staticQris, totalAmount)

    return {
      text,
      qrisCard: {
        type: "ORDER",
        referenceId: invoiceId,
        merchantName: settings?.qrisMerchantName || "GARUDA DIGITAL STORE",
        nmid: settings?.qrisNmid || "ID1024319884210",
        qrisString: dynamicQris,
        baseAmount: prod.price,
        uniqueCode,
        totalAmount,
        itemName: prod.name,
      },
      inlineKeyboard: [
        [
          {
            text: `Simulasi Bayar QRIS Lunas (${formatRupiah(totalAmount)})`,
            callbackData: `SIMULATE_PAY:${invoiceId}`,
          },
        ],
        [
          {
            text: "Batalkan Pesanan",
            callbackData: `CANCEL_ORDER:${invoiceId}`,
          },
          { text: "Menu Utama", callbackData: "/start" },
        ],
      ],
    }
  }

  // 7. SIMULATE_PAY:<INVOICE_ID> - Verify QRIS payment & Auto-deliver stock
  if (rawInput.startsWith("SIMULATE_PAY:")) {
    const invoiceId = rawInput.replace("SIMULATE_PAY:", "").trim()
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.invoiceId, invoiceId))
      .limit(1)

    if (!order) {
      return {
        text: `Invoice \`${invoiceId}\` tidak ditemukan.`,
        inlineKeyboard: [[{ text: "Menu Utama", callbackData: "/start" }]],
      }
    }

    if (order.status === "paid") {
      return {
        text: [
          `*PESANAN SUDAH LUNAS*`,
          `Invoice \`${order.invoiceId}\` sudah terverifikasi sebelumnya.`,
          ``,
          `*Data Akun / Produk:*`,
          `\`${order.deliveredContent || "-"}\``,
        ].join("\n"),
        inlineKeyboard: [[{ text: "Menu Utama", callbackData: "/start" }]],
      }
    }

    const [availableStock] = await db
      .select()
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, order.productId),
          eq(productStocks.status, "available")
        )
      )
      .orderBy(productStocks.id)
      .limit(1)

    if (!availableStock) {
      return {
        text: `Pembayaran diterima untuk \`${invoiceId}\`, namun stok gudang baru saja habis. Admin akan segera memproses pengiriman manual atau refund ke saldo kamu.`,
        inlineKeyboard: [[{ text: "Menu Utama", callbackData: "/start" }]],
      }
    }

    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.id, order.productId))
      .limit(1)

    // Pop stock
    await db
      .update(productStocks)
      .set({
        status: "sold",
        orderInvoice: order.invoiceId,
        buyerTelegramId: order.telegramId,
        soldAt: new Date(),
      })
      .where(eq(productStocks.id, availableStock.id))

    // Mark order paid
    await db
      .update(orders)
      .set({
        status: "paid",
        deliveredContent: availableStock.credentials,
        paidAt: new Date(),
      })
      .where(eq(orders.id, order.id))

    // Update user stats
    await db
      .update(botUsers)
      .set({
        totalSpent: user.totalSpent + order.totalAmount,
        totalOrders: user.totalOrders + 1,
      })
      .where(eq(botUsers.telegramId, order.telegramId))

    if (prod) {
      await db
        .update(products)
        .set({ soldCount: prod.soldCount + 1 })
        .where(eq(products.id, prod.id))
    }

    const text = [
      `*PEMBAYARAN QRIS DITERIMA — AUTO-DELIVERY SUKSES!*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• No. Invoice : \`${order.invoiceId}\``,
      `• Produk : *${order.productName}*`,
      `• Nominal QRIS : *${formatRupiah(order.totalAmount)}*`,
      `• Status : *LUNAS & TERKIRIM OTOMATIS*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*DATA AKUN / VOUCHER / FILE KAMU:*`,
      `\`${availableStock.credentials}\``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*Instruksi & Garansi:*`,
      `${prod?.termsInstructions || "Gunakan sesuai ketentuan toko."}`,
    ].join("\n")

    return {
      text,
      deliveredCredentials: {
        invoiceId: order.invoiceId,
        productName: order.productName,
        credentials: availableStock.credentials,
        instructions:
          prod?.termsInstructions || "Gunakan sesuai ketentuan toko.",
      },
      inlineKeyboard: [
        [
          { text: "Beli Produk Lain", callbackData: "/katalog" },
          { text: "Lihat Riwayat Order", callbackData: "/riwayat" },
        ],
        [{ text: "Menu Utama", callbackData: "/start" }],
      ],
    }
  }

  // 8. CANCEL_ORDER:<INVOICE_ID>
  if (rawInput.startsWith("CANCEL_ORDER:")) {
    const invoiceId = rawInput.replace("CANCEL_ORDER:", "").trim()
    await db
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.invoiceId, invoiceId), eq(orders.status, "pending")))

    return {
      text: `Tagihan pesanan \`${invoiceId}\` telah dibatalkan.`,
      inlineKeyboard: [
        [
          { text: "Kembali ke Katalog", callbackData: "/katalog" },
          { text: "Menu Utama", callbackData: "/start" },
        ],
      ],
    }
  }

  // 9. /saldo - Check user balance & profile
  if (rawInput === "/saldo" || rawInput.toLowerCase() === "saldo") {
    return {
      text: [
        `*DOMPET SALDO & PROFIL MEMBER*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `• Nama : *${user.fullName}*`,
        `• Username : @${user.username}`,
        `• ID Telegram : \`${user.telegramId}\``,
        `• Level Akun : *${user.role.toUpperCase()}*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `• *Saldo Aktif : ${formatRupiah(user.balance)}*`,
        `• Total Belanja : ${formatRupiah(user.totalSpent)} (${user.totalOrders}x transaksi)`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `Belanja menggunakan Saldo Deposit *bebas kode unik* dan *langsung kirim detik itu juga* tanpa perlu scan QRIS berulang kali!`,
      ].join("\n"),
      inlineKeyboard: [
        [
          { text: "Isi Saldo Deposit (QRIS)", callbackData: "/topup" },
          { text: "Belanja Pakai Saldo", callbackData: "/katalog" },
        ],
        [{ text: "Kembali ke Menu Utama", callbackData: "/start" }],
      ],
    }
  }

  // 10. /topup - Choose deposit amount
  if (rawInput === "/topup" || rawInput.toLowerCase().startsWith("/topup")) {
    const parts = rawInput.split(" ")
    if (parts.length > 1) {
      const customAmount = parseInt(parts[1].replace(/\D/g, ""), 10)
      if (!isNaN(customAmount) && customAmount >= 10000) {
        return processBotInteraction({
          ...params,
          input: `TOPUP_NOMINAL:${customAmount}`,
        })
      }
    }

    return {
      text: [
        `*TOP-UP SALDO DEPOSIT OTOMATIS (QRIS)*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `Saldo Saat Ini : *${formatRupiah(user.balance)}*`,
        ``,
        `Pilih nominal Top-Up di bawah ini atau ketik \`/topup <nominal>\` (contoh: \`/topup 75000\`).`,
        `Saldo akan masuk otomatis setelah pembayaran QRIS terverifikasi!`,
      ].join("\n"),
      inlineKeyboard: [
        [
          { text: "Rp 20.000", callbackData: "TOPUP_NOMINAL:20000" },
          { text: "Rp 50.000", callbackData: "TOPUP_NOMINAL:50000" },
        ],
        [
          { text: "Rp 100.000", callbackData: "TOPUP_NOMINAL:100000" },
          { text: "Rp 250.000", callbackData: "TOPUP_NOMINAL:250000" },
        ],
        [{ text: "Kembali ke Menu Utama", callbackData: "/start" }],
      ],
    }
  }

  // 11. TOPUP_NOMINAL:<AMOUNT> - Create QRIS Deposit Invoice
  if (rawInput.startsWith("TOPUP_NOMINAL:")) {
    const amount = parseInt(rawInput.replace("TOPUP_NOMINAL:", "").trim(), 10)
    const uniqueCode = Math.floor(101 + Math.random() * 299)
    const totalTransfer = amount + uniqueCode
    const depositId = `DEP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`

    await db.insert(deposits).values({
      depositId,
      telegramId: user.telegramId,
      username: user.username,
      fullName: user.fullName,
      amount,
      uniqueCode,
      totalTransfer,
      method: "QRIS",
      status: "pending",
    })

    const staticQris = settings?.qrisString || ""
    const dynamicQris = convertStaticToDynamicQris(staticQris, totalTransfer)

    return {
      text: [
        `*INVOICE TOP-UP SALDO DEPOSIT QRIS*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `• ID Deposit : \`${depositId}\``,
        `• Nominal Saldo : *${formatRupiah(amount)}*`,
        `• Kode Unik : *+${uniqueCode}*`,
        `• *TOTAL TRANSFER : ${formatRupiah(totalTransfer)}*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `Scan QRIS di bawah ini dari aplikasi Bank / E-Wallet (GoPay, OVO, DANA, ShopeePay, BCA, Mandiri, BRI, SeaBank) dan transfer tepat *${formatRupiah(totalTransfer)}*.`,
      ].join("\n"),
      qrisCard: {
        type: "DEPOSIT",
        referenceId: depositId,
        merchantName: settings?.qrisMerchantName || "GARUDA DIGITAL STORE",
        nmid: settings?.qrisNmid || "ID1024319884210",
        qrisString: dynamicQris,
        baseAmount: amount,
        uniqueCode,
        totalAmount: totalTransfer,
        itemName: `Top-Up Saldo ${formatRupiah(amount)}`,
      },
      inlineKeyboard: [
        [
          {
            text: `Simulasi Bayar Deposit Lunas (${formatRupiah(totalTransfer)})`,
            callbackData: `SIMULATE_DEPOSIT:${depositId}`,
          },
        ],
        [{ text: "Kembali ke Menu Utama", callbackData: "/start" }],
      ],
    }
  }

  // 12. SIMULATE_DEPOSIT:<DEPOSIT_ID>
  if (rawInput.startsWith("SIMULATE_DEPOSIT:")) {
    const depositId = rawInput.replace("SIMULATE_DEPOSIT:", "").trim()
    const [dep] = await db
      .select()
      .from(deposits)
      .where(eq(deposits.depositId, depositId))
      .limit(1)

    if (!dep) {
      return {
        text: `Data deposit \`${depositId}\` tidak ditemukan.`,
        inlineKeyboard: [[{ text: "Menu Utama", callbackData: "/start" }]],
      }
    }

    if (dep.status === "approved") {
      return {
        text: `Deposit \`${depositId}\` sudah berhasil ditambahkan ke saldo kamu sebelumnya.`,
        inlineKeyboard: [[{ text: "Cek Saldo", callbackData: "/saldo" }]],
      }
    }

    await db
      .update(deposits)
      .set({
        status: "approved",
        approvedAt: new Date(),
      })
      .where(eq(deposits.id, dep.id))

    const newBalance = user.balance + dep.amount
    await db
      .update(botUsers)
      .set({
        balance: newBalance,
      })
      .where(eq(botUsers.telegramId, dep.telegramId))

    return {
      text: [
        `*TOP-UP SALDO BERHASIL DIVERIFIKASI!*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `• ID Deposit : \`${dep.depositId}\``,
        `• Saldo Masuk : *+${formatRupiah(dep.amount)}*`,
        `• Total Transfer : ${formatRupiah(dep.totalTransfer)}`,
        `• *Saldo Akhir Kamu : ${formatRupiah(newBalance)}*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `Saldo sudah aktif dan siap dipakai untuk belanja instan semua produk di katalog!`,
      ].join("\n"),
      inlineKeyboard: [
        [
          { text: "Mulai Belanja Sekarang", callbackData: "/katalog" },
          { text: "Cek Dompet Saldo", callbackData: "/saldo" },
        ],
      ],
    }
  }

  // 13. /riwayat - Order history for this user
  if (rawInput === "/riwayat" || rawInput.toLowerCase() === "riwayat") {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.telegramId, user.telegramId))
      .orderBy(desc(orders.createdAt))
      .limit(5)

    if (userOrders.length === 0) {
      return {
        text: `Kamu belum memiliki riwayat transaksi di *${settings?.botName}*. Yuk mulai belanja produk digital pertama kamu!`,
        inlineKeyboard: [
          [
            { text: "Buka Katalog Produk", callbackData: "/katalog" },
            { text: "Menu Utama", callbackData: "/start" },
          ],
        ],
      }
    }

    const lines = [
      `*5 RIWAYAT TRANSAKSI TERAKHIR KAMU*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ]

    for (const o of userOrders) {
      const statusBadge =
        o.status === "paid"
          ? "LUNAS (TERKIRIM)"
          : o.status === "pending"
            ? "MENUNGGU BAYAR"
            : "DIBATALKAN"
      lines.push(
        `• *${o.productName}*`,
        `  Invoice: \`${o.invoiceId}\` | ${formatRupiah(o.totalAmount)} (${o.paymentMethod})`,
        `  Status: *${statusBadge}*`,
        o.deliveredContent ? `  Data: \`${o.deliveredContent}\`` : ``,
        ``
      )
    }

    return {
      text: lines.join("\n"),
      inlineKeyboard: [
        [
          { text: "Belanja Lagi", callbackData: "/katalog" },
          { text: "Menu Utama", callbackData: "/start" },
        ],
      ],
    }
  }

  // 14. /caraorder - How to order guide
  if (rawInput === "/caraorder" || rawInput.toLowerCase() === "caraorder") {
    return {
      text: [
        `*PANDUAN CARA ORDER OTOMATIS 24 JAM*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `1. Klik menu *Katalog Produk & Beli* atau ketik \`/katalog\`.`,
        `2. Pilih produk digital yang ingin kamu beli.`,
        `3. Pilih metode pembayaran:`,
        `   • *Bayar Pakai Saldo Bot*: Paling cepat, bebas kode unik, akun/voucher langsung keluar detik itu juga!`,
        `   • *Bayar Pakai QRIS*: Scan QRIS yang muncul dan transfer sesuai *Total + Kode Unik* 3 digit.`,
        `4. Begitu pembayaran terverifikasi, bot akan *mengirimkan Email/Password/Voucher/Link SC secara otomatis* di ruang chat ini.`,
        ``,
        `Butuh bantuan atau klaim garansi? Hubungi Admin: @${settings?.adminUsername || "bos_garuda"}`,
      ].join("\n"),
      inlineKeyboard: [
        [
          { text: "Buka Katalog Produk", callbackData: "/katalog" },
          { text: "Isi Saldo Deposit", callbackData: "/topup" },
        ],
        [{ text: "Kembali ke Menu Utama", callbackData: "/start" }],
      ],
    }
  }

  // Default fallback
  return {
    text: [
      `Perintah \`${rawInput}\` tidak dikenali oleh bot.`,
      ``,
      `Gunakan tombol menu di bawah ini atau ketik perintah cepat:`,
      `• \`/start\` — Menu Utama Bot`,
      `• \`/katalog\` — Daftar Produk & Beli`,
      `• \`/stok\` — Cek Stok Real-Time`,
      `• \`/saldo\` — Cek Saldo Deposit`,
      `• \`/topup 50000\` — Deposit Saldo via QRIS`,
      `• \`/riwayat\` — Cek Pesanan & Akun Terbeli`,
    ].join("\n"),
    inlineKeyboard: [
      [
        { text: "Buka Katalog Produk", callbackData: "/katalog" },
        { text: "Menu Utama", callbackData: "/start" },
      ],
    ],
  }
}

export async function processIncomingQrisMutation(params: {
  rawNotification: string
  sourceApp?: string
  amountOverride?: number
}) {
  await ensureSeeded()
  const sourceApp = params.sourceApp || "GoPay Merchant (Notif Forwarder)"
  const parsedAmount =
    params.amountOverride && params.amountOverride > 0
      ? params.amountOverride
      : extractAmountFromNotificationText(params.rawNotification)

  if (!parsedAmount || parsedAmount <= 0) {
    return {
      ok: false,
      matched: false,
      amount: 0,
      message:
        "Tidak ditemukan angka nominal Rupiah yang valid dari teks notifikasi.",
    }
  }

  const [settings] = await db.select().from(botSettings).limit(1)

  // 1. Check Pending QRIS Orders matching exact totalAmount (Price + 3-digit Unique Code)
  const [matchingOrder] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        eq(orders.paymentMethod, "QRIS"),
        eq(orders.totalAmount, parsedAmount)
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(1)

  if (matchingOrder) {
    const [availableStock] = await db
      .select()
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, matchingOrder.productId),
          eq(productStocks.status, "available")
        )
      )
      .orderBy(productStocks.id)
      .limit(1)

    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.id, matchingOrder.productId))
      .limit(1)

    const deliveredCreds =
      availableStock?.credentials ||
      "STOK-HABIS-HUBUNGI-ADMIN-UNTUK-PENGIRIMAN-MANUAL"

    if (availableStock) {
      await db
        .update(productStocks)
        .set({
          status: "sold",
          orderInvoice: matchingOrder.invoiceId,
          buyerTelegramId: matchingOrder.telegramId,
          soldAt: new Date(),
        })
        .where(eq(productStocks.id, availableStock.id))
    }

    await db
      .update(orders)
      .set({
        status: "paid",
        deliveredContent: deliveredCreds,
        paidAt: new Date(),
      })
      .where(eq(orders.id, matchingOrder.id))

    const [buyer] = await db
      .select()
      .from(botUsers)
      .where(eq(botUsers.telegramId, matchingOrder.telegramId))
      .limit(1)

    if (buyer) {
      await db
        .update(botUsers)
        .set({
          totalSpent: buyer.totalSpent + matchingOrder.totalAmount,
          totalOrders: buyer.totalOrders + 1,
        })
        .where(eq(botUsers.id, buyer.id))
    }

    if (prod) {
      await db
        .update(products)
        .set({ soldCount: prod.soldCount + 1 })
        .where(eq(products.id, prod.id))
    }

    await db.insert(qrisMutations).values({
      sourceApp,
      rawNotification: params.rawNotification,
      amount: parsedAmount,
      matchedReference: matchingOrder.invoiceId,
      status: "matched",
    })

    // If Telegram Bot Token is configured, push auto-delivery message directly to buyer's Telegram!
    if (settings?.botToken) {
      const telegramMsg = [
        `*PEMBAYARAN QRIS TERDETEKSI OTOMATIS!*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `• No. Invoice : \`${matchingOrder.invoiceId}\``,
        `• Produk : *${matchingOrder.productName}*`,
        `• Nominal Masuk : *${formatRupiah(matchingOrder.totalAmount)}*`,
        `• Status : *LUNAS & AUTO-DELIVERY SUKSES*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `*DATA AKUN / VOUCHER / AKSES KAMU:*`,
        `\`${deliveredCreds}\``,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `*Panduan Penggunaan:*`,
        `${prod?.termsInstructions || "Gunakan sesuai ketentuan toko."}`,
      ].join("\n")

      try {
        await fetch(
          `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: matchingOrder.telegramId,
              text: telegramMsg,
              parse_mode: "Markdown",
            }),
          }
        )
      } catch (e) {
        console.error("[v0] Failed pushing Telegram auto-delivery message:", e)
      }
    }

    return {
      ok: true,
      matched: true,
      type: "ORDER" as const,
      referenceId: matchingOrder.invoiceId,
      amount: parsedAmount,
      buyerName: matchingOrder.buyerName,
      productName: matchingOrder.productName,
      deliveredCredentials: deliveredCreds,
      message: `Cocok dengan Order ${matchingOrder.invoiceId} (${matchingOrder.productName})! Status diubah jadi LUNAS & produk otomatis dikirim ke pembeli.`,
    }
  }

  // 2. Check Pending QRIS Deposits matching exact totalTransfer (Amount + 3-digit Unique Code)
  const [matchingDeposit] = await db
    .select()
    .from(deposits)
    .where(
      and(
        eq(deposits.status, "pending"),
        eq(deposits.totalTransfer, parsedAmount)
      )
    )
    .orderBy(desc(deposits.createdAt))
    .limit(1)

  if (matchingDeposit) {
    await db
      .update(deposits)
      .set({
        status: "approved",
        approvedAt: new Date(),
      })
      .where(eq(deposits.id, matchingDeposit.id))

    const [user] = await db
      .select()
      .from(botUsers)
      .where(eq(botUsers.telegramId, matchingDeposit.telegramId))
      .limit(1)

    const nextBalance = (user?.balance || 0) + matchingDeposit.amount
    if (user) {
      await db
        .update(botUsers)
        .set({ balance: nextBalance })
        .where(eq(botUsers.id, user.id))
    }

    await db.insert(qrisMutations).values({
      sourceApp,
      rawNotification: params.rawNotification,
      amount: parsedAmount,
      matchedReference: matchingDeposit.depositId,
      status: "matched",
    })

    if (settings?.botToken) {
      const telegramMsg = [
        `*DEPOSIT SALDO QRIS DITERIMA OTOMATIS!*`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `• ID Deposit : \`${matchingDeposit.depositId}\``,
        `• Nominal Masuk : *${formatRupiah(matchingDeposit.totalTransfer)}*`,
        `• Saldo Ditambahkan : *+${formatRupiah(matchingDeposit.amount)}*`,
        `• Total Saldo Sekarang : *${formatRupiah(nextBalance)}*`,
      ].join("\n")

      try {
        await fetch(
          `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: matchingDeposit.telegramId,
              text: telegramMsg,
              parse_mode: "Markdown",
            }),
          }
        )
      } catch (e) {
        console.error("[v0] Failed pushing Telegram deposit message:", e)
      }
    }

    return {
      ok: true,
      matched: true,
      type: "DEPOSIT" as const,
      referenceId: matchingDeposit.depositId,
      amount: parsedAmount,
      buyerName: matchingDeposit.fullName,
      productName: `Deposit Saldo ${formatRupiah(matchingDeposit.amount)}`,
      deliveredCredentials: `Saldo +${formatRupiah(matchingDeposit.amount)}`,
      message: `Cocok dengan Deposit ${matchingDeposit.depositId}! Saldo +${formatRupiah(matchingDeposit.amount)} otomatis masuk ke akun @${matchingDeposit.username}.`,
    }
  }

  // 3. No matching pending order or deposit found — record as unmatched mutation
  await db.insert(qrisMutations).values({
    sourceApp,
    rawNotification: params.rawNotification,
    amount: parsedAmount,
    matchedReference: null,
    status: "unmatched",
  })

  return {
    ok: true,
    matched: false,
    amount: parsedAmount,
    message: `Mutasi sebesar ${formatRupiah(parsedAmount)} tercatat, tetapi belum ada tagihan Order/Deposit PENDING dengan nominal + kode unik tepat ${formatRupiah(parsedAmount)}.`,
  }
}

