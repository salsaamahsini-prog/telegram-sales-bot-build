import { db, pool } from "./index"
import {
  botSettings,
  products,
  productStocks,
  botUsers,
  orders,
  deposits,
  qrisMutations,
} from "./schema"
import { count } from "drizzle-orm"

let isSeeded = false

export async function ensureSeeded() {
  if (isSeeded) return

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qris_mutations (
        id SERIAL PRIMARY KEY,
        source_app TEXT NOT NULL DEFAULT 'GoPay Merchant',
        raw_notification TEXT NOT NULL,
        amount INTEGER NOT NULL,
        matched_reference TEXT,
        status TEXT NOT NULL DEFAULT 'matched',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    const [{ value: mutationCount }] = await db
      .select({ value: count() })
      .from(qrisMutations)

    if (mutationCount === 0) {
      await db.insert(qrisMutations).values([
        {
          sourceApp: "GoPay Merchant (Notif Forwarder)",
          rawNotification:
            "Pembayaran QRIS Rp 35.142 berhasil diterima di GARUDA DIGITAL STORE",
          amount: 35142,
          matchedReference: "INV-20261014-8821",
          status: "matched",
        },
        {
          sourceApp: "OrderKuota / OkeConnect",
          rawNotification: "Mutasi QRIS Masuk sebesar Rp 150.218 berhasil",
          amount: 150218,
          matchedReference: "INV-20261014-8829",
          status: "matched",
        },
      ])
    }
    const [{ value: settingsCount }] = await db
      .select({ value: count() })
      .from(botSettings)

    if (settingsCount === 0) {
      await db.insert(botSettings).values({
        botName: "GarudaStore AutoOrder Bot",
        botUsername: "garudastore_bot",
        botToken: "",
        adminTelegramId: "682910442",
        adminUsername: "bos_garuda",
        qrisMerchantName: "GARUDA DIGITAL STORE",
        qrisNmid: "ID1024319884210",
        qrisString:
          "00020101021126610014COM.GO-JEK.WWW01189360091431988421020215ID10243198842100303UMI51440014ID.CO.QRIS.WWW0215ID10243198842100303UMI5204581553033605802ID5920GARUDA DIGITAL STORE6007JAKARTA6105121906304A1B2",
        welcomeMessage:
          "Selamat datang di GarudaStore Auto-Order Bot! Semua pesanan akun premium, lisensi, dan source code dikirim otomatis 24 jam nonstop detik itu juga setelah pembayaran QRIS atau Saldo Deposit berhasil.",
        autoDeliveryEnabled: true,
        qrisUniqueCodeEnabled: true,
        maintenanceMode: false,
      })
    }

    const [{ value: productCount }] = await db
      .select({ value: count() })
      .from(products)

    if (productCount === 0) {
      const insertedProducts = await db
        .insert(products)
        .values([
          {
            code: "NETFLIX1B",
            name: "Netflix Premium 4K UHD (1 Bulan)",
            category: "Streaming",
            price: 35000,
            originalPrice: 54000,
            description:
              "Akun Netflix Plan Ultra HD 4K 1 Profile Private + PIN. Garansi full 30 hari anti hold/backfree.",
            termsInstructions:
              "Login di 1 perangkat saja. Dilarang mengubah password email utama atau mengutak-atik profil lain.",
            isActive: true,
            soldCount: 18,
          },
          {
            code: "CANVAPRO",
            name: "Canva Pro Invite Lifetime Edu/Team",
            category: "Design & Tools",
            price: 15000,
            originalPrice: 45000,
            description:
              "Akses penuh fitur Canva Pro (Unlock template premium, Magic Resize, Background Remover, Brand Kit).",
            termsInstructions:
              "Buka link invite yang dikirimkan oleh bot lalu login dengan akun Canva pribadi kamu.",
            isActive: true,
            soldCount: 24,
          },
          {
            code: "CHATGPTPLUS",
            name: "ChatGPT Plus GPT-4o Shared (1 Bulan)",
            category: "AI & Productivity",
            price: 65000,
            originalPrice: 120000,
            description:
              "Akses penuh model terbaru GPT-4o, DALL-E 3, analisis dokumen & coding cepat. Garansi full 30 hari.",
            termsInstructions:
              "Gunakan login email & password yang diberikan. Untuk kode OTP 2FA, klik link generator OTP di dalam detail akun.",
            isActive: true,
            soldCount: 12,
          },
          {
            code: "CAPCUTPRO",
            name: "CapCut Pro Private Account (1 Bulan)",
            category: "Design & Tools",
            price: 25000,
            originalPrice: 50000,
            description:
              "Akun CapCut Pro Private bisa untuk Android, iOS, Windows, dan Mac. Semua efek & transisi Pro terbuka.",
            termsInstructions:
              "Login menggunakan email & password di menu Sign In Email CapCut.",
            isActive: true,
            soldCount: 9,
          },
          {
            code: "SCBOTVIP",
            name: "Source Code Bot Auto-Order Telegram Full",
            category: "Source Code",
            price: 150000,
            originalPrice: 300000,
            description:
              "Full Source Code Bot Auto-Order Telegram + QRIS + Deposit + Admin Panel siap deploy di Vercel / VPS.",
            termsInstructions:
              "Download via link GitHub Release / GDrive Private yang dikirim otomatis setelah pembayaran selesai.",
            isActive: true,
            soldCount: 7,
          },
        ])
        .returning()

      const stockPayloads: Array<{
        productId: number
        productCode: string
        credentials: string
        status: string
        orderInvoice?: string
        buyerTelegramId?: string
        soldAt?: Date
      }> = []

      for (const p of insertedProducts) {
        if (p.code === "NETFLIX1B") {
          stockPayloads.push(
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: nf_ultra01@garudastore.id | Pass: Garuda4K#2026 | Profile: 2 | PIN: 2291",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: nf_ultra02@garudastore.id | Pass: Garuda4K#2026 | Profile: 3 | PIN: 8812",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: nf_ultra03@garudastore.id | Pass: Garuda4K#2026 | Profile: 4 | PIN: 4410",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: nf_ultra04@garudastore.id | Pass: Garuda4K#2026 | Profile: 1 | PIN: 1920",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: nf_sold99@garudastore.id | Pass: Garuda4K#2026 | Profile: 5 | PIN: 5511",
              status: "sold",
              orderInvoice: "INV-20261014-8821",
              buyerTelegramId: "518920114",
              soldAt: new Date(Date.now() - 1000 * 60 * 45),
            }
          )
        } else if (p.code === "CANVAPRO") {
          stockPayloads.push(
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Invite Link: https://www.canva.com/brand/join?token=GRD-PRO-99182A | Berlaku 1x Klaim",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Invite Link: https://www.canva.com/brand/join?token=GRD-PRO-99183B | Berlaku 1x Klaim",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Invite Link: https://www.canva.com/brand/join?token=GRD-PRO-99184C | Berlaku 1x Klaim",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Invite Link: https://www.canva.com/brand/join?token=GRD-PRO-99180X | Berlaku 1x Klaim",
              status: "sold",
              orderInvoice: "INV-20261014-7712",
              buyerTelegramId: "629104882",
              soldAt: new Date(Date.now() - 1000 * 60 * 120),
            }
          )
        } else if (p.code === "CHATGPTPLUS") {
          stockPayloads.push(
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: gpt_pro1@garudastore.id | Pass: OpenAI#Plus88 | 2FA Guard: https://2fa.garudastore.id/gpt1",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: gpt_pro2@garudastore.id | Pass: OpenAI#Plus88 | 2FA Guard: https://2fa.garudastore.id/gpt2",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: gpt_sold1@garudastore.id | Pass: OpenAI#Plus88 | 2FA Guard: https://2fa.garudastore.id/gpt0",
              status: "sold",
              orderInvoice: "INV-20261014-6690",
              buyerTelegramId: "739201994",
              soldAt: new Date(Date.now() - 1000 * 60 * 240),
            }
          )
        } else if (p.code === "CAPCUTPRO") {
          stockPayloads.push(
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: capcut_vip01@garudastore.id | Pass: CreatorPro#99",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: capcut_vip02@garudastore.id | Pass: CreatorPro#99",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Email: capcut_vip03@garudastore.id | Pass: CreatorPro#99",
              status: "available",
            }
          )
        } else if (p.code === "SCBOTVIP") {
          stockPayloads.push(
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Download URL: https://dl.garudastore.id/sc-autobot-v4.zip | License Key: GRD-VIP-2026-X91A",
              status: "available",
            },
            {
              productId: p.id,
              productCode: p.code,
              credentials:
                "Download URL: https://dl.garudastore.id/sc-autobot-v4.zip | License Key: GRD-VIP-2026-X92B",
              status: "available",
            }
          )
        }
      }

      await db.insert(productStocks).values(stockPayloads)

      await db.insert(botUsers).values([
        {
          telegramId: "998877665",
          username: "pembeli_simulator",
          fullName: "Rizky Pratama (Simulator)",
          balance: 125000,
          totalSpent: 85000,
          totalOrders: 2,
          role: "vip",
        },
        {
          telegramId: "518920114",
          username: "dimas_kurnia",
          fullName: "Dimas Kurniawan",
          balance: 40000,
          totalSpent: 105000,
          totalOrders: 3,
          role: "reseller",
        },
        {
          telegramId: "629104882",
          username: "nadia_design",
          fullName: "Nadia Putri",
          balance: 15000,
          totalSpent: 45000,
          totalOrders: 2,
          role: "member",
        },
        {
          telegramId: "739201994",
          username: "fajar_dev",
          fullName: "Fajar Nugroho",
          balance: 210000,
          totalSpent: 215000,
          totalOrders: 3,
          role: "vip",
        },
      ])

      const nfProd = insertedProducts.find((p) => p.code === "NETFLIX1B")!
      const canvaProd = insertedProducts.find((p) => p.code === "CANVAPRO")!
      const gptProd = insertedProducts.find((p) => p.code === "CHATGPTPLUS")!
      const ccProd = insertedProducts.find((p) => p.code === "CAPCUTPRO")!

      await db.insert(orders).values([
        {
          invoiceId: "INV-20261014-8821",
          telegramId: "518920114",
          buyerUsername: "dimas_kurnia",
          buyerName: "Dimas Kurniawan",
          productId: nfProd.id,
          productCode: nfProd.code,
          productName: nfProd.name,
          quantity: 1,
          unitPrice: 35000,
          uniqueCode: 142,
          totalAmount: 35142,
          paymentMethod: "QRIS",
          status: "paid",
          deliveredContent:
            "Email: nf_sold99@garudastore.id | Pass: Garuda4K#2026 | Profile: 5 | PIN: 5511",
          paidAt: new Date(Date.now() - 1000 * 60 * 45),
        },
        {
          invoiceId: "INV-20261014-7712",
          telegramId: "629104882",
          buyerUsername: "nadia_design",
          buyerName: "Nadia Putri",
          productId: canvaProd.id,
          productCode: canvaProd.code,
          productName: canvaProd.name,
          quantity: 1,
          unitPrice: 15000,
          uniqueCode: 0,
          totalAmount: 15000,
          paymentMethod: "BALANCE",
          status: "paid",
          deliveredContent:
            "Invite Link: https://www.canva.com/brand/join?token=GRD-PRO-99180X | Berlaku 1x Klaim",
          paidAt: new Date(Date.now() - 1000 * 60 * 120),
        },
        {
          invoiceId: "INV-20261014-6690",
          telegramId: "739201994",
          buyerUsername: "fajar_dev",
          buyerName: "Fajar Nugroho",
          productId: gptProd.id,
          productCode: gptProd.code,
          productName: gptProd.name,
          quantity: 1,
          unitPrice: 65000,
          uniqueCode: 218,
          totalAmount: 65218,
          paymentMethod: "QRIS",
          status: "paid",
          deliveredContent:
            "Email: gpt_sold1@garudastore.id | Pass: OpenAI#Plus88 | 2FA Guard: https://2fa.garudastore.id/gpt0",
          paidAt: new Date(Date.now() - 1000 * 60 * 240),
        },
        {
          invoiceId: "INV-20261014-9104",
          telegramId: "518920114",
          buyerUsername: "dimas_kurnia",
          buyerName: "Dimas Kurniawan",
          productId: ccProd.id,
          productCode: ccProd.code,
          productName: ccProd.name,
          quantity: 1,
          unitPrice: 25000,
          uniqueCode: 309,
          totalAmount: 25309,
          paymentMethod: "QRIS",
          status: "pending",
        },
      ])

      await db.insert(deposits).values([
        {
          depositId: "DEP-20261014-501",
          telegramId: "998877665",
          username: "pembeli_simulator",
          fullName: "Rizky Pratama (Simulator)",
          amount: 100000,
          uniqueCode: 117,
          totalTransfer: 100117,
          method: "QRIS",
          status: "approved",
          approvedAt: new Date(Date.now() - 1000 * 60 * 180),
        },
        {
          depositId: "DEP-20261014-509",
          telegramId: "629104882",
          username: "nadia_design",
          fullName: "Nadia Putri",
          amount: 50000,
          uniqueCode: 245,
          totalTransfer: 50245,
          method: "QRIS",
          status: "pending",
        },
      ])
    }

    isSeeded = true
  } catch (err) {
    console.error("[v0] Seed check error:", err)
  }
}
