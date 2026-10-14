export interface ParsedQrisInfo {
  isValid: boolean
  isDynamic: boolean
  merchantName: string
  merchantCity: string
  nmid: string
  postalCode: string
  crcValid: boolean
  rawString: string
}

/**
 * Calculates the official EMVCo QRIS CRC16-CCITT checksum (0xFFFF initial, 0x1021 polynomial)
 */
export function calculateCRC16(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

/**
 * Extracts Merchant Name (Tag 59), City (Tag 60), NMID, and CRC validity from any EMVCo QRIS string
 */
export function parseQrisPayloadInfo(qrisString: string): ParsedQrisInfo {
  const clean = qrisString.trim()

  if (!clean.startsWith("000201") || clean.length < 30) {
    return {
      isValid: false,
      isDynamic: false,
      merchantName: "MERCHANT QRIS",
      merchantCity: "INDONESIA",
      nmid: "-",
      postalCode: "-",
      crcValid: false,
      rawString: clean,
    }
  }

  const isDynamic = clean.includes("010212")

  // Extract Tag 59 (Merchant Name) and Tag 60 (Merchant City) right after 5802ID
  let merchantName = "GARUDA DIGITAL STORE"
  let merchantCity = "JAKARTA"
  let postalCode = "12190"

  const countryIdx = clean.indexOf("5802ID")
  if (countryIdx !== -1) {
    let cursor = countryIdx + 6
    while (cursor + 4 <= clean.length) {
      const tag = clean.slice(cursor, cursor + 2)
      const len = parseInt(clean.slice(cursor + 2, cursor + 4), 10)
      if (isNaN(len) || len < 0 || cursor + 4 + len > clean.length) break
      const val = clean.slice(cursor + 4, cursor + 4 + len)
      if (tag === "59") merchantName = val
      if (tag === "60") merchantCity = val
      if (tag === "61") postalCode = val
      if (tag === "63") break
      cursor += 4 + len
    }
  }

  // Extract NMID (ID102... or ID202...)
  const nmidMatch = clean.match(/(ID[0-9]{10,15})/)
  const nmid = nmidMatch ? nmidMatch[1] : "ID1024319884210"

  const withoutCrcValue = clean.slice(0, -4)
  const expectedCrc = calculateCRC16(withoutCrcValue)
  const actualCrc = clean.slice(-4).toUpperCase()

  return {
    isValid: true,
    isDynamic,
    merchantName,
    merchantCity,
    nmid,
    postalCode,
    crcValid: expectedCrc === actualCrc,
    rawString: clean,
  }
}

/**
 * Converts a Static QRIS string (010211) into a Dynamic QRIS string (010212)
 * with embedded nominal (Tag 54) and recalculated CRC16 checksum (Tag 6304).
 */
export function convertStaticToDynamicQris(
  staticQris: string,
  amount: number
): string {
  const clean = staticQris.trim()
  const numericAmount = Math.max(0, Math.round(amount))

  if (!clean.startsWith("000201") || numericAmount <= 0) {
    return clean
  }

  // 1. Strip trailing 6304XXXX CRC if present, or last 4 chars
  let body = clean
  const crcTagIdx = body.lastIndexOf("6304")
  if (crcTagIdx !== -1 && crcTagIdx >= body.length - 8) {
    body = body.slice(0, crcTagIdx)
  } else {
    body = body.slice(0, -4)
  }

  // 2. Switch Point of Initiation Method from Static (010211) to Dynamic (010212)
  body = body.replace(/^000201010211/, "000201010212")

  // 3. Remove any existing Tag 54 right before 5802ID or after 5303360
  body = body.replace(/530336054\d{2}\d+5802ID/, "53033605802ID")

  // 4. Construct new Tag 54 (Transaction Amount)
  const amountStr = String(numericAmount)
  const amountLen = amountStr.length.toString(10).padStart(2, "0")
  const tag54 = `54${amountLen}${amountStr}`

  // 5. Inject Tag 54 right before 5802ID
  if (body.includes("5802ID")) {
    body = body.replace("5802ID", `${tag54}5802ID`)
  } else {
    body += tag54
  }

  // 6. Append 6304 and calculate fresh CRC16-CCITT checksum
  const payloadWithCrcHeader = `${body}6304`
  const crc = calculateCRC16(payloadWithCrcHeader)
  return `${payloadWithCrcHeader}${crc}`
}

/**
 * Extracts nominal IDR amount from Indonesian payment notification text
 * Supports GoPay Merchant, DANA Bisnis, OrderKuota, ShopeePay Merchant, SeaBank, BCA, Livin, etc.
 */
export function extractAmountFromNotificationText(text: string): number | null {
  if (!text) return null
  const normalized = text.trim()

  // 1. Match "Rp 35.142", "Rp35.142,00", "IDR 100.215"
  const rpMatch = normalized.match(
    /(?:Rp\.?|IDR)\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,9})(?:,[0-9]{1,2})?/i
  )
  if (rpMatch && rpMatch[1]) {
    const digits = parseInt(rpMatch[1].replace(/\./g, ""), 10)
    if (!isNaN(digits) && digits >= 100) return digits
  }

  // 2. Match standalone formatted currency like "sebesar 35.142" or plain number
  const genericMatch = normalized.match(
    /\b([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,9})\b/
  )
  if (genericMatch && genericMatch[1]) {
    const digits = parseInt(genericMatch[1].replace(/\./g, ""), 10)
    if (!isNaN(digits) && digits >= 100) return digits
  }

  return null
}
