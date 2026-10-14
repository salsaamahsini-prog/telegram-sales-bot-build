"use client"

import * as React from "react"
import QRCode from "qrcode"
import jsQR from "jsqr"
import {
  convertStaticToDynamicQris,
  parseQrisPayloadInfo,
} from "@/lib/qris-utils"
import {
  saveStaticQrisConfigAction,
  simulateQrisMutationWebhookAction,
  sendSimulatorCommandAction,
} from "@/app/actions/store-actions"
import type { BotSettingsData } from "@/components/source-code-generator"
import type { OrderRow, DepositRow } from "@/components/orders-deposits-panel"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
  QrCodeIcon,
  UploadIcon,
  CheckCircle2Icon,
  SparklesIcon,
  CopyIcon,
  SmartphoneIcon,
  ZapIcon,
  ShieldCheckIcon,
  SendIcon,
  RefreshCwIcon,
  AlertCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

export interface QrisMutationRow {
  id: number
  sourceApp: string
  rawNotification: string
  amount: number
  matchedReference: string | null
  status: string
  createdAt: string
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function QrisAutoMutasiStudio({
  settings,
  orders,
  deposits,
  mutations,
  onMutate,
}: {
  settings: BotSettingsData
  orders: OrderRow[]
  deposits: DepositRow[]
  mutations: QrisMutationRow[]
  onMutate: () => void
}) {
  const [qrisString, setQrisString] = React.useState(
    settings?.qrisString ||
      "00020101021126610014COM.GO-JEK.WWW01189360091431988421020215ID10243198842100303UMI51440014ID.CO.QRIS.WWW0215ID10243198842100303UMI5204581553033605802ID5920GARUDA DIGITAL STORE6007JAKARTA61051219063042C94"
  )
  const [merchantName, setMerchantName] = React.useState(
    settings?.qrisMerchantName || "GARUDA DIGITAL STORE"
  )
  const [nmid, setNmid] = React.useState(
    settings?.qrisNmid || "ID1024319884210"
  )
  const [uniqueCodeEnabled, setUniqueCodeEnabled] = React.useState(
    settings?.qrisUniqueCodeEnabled ?? true
  )
  const [isSavingConfig, setIsSavingConfig] = React.useState(false)

  // Dynamic QRIS preview state
  const [previewBaseAmount, setPreviewBaseAmount] = React.useState(35000)
  const [previewUniqueCode, setPreviewUniqueCode] = React.useState(142)
  const [qrDataUrl, setQrDataUrl] = React.useState<string>("")

  // Webhook auto-mutation simulator state
  const pendingQrisOrders = orders.filter(
    (o) => o.status === "pending" && o.paymentMethod === "QRIS"
  )
  const pendingDeposits = deposits.filter((d) => d.status === "pending")

  const [sourceApp, setSourceApp] = React.useState(
    "GoPay Merchant (Notif Forwarder)"
  )
  const [notifText, setNotifText] = React.useState(() => {
    if (pendingQrisOrders.length > 0) {
      return `Pembayaran QRIS Rp ${pendingQrisOrders[0].totalAmount.toLocaleString("id-ID")} berhasil diterima di ${settings?.qrisMerchantName || "GARUDA DIGITAL STORE"}`
    }
    return `Pembayaran QRIS Rp 35.142 berhasil diterima di ${settings?.qrisMerchantName || "GARUDA DIGITAL STORE"}`
  })
  const [isSimulatingMutasi, setIsSimulatingMutasi] = React.useState(false)
  const [isCreatingSampleOrder, setIsCreatingSampleOrder] =
    React.useState(false)
  const [lastMutasiResult, setLastMutasiResult] = React.useState<{
    matched: boolean
    message: string
    deliveredCredentials?: string
    referenceId?: string
  } | null>(null)

  const [originUrl, setOriginUrl] = React.useState(
    "https://bot-toko-kamu.vercel.app"
  )
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOriginUrl(window.location.origin)
    }
  }, [])

  const parsedInfo = React.useMemo(
    () => parseQrisPayloadInfo(qrisString),
    [qrisString]
  )

  const totalPreviewNominal =
    Number(previewBaseAmount || 0) +
    (uniqueCodeEnabled ? Number(previewUniqueCode || 0) : 0)

  const dynamicQrisPayload = React.useMemo(
    () => convertStaticToDynamicQris(qrisString, totalPreviewNominal),
    [qrisString, totalPreviewNominal]
  )

  React.useEffect(() => {
    let active = true
    QRCode.toDataURL(dynamicQrisPayload || "INVALID_QRIS", {
      width: 240,
      margin: 1,
      color: {
        dark: "#111827",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [dynamicQrisPayload])

  // Upload static QRIS image and decode QR payload in browser
  async function handleUploadQrisImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code && code.data && code.data.startsWith("000201")) {
          const info = parseQrisPayloadInfo(code.data)
          setQrisString(code.data)
          if (info.merchantName && info.merchantName !== "MERCHANT QRIS") {
            setMerchantName(info.merchantName)
          }
          if (info.nmid && info.nmid !== "-") {
            setNmid(info.nmid)
          }
          toast.success(
            `Berhasil membaca gambar QRIS Statis! Merchant terdeteksi: ${info.merchantName} (${info.merchantCity})`
          )
        } else {
          toast.error(
            "Gambar tidak mengandung kode QRIS standar (000201...). Pastikan bagian kotak QR terlihat jelas."
          )
        }
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  async function handleSaveQrisConfig() {
    if (!qrisString.trim().startsWith("000201")) {
      toast.error("Payload QRIS harus diawali dengan 000201 (Standar EMVCo)")
      return
    }
    setIsSavingConfig(true)
    try {
      await saveStaticQrisConfigAction({
        qrisString,
        qrisMerchantName: merchantName,
        qrisNmid: nmid,
        qrisUniqueCodeEnabled: uniqueCodeEnabled,
      })
      toast.success(
        "QRIS Statis milikmu berhasil disimpan! Semua tagihan bot kini otomatis dikonversi ke QRIS Dinamis."
      )
      onMutate()
    } catch (e) {
      toast.error("Gagal menyimpan konfigurasi QRIS")
    } finally {
      setIsSavingConfig(false)
    }
  }

  async function handleCreateSamplePendingOrder() {
    setIsCreatingSampleOrder(true)
    try {
      const res = await sendSimulatorCommandAction({
        telegramId: "998877665",
        username: "pembeli_simulator",
        fullName: "Rizky Pratama (Simulator)",
        input: "BUY_QRIS:NETFLIX1B",
      })
      if (res.qrisCard) {
        const formattedNominal = res.qrisCard.totalAmount.toLocaleString("id-ID")
        setNotifText(
          `Pembayaran QRIS Rp ${formattedNominal} berhasil diterima di ${merchantName}`
        )
        toast.success(
          `Tagihan QRIS ${res.qrisCard.referenceId} sebesar ${formatRupiah(res.qrisCard.totalAmount)} dibuat! Sekarang klik tombol 'Simulasikan Uang Masuk'.`
        )
      }
      onMutate()
    } catch (e) {
      toast.error("Gagal membuat tagihan sampel")
    } finally {
      setIsCreatingSampleOrder(false)
    }
  }

  async function handleSimulateWebhookMutasi() {
    if (!notifText.trim()) {
      toast.error("Masukkan teks notifikasi pembayaran QRIS terlebih dahulu")
      return
    }
    setIsSimulatingMutasi(true)
    try {
      const res = await simulateQrisMutationWebhookAction({
        rawNotification: notifText,
        sourceApp,
      })
      setLastMutasiResult({
        matched: res.matched,
        message: res.message,
        deliveredCredentials:
          "deliveredCredentials" in res ? res.deliveredCredentials : undefined,
        referenceId: "referenceId" in res ? res.referenceId : undefined,
      })
      if (res.matched) {
        toast.success(res.message)
      } else {
        toast.info(res.message)
      }
      onMutate()
    } catch (e) {
      toast.error("Gagal memproses simulasi webhook mutasi")
    } finally {
      setIsSimulatingMutasi(false)
    }
  }

  const mutasiWebhookUrl = `${originUrl}/api/qris/mutasi`

  return (
    <div className="flex flex-col gap-6">
      {/* Top 3-Step Visual Architecture Banner */}
      <Card className="border-primary/25 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCodeIcon className="size-5 text-primary" />
              Cara Kerja QRIS Statis Pribadi + Auto-Cek Mutasi (Tanpa Fee Payment Gateway)
            </CardTitle>
            <Badge variant="default">100% Otomatis 24 Jam</Badge>
          </div>
          <CardDescription className="text-xs">
            Kamu bisa memakai QRIS Statis milik sendiri (GoPay Merchant, DANA Bisnis, ShopeePay Merchant, OrderKuota, SeaBank, BCA) dan tetap bisa <strong>Auto-Verify + Auto-Kirim Produk</strong> dalam hitungan detik dengan 3 langkah berikut:
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-border bg-background p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                1
              </span>
              Konversi QRIS Statis ke Dinamis (CRC16)
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Upload gambar QRIS Statis kamu di bawah. Saat ada pembeli order (misal Rp 35.000), bot otomatis menyuntikkan <strong>Kode Unik 3 Digit</strong> (misal +142 = <strong>Rp 35.142</strong>) ke dalam chip QRIS (Tag 54 + CRC16). Saat pembeli scan, nominal Rp 35.142 langsung terisi otomatis!
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                2
              </span>
              Forward Notifikasi Uang Masuk dari HP
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Pasang aplikasi gratis <strong>Notification Forwarder / MacroDroid</strong> di HP Android tempat aplikasi GoPay Merchant / DANA Bisnis / OrderKuota terpasang. Setiap ada notifikasi uang masuk, aplikasi otomatis meneruskan teks notifikasi ke URL Webhook <code>/api/qris/mutasi</code>.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                3
              </span>
              Auto-Match Nominal &amp; Kirim Produk
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Server membaca angka <strong>Rp 35.142</strong> dari notifikasi tersebut, mencocokkan dengan invoice yang sedang <code>PENDING</code>, mengubah status jadi <strong>LUNAS</strong>, lalu bot otomatis mengirimkan akun/voucher ke chat Telegram pembeli detik itu juga!
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 7 COLS: Upload QRIS Statis & Live Dynamic QRIS Converter */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    1. Pasang QRIS Statis Milikmu (Auto-Decode Gambar / String)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Upload foto/screenshot QRIS Statis toko kamu atau tempel kode string EMVCo (000201...). Sistem otomatis mengekstrak Nama Merchant &amp; NMID.
                  </CardDescription>
                </div>
                <Badge variant={parsedInfo.isValid ? "default" : "destructive"}>
                  {parsedInfo.isValid ? "Format EMVCo Valid" : "QRIS Tidak Valid"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Upload QRIS Image Box */}
              <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UploadIcon className="size-5" />
                  </div>
                  <div className="text-xs">
                    <div className="font-semibold text-foreground">
                      Punya Gambar / Screenshot QRIS Statis?
                    </div>
                    <div className="text-muted-foreground">
                      Pilih file gambar QRIS (GoPay Merchant, DANA Bisnis, OrderKuota, ShopeePay) untuk dibaca otomatis tanpa ketik manual.
                    </div>
                  </div>
                </div>
                <label className="cursor-pointer shrink-0">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadQrisImage}
                    className="sr-only"
                  />
                  <span className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted transition-colors">
                    Upload Gambar QRIS
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    Raw String QRIS Statis (Payload EMVCo)
                  </Label>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Kota: {parsedInfo.merchantCity} • Tipe Asal:{" "}
                    {parsedInfo.isDynamic ? "Dinamis (010212)" : "Statis (010211)"}
                  </span>
                </div>
                <Textarea
                  rows={3}
                  value={qrisString}
                  onChange={(e) => {
                    const val = e.target.value
                    setQrisString(val)
                    const info = parseQrisPayloadInfo(val)
                    if (info.isValid && info.merchantName !== "MERCHANT QRIS") {
                      setMerchantName(info.merchantName)
                      setNmid(info.nmid)
                    }
                  }}
                  className="font-mono text-xs"
                  placeholder="00020101021126610014COM.GO-JEK.WWW..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Nama Merchant QRIS (Tag 59)</Label>
                  <Input
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="GARUDA DIGITAL STORE"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">NMID / ID Merchant</Label>
                  <Input
                    value={nmid}
                    onChange={(e) => setNmid(e.target.value)}
                    className="font-mono text-xs"
                    placeholder="ID1024319884210"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">
                    Aktifkan Kode Unik 3 Digit Otomatis (+101 s/d +499)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Wajib aktif agar sistem Auto-Mutasi bisa membedakan pembayaran antar pembeli secara akurat.
                  </span>
                </div>
                <Switch
                  checked={uniqueCodeEnabled}
                  onCheckedChange={setUniqueCodeEnabled}
                />
              </div>
            </CardContent>
            <CardFooter className="border-t border-border pt-4 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Tersimpan di database utama &amp; langsung dipakai oleh Bot Telegram.
              </span>
              <Button
                size="sm"
                onClick={handleSaveQrisConfig}
                disabled={isSavingConfig}
              >
                <CheckCircle2Icon data-icon="inline-start" />
                {isSavingConfig
                  ? "Menyimpan..."
                  : "Simpan QRIS Statis ke Bot"}
              </Button>
            </CardFooter>
          </Card>

          {/* Live Webhook Auto-Mutasi Guide for Android Notification Forwarder / MacroDroid */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <SmartphoneIcon className="size-4 text-primary" />
                2. Integrasi Auto-Cek Uang Masuk (Webhook Notifikasi HP / OrderKuota)
              </CardTitle>
              <CardDescription className="text-xs">
                Hubungkan aplikasi notifikasi di HP Android kamu ke endpoint di bawah ini agar setiap ada pembayaran QRIS masuk, bot otomatis mengirim produk tanpa perlu konfirmasi manual.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  URL Endpoint Webhook Auto-Mutasi QRIS Kamu:
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={mutasiWebhookUrl}
                    className="font-mono text-xs bg-muted/40"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(mutasiWebhookUrl)
                      toast.success("URL Webhook Mutasi berhasil disalin!")
                    }}
                  >
                    <CopyIcon data-icon="inline-start" />
                    Salin URL
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3.5 flex flex-col gap-2">
                <div className="font-semibold text-foreground">
                  Cara Setting di Aplikasi Android &quot;Notification Forwarder&quot; / &quot;MacroDroid&quot; (3 Menit):
                </div>
                <ol className="list-decimal list-inside flex flex-col gap-1.5 text-muted-foreground">
                  <li>
                    Install aplikasi <strong>MacroDroid</strong> atau <strong>Incoming Notification Webhook Forwarder</strong> di HP Android yang terpasang aplikasi <strong>GoPay Merchant / DANA Bisnis / OrderKuota / SeaBank / Livin</strong>.
                  </li>
                  <li>
                    Buat Trigger <strong>Notification Received (Notifikasi Masuk)</strong> lalu pilih aplikasi merchant kamu (contoh: <em>GoPay Merchant</em> atau <em>OrderKuota</em>).
                  </li>
                  <li>
                    Pilih Action <strong>HTTP Request (POST JSON)</strong> ke URL: <code className="text-primary">{mutasiWebhookUrl}</code>
                  </li>
                  <li>
                    Isi Body JSON seperti di bawah ini (otomatis mengirim isi teks notifikasi ke server bot):
                  </li>
                </ol>
                <pre className="mt-1 rounded-lg bg-neutral-950 text-neutral-100 p-3 font-mono text-[11px] overflow-x-auto">
{`{
  "app": "GoPay Merchant",
  "text": "{notification_text}"
}`}
                </pre>
                <p className="text-[11px] text-muted-foreground">
                  Atau jika menggunakan metode <strong>HTTP GET</strong> di MacroDroid cukup panggil:{" "}
                  <code className="text-foreground">
                    {mutasiWebhookUrl}?text=&#123;not_text&#125;
                  </code>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT 5 COLS: Live Dynamic QRIS Preview + Webhook Mutasi Simulator */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Dynamic QRIS Generator Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <SparklesIcon className="size-4 text-primary" />
                  Preview Konversi QRIS Dinamis (Auto-Nominal)
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  CRC16: {dynamicQrisPayload.slice(-4)}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Coba ubah nominal di bawah: QRIS Statis kamu otomatis disuntikkan Tag 54 (Nominal) + Checksum CRC16 baru sehingga saat di-scan pembeli nominalnya langsung muncul!
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Harga Produk (Rp)</Label>
                  <Input
                    type="number"
                    value={previewBaseAmount}
                    onChange={(e) =>
                      setPreviewBaseAmount(Number(e.target.value))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Kode Unik (3 Digit)</Label>
                  <Input
                    type="number"
                    value={previewUniqueCode}
                    onChange={(e) =>
                      setPreviewUniqueCode(Number(e.target.value))
                    }
                    disabled={!uniqueCodeEnabled}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center rounded-xl border border-border bg-white p-4 text-neutral-900 shadow-2xs">
                <div className="flex w-full items-center justify-between border-b border-neutral-200 pb-2 mb-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-neutral-900">
                      {merchantName}
                    </div>
                    <div className="font-mono text-[10px] text-neutral-500">
                      NMID: {nmid}
                    </div>
                  </div>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                    QRIS DINAMIS
                  </span>
                </div>

                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QRIS Dinamis Auto Nominal"
                    className="size-48 rounded-lg border border-neutral-200 p-1"
                  />
                ) : (
                  <div className="size-48 flex items-center justify-center text-xs text-neutral-400">
                    Generating QR...
                  </div>
                )}

                <div className="mt-3 w-full rounded-lg bg-neutral-100 p-2.5 text-center">
                  <div className="text-[11px] text-neutral-600">
                    Nominal Otomatis Terbaca Saat Scan:
                  </div>
                  <div className="font-mono text-lg font-bold text-neutral-900">
                    {formatRupiah(totalPreviewNominal)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Hasil String QRIS Dinamis (Tag 010212 + Tag 54 Nominal + CRC16):
                </span>
                <div className="rounded-lg border border-border bg-muted/40 p-2 font-mono text-[10px] break-all text-muted-foreground">
                  {dynamicQrisPayload}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Webhook Auto-Mutasi Tester */}
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <ZapIcon className="size-4 text-primary" />
                  3. Test Tembak Webhook Auto-Mutasi Live
                </CardTitle>
                <Badge variant="secondary">Real-Time Match</Badge>
              </div>
              <CardDescription className="text-xs">
                Simulasikan notifikasi HP masuk ke <code>/api/qris/mutasi</code>. Jika nominal cocok dengan Order/Deposit yang sedang <code>PENDING</code>, produk langsung terkirim otomatis!
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              {/* Pending Invoices Quick Picker */}
              <div className="rounded-lg border border-border bg-muted/25 p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    Tagihan QRIS yang Sedang Menunggu Bayar ({pendingQrisOrders.length + pendingDeposits.length}):
                  </span>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleCreateSamplePendingOrder}
                    disabled={isCreatingSampleOrder}
                  >
                    + Buat Tagihan QRIS Baru
                  </Button>
                </div>

                {pendingQrisOrders.length === 0 &&
                pendingDeposits.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground py-1">
                    Belum ada tagihan QRIS berstatus PENDING. Klik tombol <strong>+ Buat Tagihan QRIS Baru</strong> di atas untuk membuat invoice pengetesan.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {pendingQrisOrders.map((po) => (
                      <div
                        key={po.id}
                        className="flex items-center justify-between rounded bg-background border border-border px-2.5 py-1.5"
                      >
                        <div>
                          <div className="font-mono font-semibold text-foreground">
                            {po.invoiceId} • {formatRupiah(po.totalAmount)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {po.productName} (@{po.buyerUsername})
                          </div>
                        </div>
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => {
                            setNotifText(
                              `Pembayaran QRIS Rp ${po.totalAmount.toLocaleString("id-ID")} berhasil diterima di ${merchantName}`
                            )
                            toast.info(
                              `Nominal ${formatRupiah(po.totalAmount)} dimasukkan ke simulator notifikasi!`
                            )
                          }}
                        >
                          Pakai Nominal Ini
                        </Button>
                      </div>
                    ))}
                    {pendingDeposits.map((pd) => (
                      <div
                        key={pd.id}
                        className="flex items-center justify-between rounded bg-background border border-border px-2.5 py-1.5"
                      >
                        <div>
                          <div className="font-mono font-semibold text-foreground">
                            {pd.depositId} • {formatRupiah(pd.totalTransfer)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Deposit Saldo (@{pd.username})
                          </div>
                        </div>
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => {
                            setNotifText(
                              `Pembayaran QRIS Rp ${pd.totalTransfer.toLocaleString("id-ID")} berhasil diterima di ${merchantName}`
                            )
                          }}
                        >
                          Pakai Nominal Ini
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Sumber Aplikasi Merchant</Label>
                <Input
                  value={sourceApp}
                  onChange={(e) => setSourceApp(e.target.value)}
                  placeholder="GoPay Merchant / DANA Bisnis / OrderKuota"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  Isi Teks Notifikasi Uang Masuk (Mengandung Nominal + Kode Unik)
                </Label>
                <Textarea
                  rows={2}
                  value={notifText}
                  onChange={(e) => setNotifText(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <Button
                onClick={handleSimulateWebhookMutasi}
                disabled={isSimulatingMutasi}
                className="w-full"
              >
                <SendIcon data-icon="inline-start" />
                {isSimulatingMutasi
                  ? "Memproses Mutasi & Mencocokkan Tagihan..."
                  : "Simulasikan Notifikasi Uang Masuk ke Webhook"}
              </Button>

              {lastMutasiResult && (
                <div
                  className={`rounded-xl border p-3 ${
                    lastMutasiResult.matched
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-amber-500/40 bg-amber-500/10"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    {lastMutasiResult.matched ? (
                      <CheckCircle2Icon className="size-4 text-emerald-600" />
                    ) : (
                      <AlertCircleIcon className="size-4 text-amber-600" />
                    )}
                    <span>
                      {lastMutasiResult.matched
                        ? `AUTO-VERIFY & AUTO-DELIVERY BERHASIL (${lastMutasiResult.referenceId})`
                        : "MUTASI TERCATAT (BELUM ADA TAGIHAN COCOK)"}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {lastMutasiResult.message}
                  </p>
                  {lastMutasiResult.deliveredCredentials && (
                    <div className="mt-2 rounded bg-background border border-border p-2 font-mono text-[11px] text-primary">
                      Data Terkirim Otomatis: {lastMutasiResult.deliveredCredentials}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Table: Live Log Mutasi QRIS Masuk */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Riwayat Log Mutasi QRIS Masuk (`/api/qris/mutasi`)
              </CardTitle>
              <CardDescription className="text-xs">
                Daftar notifikasi pembayaran QRIS yang diterima oleh webhook dan hasil pencocokan otomatisnya dengan kode unik pesanan.
              </CardDescription>
            </div>
            <Badge variant="outline">{mutations.length} Log Mutasi</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aplikasi Sumber</TableHead>
                <TableHead>Isi Notifikasi Masuk</TableHead>
                <TableHead>Nominal Terbaca</TableHead>
                <TableHead>Invoice Cocok</TableHead>
                <TableHead className="text-right">Status Auto-Cek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mutations.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs font-medium">
                    {m.sourceApp}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-md truncate">
                    {m.rawNotification}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-primary">
                    {formatRupiah(m.amount)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {m.matchedReference ? (
                      <Badge variant="outline" className="font-mono">
                        {m.matchedReference}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.status === "matched" ? (
                      <Badge variant="default">Cocok &amp; Auto-Kirim</Badge>
                    ) : (
                      <Badge variant="secondary">Unmatched</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
