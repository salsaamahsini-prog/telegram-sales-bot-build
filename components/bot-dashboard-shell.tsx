"use client"

import * as React from "react"
import useSWR from "swr"
import { TelegramSimulator } from "@/components/telegram-simulator"
import {
  ProductStockManager,
  type EnrichedProduct,
  type StockRow,
} from "@/components/product-stock-manager"
import {
  OrdersDepositsPanel,
  type OrderRow,
  type DepositRow,
  type BotUserRow,
} from "@/components/orders-deposits-panel"
import {
  SourceCodeGenerator,
  type BotSettingsData,
} from "@/components/source-code-generator"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  BotIcon,
  TrendingUpIcon,
  PackageCheckIcon,
  KeyRoundIcon,
  UsersIcon,
  QrCodeIcon,
  Code2Icon,
  SparklesIcon,
  CheckCircle2Icon,
  ClockIcon,
  RefreshCwIcon,
} from "lucide-react"

interface DashboardPayload {
  settings: BotSettingsData
  products: EnrichedProduct[]
  stocks: StockRow[]
  users: BotUserRow[]
  orders: OrderRow[]
  deposits: DepositRow[]
  stats: {
    totalRevenue: number
    paidOrdersCount: number
    pendingOrdersCount: number
    availableStocksTotal: number
    totalUsers: number
    pendingDepositsCount: number
  }
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function BotDashboardShell({
  initialData,
}: {
  initialData: DashboardPayload
}) {
  const { data, mutate, isValidating } = useSWR<DashboardPayload>(
    "/api/dashboard",
    fetcher,
    {
      fallbackData: initialData,
      refreshInterval: 15000,
    }
  )

  const payload = data || initialData
  const simulatorUser = payload.users.find(
    (u) => u.telegramId === "998877665"
  )
  const simulatorBalance = simulatorUser ? simulatorUser.balance : 125000

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Command Center Navbar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-2xs">
              <BotIcon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight sm:text-lg">
                  {payload.settings?.botName || "GarudaStore AutoOrder Bot"}
                </h1>
                <Badge variant="default" className="text-[10px]">
                  Auto-Delivery Engine v4.0
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Bot Jualan Produk Digital Telegram • QRIS + Saldo Deposit •
                Database Neon Postgres Live
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-muted-foreground">
                @{payload.settings?.botUsername || "garudastore_bot"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isValidating}
            >
              <RefreshCwIcon
                data-icon="inline-start"
                className={isValidating ? "animate-spin" : ""}
              />
              Sync Data
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 flex flex-col gap-6">
        {/* KPI Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Omzet Lunas</span>
                <TrendingUpIcon className="size-4 text-primary" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight">
                {formatRupiah(payload.stats.totalRevenue)}
              </div>
              <div className="text-xs text-muted-foreground">
                Dari {payload.stats.paidOrdersCount} pesanan auto-delivery
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Stok Akun Siap Kirim</span>
                <KeyRoundIcon className="size-4 text-primary" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight">
                {payload.stats.availableStocksTotal} Stok
              </div>
              <div className="text-xs text-muted-foreground">
                Across {payload.products.length} produk digital aktif
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Antrean QRIS Pending</span>
                <QrCodeIcon className="size-4 text-primary" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight">
                {payload.stats.pendingOrdersCount} Order /{" "}
                {payload.stats.pendingDepositsCount} Depo
              </div>
              <div className="text-xs text-muted-foreground">
                Menunggu verifikasi kode unik QRIS
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Member Bot</span>
                <UsersIcon className="size-4 text-primary" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight">
                {payload.stats.totalUsers} User
              </div>
              <div className="text-xs text-muted-foreground">
                Saldo Simulator: {formatRupiah(simulatorBalance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <Tabs defaultValue="simulator" className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
              <TabsTrigger value="simulator">
                <SparklesIcon className="mr-1.5 size-3.5" />
                Live Simulator & Overview
              </TabsTrigger>
              <TabsTrigger value="products">
                <PackageCheckIcon className="mr-1.5 size-3.5" />
                Produk & Gudang Stok ({payload.stats.availableStocksTotal})
              </TabsTrigger>
              <TabsTrigger value="transactions">
                <QrCodeIcon className="mr-1.5 size-3.5" />
                Transaksi QRIS & Saldo ({payload.orders.length})
              </TabsTrigger>
              <TabsTrigger value="sourcecode">
                <Code2Icon className="mr-1.5 size-3.5" />
                Ambil SC Bot & Webhook
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: Live Bot Simulator + Real-Time Activity */}
          <TabsContent value="simulator" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 Cols: Interactive Telegram Auto-Order Bot Simulator */}
              <div className="lg:col-span-7">
                <TelegramSimulator
                  botName={payload.settings?.botName}
                  botUsername={payload.settings?.botUsername}
                  simulatorUserBalance={simulatorBalance}
                  onStateChange={() => mutate()}
                />
              </div>

