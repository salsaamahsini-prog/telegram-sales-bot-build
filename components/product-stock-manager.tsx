"use client"

import * as React from "react"
import {
  createProductAction,
  toggleProductActiveAction,
  deleteProductAction,
  bulkAddStockAction,
  deleteStockItemAction,
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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  PlusIcon,
  PackagePlusIcon,
  Trash2Icon,
  KeyRoundIcon,
  LayersIcon,
  CheckCircle2Icon,
} from "lucide-react"
import { toast } from "sonner"

export interface EnrichedProduct {
  id: number
  code: string
  name: string
  category: string
  price: number
  originalPrice: number
  description: string
  termsInstructions: string
  isActive: boolean
  soldCount: number
  availableStock: number
  soldStockCount: number
}

export interface StockRow {
  id: number
  productId: number
  productCode: string
  credentials: string
  status: string
  orderInvoice: string | null
  buyerTelegramId: string | null
  soldAt: string | null
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ProductStockManager({
  products,
  stocks,
  onMutate,
}: {
  products: EnrichedProduct[]
  stocks: StockRow[]
  onMutate: () => void
}) {
  const [isAddProductOpen, setIsAddProductOpen] = React.useState(false)
  const [isAddStockOpen, setIsAddStockOpen] = React.useState(false)
  const [selectedProductIdForStock, setSelectedProductIdForStock] =
    React.useState<number>(products[0]?.id || 0)
  const [stockFilterProduct, setStockFilterProduct] =
    React.useState<string>("ALL")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // New Product Form State
  const [code, setCode] = React.useState("")
  const [name, setName] = React.useState("")
  const [category, setCategory] = React.useState("Streaming")
  const [price, setPrice] = React.useState("35000")
  const [originalPrice, setOriginalPrice] = React.useState("50000")
  const [description, setDescription] = React.useState("")
  const [termsInstructions, setTermsInstructions] = React.useState("")
  const [initialStocks, setInitialStocks] = React.useState("")

  // Bulk Add Stock State
  const [rawCredentials, setRawCredentials] = React.useState("")

  React.useEffect(() => {
    if (!selectedProductIdForStock && products.length > 0) {
      setSelectedProductIdForStock(products[0].id)
    }
  }, [products, selectedProductIdForStock])

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim() || !price) {
      toast.error("Mohon lengkapi kode, nama, dan harga produk")
      return
    }
    setIsSubmitting(true)
    try {
      await createProductAction({
        code,
        name,
        category,
        price: parseInt(price, 10),
        originalPrice: parseInt(originalPrice || price, 10),
        description:
          description ||
          "Produk digital bergaransi penuh, pengiriman otomatis 24 jam.",
        termsInstructions:
          termsInstructions ||
          "Simpan data akun baik-baik. Hubungi admin jika ada kendala login.",
        initialStocks,
      })
      toast.success(`Produk ${name} berhasil ditambahkan ke katalog bot!`)
      setIsAddProductOpen(false)
      setCode("")
      setName("")
      setDescription("")
      setTermsInstructions("")
      setInitialStocks("")
      onMutate()
    } catch (err) {
      toast.error("Gagal membuat produk. Pastikan Kode Produk unik.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBulkAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductIdForStock || !rawCredentials.trim()) {
      toast.error("Pilih produk dan isi minimal 1 baris stok akun/voucher")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await bulkAddStockAction({
        productId: Number(selectedProductIdForStock),
        rawCredentials,
      })
      toast.success(
        `Berhasil menambahkan ${res.addedCount} stok auto-delivery ke gudang!`
      )
      setRawCredentials("")
      setIsAddStockOpen(false)
      onMutate()
    } catch (err) {
      toast.error("Gagal menambahkan stok")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredStocks = stocks.filter((s) =>
    stockFilterProduct === "ALL" ? true : s.productCode === stockFilterProduct
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Top Section: Product Catalog Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayersIcon className="size-4 text-primary" />
              Katalog Produk Bot Telegram
            </CardTitle>
            <CardDescription>
              Semua produk aktif di bawah ini otomatis muncul saat pembeli
              mengetik /katalog di bot Telegram.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (products.length > 0) {
                  setSelectedProductIdForStock(products[0].id)
                }
                setIsAddStockOpen(true)
              }}
            >
              <PackagePlusIcon data-icon="inline-start" />
              Restock Gudang Akun
            </Button>
            <Button onClick={() => setIsAddProductOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Tambah Produk Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Harga Jual</TableHead>
                <TableHead>Stok Siap Kirim</TableHead>
                <TableHead>Terjual</TableHead>
                <TableHead>Status Bot</TableHead>
                <TableHead className="text-right">Aksi Cepat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((prod) => (
                <TableRow key={prod.id}>
                  <TableCell className="font-mono font-semibold text-xs">
                    {prod.code}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {prod.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">
                      {prod.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{prod.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-foreground">
                      {formatRupiah(prod.price)}
                    </div>
                    {prod.originalPrice > prod.price && (
                      <div className="text-xs line-through text-muted-foreground">
                        {formatRupiah(prod.originalPrice)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        prod.availableStock > 0 ? "default" : "destructive"
                      }
                    >
                      {prod.availableStock > 0
                        ? `${prod.availableStock} Akun Ready`
                        : "Stok Habis (0)"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {prod.soldCount}x
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={prod.isActive}
                      onCheckedChange={async (checked) => {
                        await toggleProductActiveAction(prod.id, checked)
                        toast.success(
                          `Status produk ${prod.code} diubah menjadi ${checked ? "Aktif" : "Nonaktif"}`
                        )
                        onMutate()
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProductIdForStock(prod.id)
                          setIsAddStockOpen(true)
                        }}
                      >
                        <PlusIcon data-icon="inline-start" />
                        Isi Stok
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={async () => {
                          await deleteProductAction(prod.id)
                          toast.success(`Produk ${prod.code} dihapus`)
                          onMutate()
                        }}
                      >
                        <Trash2Icon className="text-destructive" />
                        <span className="sr-only">Hapus</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bottom Section: Auto-Delivery Credentials Vault */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRoundIcon className="size-4 text-primary" />
              Brankas Stok Auto-Delivery (Akun / Voucher / Link SC)
            </CardTitle>
            <CardDescription>
              Setiap baris stok berstatus &quot;available&quot; akan diambil 1 per 1 secara
              otomatis oleh bot saat pembeli melunasi pesanan.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant={stockFilterProduct === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setStockFilterProduct("ALL")}
            >
              Semua ({stocks.length})
            </Button>
            {products.map((p) => (
              <Button
                key={p.code}
                variant={stockFilterProduct === p.code ? "default" : "outline"}
                size="sm"
                onClick={() => setStockFilterProduct(p.code)}
              >
                {p.code} ({p.availableStock})
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Kode Produk</TableHead>
                <TableHead>Data Kredensial / Akun / Voucher (Auto-Send)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice / Pembeli</TableHead>
                <TableHead className="text-right">Hapus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStocks.map((stk) => (
                <TableRow key={stk.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{stk.id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {stk.productCode}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-md truncate">
                    {stk.credentials}
                  </TableCell>
                  <TableCell>
                    {stk.status === "available" ? (
                      <Badge variant="default">Siap Kirim (Available)</Badge>
                    ) : (
                      <Badge variant="secondary">Terjual (Sold)</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {stk.orderInvoice
                      ? `${stk.orderInvoice} (ID: ${stk.buyerTelegramId})`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={async () => {
                        await deleteStockItemAction(stk.id)
                        toast.success("Item stok dihapus dari gudang")
                        onMutate()
                      }}
                    >
                      <Trash2Icon className="text-muted-foreground hover:text-destructive" />
                      <span className="sr-only">Hapus stok</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Tambah Produk Baru */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Produk Digital Baru</DialogTitle>
            <DialogDescription>
              Produk akan langsung tampil di menu /katalog bot beserta stok awal
              yang Anda masukkan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProduct} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prod-code">Kode Produk (Unik)</Label>
                <Input
                  id="prod-code"
                  placeholder="Contoh: SPOTIFY1B"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prod-cat">Kategori</Label>
                <Input
                  id="prod-cat"
                  placeholder="Streaming / AI / Source Code"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prod-name">Nama Lengkap Produk</Label>
              <Input
                id="prod-name"
                placeholder="Contoh: Spotify Premium Individual 1 Bulan Full Garansi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prod-price">Harga Jual Bot (Rp)</Label>
                <Input
                  id="prod-price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prod-orig">Harga Coret / Normal (Rp)</Label>
                <Input
                  id="prod-orig"
                  type="number"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prod-desc">Deskripsi Produk</Label>
              <Textarea
                id="prod-desc"
                rows={2}
                placeholder="Penjelasan singkat keunggulan & garansi produk..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prod-terms">Instruksi Login / Syarat Garansi</Label>
              <Input
                id="prod-terms"
                placeholder="Contoh: Dilarang mengganti email/password akun."
                value={termsInstructions}
                onChange={(e) => setTermsInstructions(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prod-stocks">
                Stok Awal Auto-Delivery (1 Baris = 1 Akun/Voucher)
              </Label>
              <Textarea
                id="prod-stocks"
                rows={3}
                className="font-mono text-xs"
                placeholder={`Email: user1@domain.com | Pass: Rahasia123\nEmail: user2@domain.com | Pass: Rahasia456`}
                value={initialStocks}
                onChange={(e) => setInitialStocks(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddProductOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <CheckCircle2Icon data-icon="inline-start" />
                Simpan Produk & Stok
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Bulk Restock Gudang */}
      <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Stok Akun / Voucher Massal (Bulk)</DialogTitle>
            <DialogDescription>
              Masukkan data akun, kode voucher, atau link download. Pisahkan
              dengan baris baru (Enter) untuk setiap 1 stok.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBulkAddStock} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="select-prod-stock">Pilih Produk</Label>
              <select
                id="select-prod-stock"
                value={selectedProductIdForStock}
                onChange={(e) =>
                  setSelectedProductIdForStock(Number(e.target.value))
                }
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name} (Sisa: {p.availableStock} stok)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-creds">
                Daftar Akun / Voucher (1 Baris = 1 Stok Pembeli)
              </Label>
              <Textarea
                id="bulk-creds"
                rows={6}
                className="font-mono text-xs"
                placeholder={`Email: akunbaru01@garudastore.id | Pass: ProMax#11 | PIN: 1122\nEmail: akunbaru02@garudastore.id | Pass: ProMax#22 | PIN: 3344\nEmail: akunbaru03@garudastore.id | Pass: ProMax#33 | PIN: 5566`}
                value={rawCredentials}
                onChange={(e) => setRawCredentials(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddStockOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <PackagePlusIcon data-icon="inline-start" />
                Tambahkan ke Brankas Stok
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
