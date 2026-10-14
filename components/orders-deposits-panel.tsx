"use client"

import * as React from "react"
import {
  approvePendingOrderAction,
  approveDepositAction,
  adjustUserBalanceAction,
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import {
  CheckCircle2Icon,
  ClockIcon,
  QrCodeIcon,
  WalletIcon,
  UsersIcon,
  PlusCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

export interface OrderRow {
  id: number
  invoiceId: string
  telegramId: string
  buyerUsername: string
  buyerName: string
  productId: number
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  uniqueCode: number
  totalAmount: number
  paymentMethod: string
  status: string
  deliveredContent: string | null
  createdAt: string
}

export interface DepositRow {
  id: number
  depositId: string
  telegramId: string
  username: string
  fullName: string
  amount: number
  uniqueCode: number
  totalTransfer: number
  method: string
  status: string
  createdAt: string
}

export interface BotUserRow {
  id: number
  telegramId: string
  username: string
  fullName: string
  balance: number
  totalSpent: number
  totalOrders: number
  role: string
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function OrdersDepositsPanel({
  orders,
  deposits,
  users,
  onMutate,
}: {
  orders: OrderRow[]
  deposits: DepositRow[]
  users: BotUserRow[]
  onMutate: () => void
}) {
  const [processingId, setProcessingId] = React.useState<string | null>(null)

  const handleApproveOrder = async (invoiceId: string) => {
    setProcessingId(invoiceId)
    try {
      const res = await approvePendingOrderAction(invoiceId)
      if (res.ok) {
        toast.success(
          `Invoice ${invoiceId} diverifikasi! Stok produk otomatis dikirim ke pembeli.`
        )
        onMutate()
      } else {
        toast.error(res.message || "Gagal memverifikasi order")
      }
    } finally {
      setProcessingId(null)
    }
  }

  const handleApproveDeposit = async (depositId: string) => {
    setProcessingId(depositId)
    try {
      const res = await approveDepositAction(depositId)
      if (res.ok) {
        toast.success(
          `Deposit ${depositId} diapprove! Saldo otomatis masuk ke akun member.`
        )
        onMutate()
      } else {
        toast.error(res.message || "Gagal approve deposit")
      }
    } finally {
      setProcessingId(null)
    }
  }

  const handleQuickAddBalance = async (telegramId: string, username: string) => {
    setProcessingId(telegramId)
    try {
      await adjustUserBalanceAction({
        telegramId,
        amountDelta: 50000,
      })
      toast.success(`Saldo @${username} berhasil ditambah +Rp 50.000!`)
      onMutate()
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCodeIcon className="size-4 text-primary" />
            Daftar Transaksi & Pengiriman Otomatis (Auto-Delivery Log)
          </CardTitle>
          <CardDescription>
            Pantau semua pembelian via QRIS maupun Saldo Bot. Untuk order QRIS
            berstatus Pending, klik &quot;Verifikasi &amp; Kirim Stok&quot; untuk memicu
            pengiriman akun otomatis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Invoice</TableHead>
                <TableHead>Pembeli</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Metode & Nominal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Terkirim (Auto-Delivery)</TableHead>
                <TableHead className="text-right">Tindakan Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((ord) => (
                <TableRow key={ord.id}>
                  <TableCell className="font-mono text-xs font-semibold">
                    {ord.invoiceId}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {ord.buyerName}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      @{ord.buyerUsername} ({ord.telegramId})
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{ord.productName}</div>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {ord.productCode}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold font-mono text-foreground">
                      {formatRupiah(ord.totalAmount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ord.paymentMethod}{" "}
                      {ord.uniqueCode > 0 && `(Kode Unik +${ord.uniqueCode})`}
                    </div>
                  </TableCell>
                  <TableCell>
                    {ord.status === "paid" ? (
                      <Badge variant="default">Lunas & Terkirim</Badge>
                    ) : ord.status === "pending" ? (
                      <Badge variant="secondary">
                        <ClockIcon className="mr-1 size-3" />
                        Menunggu QRIS
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Dibatalkan</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-xs truncate text-muted-foreground">
                    {ord.deliveredContent || "Menunggu pembayaran..."}
                  </TableCell>
                  <TableCell className="text-right">
                    {ord.status === "pending" ? (
                      <Button
                        size="sm"
                        disabled={processingId === ord.invoiceId}
                        onClick={() => handleApproveOrder(ord.invoiceId)}
                      >
                        <CheckCircle2Icon data-icon="inline-start" />
                        Verifikasi & Kirim Stok
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Selesai Otomatis
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Deposits & Users Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QRIS Deposit Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="size-4 text-primary" />
              Tiket Top-Up Saldo Deposit (QRIS)
            </CardTitle>
            <CardDescription>
              Daftar request pengisian saldo member via QRIS beserta kode unik
              transfer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Deposit</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Total Transfer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((dep) => (
                  <TableRow key={dep.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {dep.depositId}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{dep.fullName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        @{dep.username}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono font-semibold text-xs text-primary">
                        {formatRupiah(dep.totalTransfer)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Saldo +{formatRupiah(dep.amount)} (Unik +{dep.uniqueCode})
                      </div>
                    </TableCell>
                    <TableCell>
                      {dep.status === "approved" ? (
                        <Badge variant="default">Approved</Badge>
                      ) : (
                        <Badge variant="secondary">Pending QRIS</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {dep.status === "pending" ? (
                        <Button
                          size="sm"
                          disabled={processingId === dep.depositId}
                          onClick={() => handleApproveDeposit(dep.depositId)}
                        >
                          Approve Saldo
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Masuk Saldo
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Bot Users & Balances */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-4 text-primary" />
              Database Member & Saldo Bot Telegram
            </CardTitle>
            <CardDescription>
              Kelola saldo deposit member atau tambahkan bonus saldo secara
              instan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member Telegram</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Saldo Aktif</TableHead>
                  <TableHead>Total Order</TableHead>
                  <TableHead className="text-right">Tambah Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium text-xs">{u.fullName}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        @{u.username} • ID: {u.telegramId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-xs text-primary">
                      {formatRupiah(u.balance)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.totalOrders}x ({formatRupiah(u.totalSpent)})
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={processingId === u.telegramId}
                        onClick={() =>
                          handleQuickAddBalance(u.telegramId, u.username)
                        }
                      >
                        <PlusCircleIcon data-icon="inline-start" />
                        +Rp 50rb
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
