import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "GarudaStore AutoOrder — SC Bot Jualan Telegram + QRIS + Auto-Delivery",
  description:
    "Dashboard Admin, Gudang Stok Auto-Delivery, Pembayaran QRIS & Saldo Deposit, Live Bot Simulator, dan Generator Source Code Bot Telegram.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-right" richColors />
        <Analytics />
      </body>
    </html>
  )
}