              {/* Right 5 Cols: Live Store Status, Stock Quick View & Recent Auto-Deliveries */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Cara Uji Coba Auto-Order di Simulator</span>
                      <Badge variant="outline">100% Real DB</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Simulator di sebelah kiri menjalankan mesin bot yang sama
                      persis dengan webhook Telegram asli.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-xs">
                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <span className="font-semibold text-foreground">
                        1. Test Beli Pakai Saldo (Instan):
                      </span>{" "}
                      Klik tombol <strong>Katalog Produk &amp; Beli</strong> di
                      bot, pilih produk (misal Netflix / Canva), lalu klik{" "}
                      <strong>Bayar Pakai Saldo</strong>. Akun/voucher langsung
                      keluar detik itu juga &amp; stok berkurang!
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <span className="font-semibold text-foreground">
                        2. Test Beli Pakai QRIS + Kode Unik:
                      </span>{" "}
                      Pilih <strong>Bayar Pakai QRIS Otomatis</strong>. Bot akan
                      membuat QRIS + 3 digit kode unik. Klik tombol{" "}
                      <strong>Simulasi Bayar QRIS Lunas</strong> untuk melihat
                      auto-delivery bekerja.
                    </div>
                  </CardContent>
                </Card>

                {/* Live Product Stock Monitor */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Status Stok Gudang Saat Ini
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Terhubung langsung dengan brankas auto-delivery
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2.5">
                    {payload.products.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="font-medium text-foreground truncate">
                            {p.name}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            Kode: {p.code} • {formatRupiah(p.price)}
                          </div>
                        </div>
                        <Badge
                          variant={
                            p.availableStock > 0 ? "default" : "destructive"
                          }
                          className="shrink-0"
                        >
                          {p.availableStock} Stok
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Recent Auto-Delivery Feed */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Log Transaksi Bot Terbaru
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2.5">
                    {payload.orders.slice(0, 4).map((o) => (
                      <div
                        key={o.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/15 p-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-foreground">
                              {o.invoiceId}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {o.paymentMethod}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground truncate mt-0.5">
                            {o.productName} • @{o.buyerUsername}
                          </div>
                          {o.deliveredContent && (
                            <div className="mt-1 rounded bg-background border border-border px-2 py-1 font-mono text-[10px] text-primary truncate">
                              Terkirim: {o.deliveredContent}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-semibold">
                            {formatRupiah(o.totalAmount)}
                          </div>
                          <div className="mt-0.5">
                            {o.status === "paid" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2Icon className="size-3" />
                                Terkirim
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                <ClockIcon className="size-3" />
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Kelola Produk & Brankas Stok Auto-Delivery */}
          <TabsContent value="products" className="mt-0">
            <ProductStockManager
              products={payload.products}
              stocks={payload.stocks}
              onMutate={() => mutate()}
            />
          </TabsContent>

          {/* TAB 3: Transaksi QRIS, Deposit & Member */}
          <TabsContent value="transactions" className="mt-0">
            <OrdersDepositsPanel
              orders={payload.orders}
              deposits={payload.deposits}
              users={payload.users}
              onMutate={() => mutate()}
            />
          </TabsContent>

          {/* TAB 4: Generator Source Code (SC) & Pengaturan Webhook */}
          <TabsContent value="sourcecode" className="mt-0">
            <SourceCodeGenerator
              settings={payload.settings}
              onMutate={() => mutate()}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
