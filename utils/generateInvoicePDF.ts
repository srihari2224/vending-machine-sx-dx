/* ═══════════════════════════════════════════════
   INVOICE PDF GENERATOR — PRINTIT / INNVERA
   White · Helvetica (Inter-like) · Courier (Mono)
   ═══════════════════════════════════════════════ */

export interface InvoiceQueueItem {
    fileName: string
    pagesToPrint?: number
    printSettings?: {
        copies: number
        colorMode: "color" | "bw"
        doubleSided: "one-side" | "both-sides"
    }
    cost: number
}

export interface InvoiceData {
    otp?: string
    kioskId: string
    queue: InvoiceQueueItem[]
    totalAmount: number
    customerPhone?: string
    isSettlement?: boolean
}

/* ── Load jsPDF from CDN ── */
function loadJsPDF(): Promise<any> {
    return new Promise((resolve, reject) => {
        if ((window as any).jspdf?.jsPDF) return resolve((window as any).jspdf.jsPDF)
        const script = document.createElement("script")
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
        script.onload = () => {
            if ((window as any).jspdf?.jsPDF) resolve((window as any).jspdf.jsPDF)
            else reject(new Error("jsPDF not loaded"))
        }
        script.onerror = reject
        document.head.appendChild(script)
    })
}

/* ── Draw stamp matching INNVERA official stamp image ──
   Two concentric circles, text wraps full 360° around outer ring,
   address block in center, star at bottom. Purple/indigo colour.
*/
function drawStamp(radiusPx: number): string {
    const pad = 30
    const dim = radiusPx * 2 + pad * 2
    const canvas = document.createElement("canvas")
    canvas.width = dim
    canvas.height = dim
    const ctx = canvas.getContext("2d")
    if (!ctx) return ""

    const cx = dim / 2
    const cy = dim / 2
    const OR = radiusPx - 6
    const IR = OR - 28
    const color = "rgba(85, 65, 148, 0.72)"

    ctx.strokeStyle = color

    // Outer ring (thick)
    ctx.lineWidth = 6
    ctx.beginPath(); ctx.arc(cx, cy, OR, 0, Math.PI * 2); ctx.stroke()

    // Inner ring (thin)
    ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(cx, cy, IR, 0, Math.PI * 2); ctx.stroke()

    ctx.fillStyle = color

    // Full circular text: "INNVERA TECHNOLOGY PRIVATE LIMITED ★ "
    // Goes clockwise from left-bottom (like the real stamp)
    const ringText = "INNVERA TECHNOLOGY PRIVATE LIMITED  \u2605  "
    const arcR = OR - 14
    const fs = Math.max(9, radiusPx / 8.5)
    ctx.font = `bold ${fs}px Arial`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Start at bottom (star position), go clockwise
    const startAngle = Math.PI / 2 + 0.18 // slightly past bottom
    const totalSpan = Math.PI * 2

    for (let i = 0; i < ringText.length; i++) {
        const angle = startAngle + (i / ringText.length) * totalSpan
        ctx.save()
        ctx.translate(cx + arcR * Math.cos(angle), cy + arcR * Math.sin(angle))
        ctx.rotate(angle + Math.PI / 2)
        ctx.fillText(ringText[i], 0, 0)
        ctx.restore()
    }

    // Center address block
    const lineH = IR / 4.5
    const bodyFs = Math.max(8, radiusPx / 10.5)
    ctx.font = `${bodyFs}px Arial`
    ctx.textBaseline = "alphabetic"
    ctx.fillText("22-8-152/A3", cx, cy - lineH * 1.5)
    ctx.fillText("MADHAV PURAM", cx, cy - lineH * 0.4)
    ctx.fillText("TIRUPATI - 517507", cx, cy + lineH * 0.7)
    ctx.fillText("Andhra Pradesh", cx, cy + lineH * 1.8)

    return canvas.toDataURL("image/png", 0.93)
}

/* ════════════════════════════════════════════════
   MAIN EXPORT
   ════════════════════════════════════════════════ */
