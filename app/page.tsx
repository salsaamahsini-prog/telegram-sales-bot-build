import { db } from "@/lib/db"
import {
  botSettings,
  products,
  productStocks,
  botUsers,
  orders,
  deposits,
} from "@/lib/db/schema"
import { ensureSeeded } from "@/lib/db/seed"
import { desc } from "drizzle-orm"
import { BotDashboardShell } from "@/components/bot-dashboard-shell"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  await ensureSeeded()

  const [settings] = await db.select().from(botSettings).limit(1)
  const allProducts = await db
    .select()
    .from(products)
    .orderBy(desc(products.id))
  const allStocks = await db
    .select()
    .from(productStocks)
    .orderBy(desc(productStocks.id))
  const allUsers = await db
    .select()
    .from(botUsers)
    .orderBy(desc(botUsers.joinedAt))
  const allOrders = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
  const allDeposits = await db
    .select()
    .from(deposits)
    .orderBy(desc(deposits.createdAt))

  const enrichedProducts = allProducts.map((p) => {
    const pStocks = allStocks.filter((s) => s.productId === p.id)
    const availableCount = pStocks.filter(
      (s) => s.status === "available"
    ).length
    const soldStockCount = pStocks.filter((s) => s.status === "sold").length
    return {
      ...p,
      availableStock: availableCount,
      soldStockCount,
    }
  })

  const paidOrders = allOrders.filter((o) => o.status === "paid")
  const pendingOrders = allOrders.filter((o) => o.status === "pending")
  const totalRevenue = paidOrders.reduce((acc, o) => acc + o.totalAmount, 0)
  const availableStocksTotal = allStocks.filter(
    (s) => s.status === "available"
  ).length

  const serializedInitialData = JSON.parse(
    JSON.stringify({
      settings,
      products: enrichedProducts,
      stocks: allStocks,
      users: allUsers,
      orders: allOrders,
      deposits: allDeposits,
      stats: {
        totalRevenue,
        paidOrdersCount: paidOrders.length,
        pendingOrdersCount: pendingOrders.length,
        availableStocksTotal,
        totalUsers: allUsers.length,
        pendingDepositsCount: allDeposits.filter((d) => d.status === "pending")
          .length,
      },
    })
  )

  return <BotDashboardShell initialData={serializedInitialData} />
}