export async function generateInvoicePDF(data: InvoiceData): Promise<void> {
    const jsPDF = await loadJsPDF()
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

    const W = 210
    const M = 15
    const CW = W - 2 * M // 180mm

    // ── Colour helpers ───────────────────────────────
    const BLUE = [26, 58, 107] as [number, number, number]
    const BLACK = [10, 10, 10] as [number, number, number]
    const GRAY = [110, 110, 110] as [number, number, number]
    const MID = [75, 75, 75] as [number, number, number]
    const CORAL = [218, 72, 36] as [number, number, number]
    const GREEN = [30, 148, 70] as [number, number, number]
    const WHITE = [255, 255, 255] as [number, number, number]
    const LGRAY = [210, 210, 210] as [number, number, number]
    const BGROW = [248, 248, 248] as [number, number, number]

    const tc = (c: [number, number, number]) => doc.setTextColor(...c)
    const dc = (c: [number, number, number]) => doc.setDrawColor(...c)
    const fc = (c: [number, number, number]) => doc.setFillColor(...c)

    /* ─────────────────────────────────────────────
       HEADER — two-column layout. Left: company info.
       Right: contact block. Separated by a vertical rule.
       Header total height: 38mm
    ───────────────────────────────────────────── */
    const LEFT_END = 115   // left column ends
    const RSTART = 122   // right column starts
    let y = 15

    // Company name
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); tc(BLUE)
    doc.text("INNVERA TECHNOLOGY PRIVATE LIMITED", M, y)
    y += 5.5

    doc.setFont("helvetica", "normal"); doc.setFontSize(8); tc(GRAY)
    doc.text("INNOVATE AND AUTOMATE WITH US", M, y)
    y += 4.5

    doc.setFontSize(7)
    doc.text("CIN: U28299AP2025PTC120873", M, y)

    // Vertical divider between left/right columns
    dc(LGRAY); doc.setLineWidth(0.4)
    doc.line(LEFT_END + 3, 13, LEFT_END + 3, 37)

    // Right contact block (fixed y positions, no overlap)
    const CY1 = 17, CY2 = 22, CY3 = 27, CY4 = 32
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); tc(MID)
    doc.text("Phone:", RSTART, CY1)
    doc.text("Web:", RSTART, CY2)
    doc.text("ADD:", RSTART, CY3)

    doc.setFont("helvetica", "normal"); tc(BLACK)
    doc.text("+91 8919022539", RSTART + 14, CY1)
    doc.text("innveratechnology@gmail.com", RSTART + 14, CY2)
    doc.text("22-8-152/A3, MADHAV PURAM,", RSTART + 14, CY3)
    doc.text("Tirupati - 517507, AP", RSTART + 14, CY4)

    y = 40

    // Header bottom separator — blue thick + light thin
    dc(BLUE); doc.setLineWidth(1.2)
    doc.line(M, y, W - M, y)
    dc(LGRAY); doc.setLineWidth(0.3)
    doc.line(M, y + 2, W - M, y + 2)
    y += 10

    /* ─────────────────────────────────────────────
       INVOICE META
    ───────────────────────────────────────────── */
    const now = new Date()
    const pad2 = (n: number) => String(n).padStart(2, "0")
    const invNum = `INV-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${String(now.getTime()).slice(-5)}`
    const dateStr = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}  ${pad2(now.getHours())}:${pad2(now.getMinutes())}`

    // Left: big "INVOICE"
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); tc(BLACK)
    doc.text(data.isSettlement ? "SETTLEMENT" : "INVOICE", M, y)

    // Right meta block
    const rM = 140
    const rEnd = W - M
    doc.setFontSize(7.5)
    const metaRows = [
        { label: "Invoice No.", value: invNum, dy: y - 6 },
        { label: "Date", value: dateStr, dy: y },
        { label: "Kiosk ID", value: data.kioskId, dy: y + 6 },
        ...(data.customerPhone ? [{ label: "Customer", value: data.customerPhone, dy: y + 12 }] : []),
    ]
    metaRows.forEach(({ label, value, dy }) => {
        doc.setFont("helvetica", "normal"); tc(GRAY)
        doc.text(label, rM, dy)
        doc.setFont("helvetica", "bold"); tc(BLACK)
        doc.text(value, rEnd, dy, { align: "right" })
    })

    y += (data.customerPhone ? 22 : 16)

    /* ─────────────────────────────────────────────
       OTP BLOCK (Optional)
    ───────────────────────────────────────────── */
    if (data.otp && !data.isSettlement) {
        const otpH = 42
        fc(BGROW); doc.rect(M, y, CW, otpH, "F")
        fc(CORAL); doc.rect(M, y, 4, otpH, "F")       // coral left bar
        dc([230, 210, 200]); doc.setLineWidth(0.5)
        doc.rect(M, y, CW, otpH, "S")                  // border

        doc.setFont("helvetica", "bold"); doc.setFontSize(7); tc(GRAY)
        doc.text("YOUR KIOSK ACCESS CODE", W / 2, y + 9, { align: "center" })

        // OTP digits — evenly spaced Courier
        doc.setFont("courier", "bold"); doc.setFontSize(38); tc(CORAL)
        const chars = data.otp.split("")
        const charW = 9.2
        const otpX = W / 2 - (chars.length * charW) / 2 + charW / 2
        chars.forEach((ch, i) => doc.text(ch, otpX + i * charW, y + 29))

        doc.setFont("helvetica", "normal"); doc.setFontSize(7)
        doc.setTextColor(160, 160, 160)
        doc.text("Present this code at the kiosk to collect your printed documents", W / 2, y + 38, { align: "center" })

        y += otpH + 10
    }

    /* ─────────────────────────────────────────────
       DETAILS TABLE
    ───────────────────────────────────────────── */
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); tc(BLACK)
    doc.text(data.isSettlement ? "SETTLEMENT DETAILS" : "PRINT JOB DETAILS", M, y)
    y += 3

    // col[x, w]
    const C: [number, number][] = [
        [M, 70], // File Name
        [M + 70, 20], // Pages
        [M + 90, 17], // Copies
        [M + 107, 23], // Mode
        [M + 130, 20], // Rate
        [M + 150, 30], // Amount
    ]
    const HDR = ["FILE NAME", "PAGES", "COPIES", "MODE", "RATE", "AMOUNT"]
    const ROW_H = 8
    const HDR_H = 7

    // Header row
    fc(BLACK); doc.rect(M, y, CW, HDR_H, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); tc(WHITE)
    HDR.forEach((h, i) => {
        const [cx, cw] = C[i]
        const al = i === 0 ? "left" : i === 5 ? "right" : "center"
        const tx = al === "left" ? cx + 2 : al === "right" ? cx + cw - 2 : cx + cw / 2
        doc.text(h, tx, y + 5, { align: al })
    })
    y += HDR_H

    // Data rows
    data.queue.forEach((item, idx) => {
        if (idx % 2 === 0) { fc(BGROW) } else { fc(WHITE) }
        doc.rect(M, y, CW, ROW_H, "F")

        const name = item.fileName.length > 33 ? item.fileName.substring(0, 31) + "…" : item.fileName
        const pgs = item.pagesToPrint || 1
        const copies = item.printSettings?.copies || 1
        const mode = item.printSettings?.colorMode === "color" ? "Color" : "B&W"
        const rate = item.printSettings?.colorMode === "color" ? "Rs.10/pg" : "Rs.2/pg"

        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); tc(BLACK)
        doc.text(name, C[0][0] + 2, y + 5.5)
        doc.text(`${pgs * copies}`, C[1][0] + C[1][1] / 2, y + 5.5, { align: "center" })
        doc.text(`${copies}`, C[2][0] + C[2][1] / 2, y + 5.5, { align: "center" })
        doc.text(mode, C[3][0] + C[3][1] / 2, y + 5.5, { align: "center" })
        doc.text(rate, C[4][0] + C[4][1] / 2, y + 5.5, { align: "center" })
        doc.setFont("helvetica", "bold")
        doc.text(`Rs.${item.cost}`, C[5][0] + C[5][1] - 2, y + 5.5, { align: "right" })

        dc(LGRAY); doc.setLineWidth(0.3)
        doc.line(M, y + ROW_H, W - M, y + ROW_H)
        y += ROW_H
    })

    y += 7

    /* ─────────────────────────────────────────────
       TOTALS
    ───────────────────────────────────────────── */
    const tX = W - M - 62
    const tW = 62

    doc.setFont("helvetica", "normal"); doc.setFontSize(8)
    tc(GRAY); doc.text(data.isSettlement ? "Settlement Amount" : "Print Subtotal", tX, y)
    tc(BLACK); doc.text(`Rs.${data.totalAmount}`, W - M, y, { align: "right" })
    y += 6

    tc(GRAY); doc.text("Platform Fee", tX, y)
    doc.setFont("helvetica", "bold"); tc(GREEN)
    doc.text("FREE", W - M, y, { align: "right" })
    y += 5

    dc(BLACK); doc.setLineWidth(0.7)
    doc.line(tX, y, W - M, y); y += 5

    // Grand total box
    fc(BLACK); doc.rect(tX, y, tW, 11, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); tc(WHITE)
    doc.text("GRAND TOTAL", tX + 3, y + 7)
    doc.setFontSize(11); tc(CORAL)
    doc.text(`Rs.${data.totalAmount}`, W - M - 3, y + 7, { align: "right" })

    /* ─────────────────────────────────────────────
       STAMP (bottom-right, ~38mm diameter)
    ───────────────────────────────────────────── */
    try {
        const stampImg = drawStamp(220) // 220px radius for high quality
        if (stampImg) {
            const sMM = 42
            doc.addImage(stampImg, "PNG", W - M - sMM, 238, sMM, sMM)
        }
    } catch (e) {
        console.error("Stamp error:", e)
    }

    /* ─────────────────────────────────────────────
       FOOTER
    ───────────────────────────────────────────── */
    const fY = 282
    dc(LGRAY); doc.setLineWidth(0.3)
    doc.line(M, fY - 4, W - M, fY - 4)

    doc.setFont("helvetica", "normal"); doc.setFontSize(7); tc(GRAY)
    doc.text("Thank you for using PRINTIT self-service printing kiosk!", M, fY)
    doc.text("This is a computer-generated document. No signature required.", M, fY + 4.5)
    doc.setFont("helvetica", "bold"); tc(BLUE)
    doc.text("Powered by INNVERA  ·  PRINTIT Self-Service Kiosk  ·  +91 8919022539", W / 2, fY + 9, { align: "center" })

    /* ─────────────────────────────────────────────
       DOWNLOAD
    ───────────────────────────────────────────── */
    doc.save(`printit-invoice-${invNum}.pdf`)
}
