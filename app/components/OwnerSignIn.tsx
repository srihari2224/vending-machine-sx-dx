"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { QRCodeSVG } from "qrcode.react"

const KIOSK_BACKEND = "https://kiosk-backend-t1mi.onrender.com"
const FILE_UPLOADER_API = "https://printing-pixel-1.onrender.com"

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "lastweek", label: "Last Week" },
  { id: "month", label: "This Month" },
]

interface Transaction {
  transactionId: string
  kioskId: string
  amount: number
  totalPages: number
  filesCount: number
  printDetails: Array<{ fileName: string; pageCount: number; copies: number; colorMode: string }>
  status: string
  createdAt: string
}

// ─── Touch Keyboard ───────────────────────────────────────────────────────────

const ROWS_ALPHA = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
]
const ROWS_NUM = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "_", "@", ".", "#", "&", "*", "!", "?"],
  ["/", "(", ")", "+", "=", "~", "<", ">", "'"],
]

function TouchKeyboard({
  value,
  onChange,
  onDone,
  isDark,
  isPassword = false,
}: {
  value: string
  onChange: (v: string) => void
  onDone: () => void
  isDark: boolean
  isPassword?: boolean
}) {
  const [mode, setMode] = useState<"alpha" | "num">("alpha")
  const [caps, setCaps] = useState(false)

  const bg = isDark ? "#131313" : "#e4e4e4"
  const keyBg = isDark ? "#242424" : "#ffffff"
  const keyFg = isDark ? "#ffffff" : "#000000"
  const keyBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"

  const press = (char: string) => {
    const out = mode === "alpha" ? (caps ? char.toUpperCase() : char.toLowerCase()) : char
    onChange(value + out)
  }
  const del = () => onChange(value.slice(0, -1))
  const space = () => onChange(value + " ")

  const rows = mode === "alpha" ? ROWS_ALPHA : ROWS_NUM

  const kStyle = (w = 44): React.CSSProperties => ({
    width: w,
    height: 46,
    background: keyBg,
    border: `1px solid ${keyBorder}`,
    color: keyFg,
    fontSize: "0.9rem",
    fontWeight: 600,
    fontFamily: '"Inter", sans-serif',
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    borderRadius: 7,
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  })

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 420, damping: 40 }}
      style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 400,
        background: bg,
        borderTop: `2px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
        boxShadow: "0 -12px 50px rgba(0,0,0,0.5)",
      }}
    >
      {/* Value preview strip */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px 9px",
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
        gap: 12,
      }}>
        <div style={{
          flex: 1, fontSize: "1rem", fontWeight: 600,
          color: isDark ? "#fff" : "#000",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          minHeight: "1.4em",
        }}>
          {isPassword
            ? (value.length ? "•".repeat(value.length) : <span style={{ opacity: 0.3 }}>Enter password...</span>)
            : (value || <span style={{ opacity: 0.3 }}>Start typing...</span>)
          }
        </div>
        <button
          onPointerDown={e => { e.preventDefault(); onDone() }}
          style={{
            background: "#ff6b47", border: "none", color: "#000",
            padding: "7px 20px", fontSize: "0.62rem", fontWeight: 800,
            textTransform: "uppercase", letterSpacing: "0.15em",
            cursor: "pointer", fontFamily: '"Inter", sans-serif', borderRadius: 4,
            flexShrink: 0,
          }}
        >
          Done
        </button>
      </div>

      {/* Key rows */}
      <div style={{ padding: "10px 6px 6px", display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: 4, justifyContent: "center", width: "100%" }}>
            {row.map(k => (
              <button
                key={k}
                onPointerDown={e => { e.preventDefault(); press(k) }}
                style={kStyle()}
                onMouseDown={e => { e.currentTarget.style.background = "#ff6b47"; e.currentTarget.style.color = "#000" }}
                onMouseUp={e => { e.currentTarget.style.background = keyBg; e.currentTarget.style.color = keyFg }}
                onMouseLeave={e => { e.currentTarget.style.background = keyBg; e.currentTarget.style.color = keyFg }}
                onTouchStart={e => { e.currentTarget.style.background = "#ff6b47"; e.currentTarget.style.color = "#000" }}
                onTouchEnd={e => { e.currentTarget.style.background = keyBg; e.currentTarget.style.color = keyFg }}
              >
                {mode === "alpha" ? (caps ? k.toUpperCase() : k.toLowerCase()) : k}
              </button>
            ))}
          </div>
        ))}

        {/* Control row */}
        <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 2 }}>
          <button onPointerDown={e => { e.preventDefault(); setMode(m => m === "alpha" ? "num" : "alpha") }}
            style={{ ...kStyle(64), fontSize: "0.65rem", letterSpacing: "0.08em" }}>
            {mode === "alpha" ? "123" : "ABC"}
          </button>
          {mode === "alpha" && (
            <button onPointerDown={e => { e.preventDefault(); setCaps(c => !c) }}
              style={{ ...kStyle(58), background: caps ? "#ff6b47" : keyBg, color: caps ? "#000" : keyFg, fontSize: "1rem" }}>
              ⇧
            </button>
          )}
          <button onPointerDown={e => { e.preventDefault(); space() }}
            style={{ ...kStyle(160), fontSize: "0.65rem", letterSpacing: "0.1em" }}>
            SPACE
          </button>
          <button onPointerDown={e => { e.preventDefault(); del() }}
            style={{ ...kStyle(72), fontSize: "0.75rem" }}>
            ⌫
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── PDF Preview Drawer (slides from right) ───────────────────────────────────

function PDFPreviewDrawer({
  pdfUrl,
  title,
  onClose,
  isDark,
}: {
  pdfUrl: string | null
  title: string
  onClose: () => void
  isDark: boolean
}) {
  return (
    <AnimatePresence>
      {pdfUrl && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,0.72)" }}
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 38 }}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0,
              width: "min(580px, 96vw)", zIndex: 260,
              background: isDark ? "#0a0a0a" : "#fff",
              borderLeft: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              display: "flex", flexDirection: "column",
              boxShadow: "-12px 0 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Drawer header */}
            <div style={{
              height: 58,
              borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 20px", flexShrink: 0,
            }}>
              <div>
                <p style={{ fontSize: "0.48rem", textTransform: "uppercase", letterSpacing: "0.22em", color: "#ff6b47", marginBottom: 2 }}>Invoice Preview</p>
                <p style={{ fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.01em", color: isDark ? "#fff" : "#000" }}>{title}</p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
                  color: isDark ? "#a3a3a3" : "#666",
                  padding: "6px 16px", cursor: "pointer",
                  fontFamily: '"Inter", sans-serif', fontSize: "0.58rem",
                  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em",
                }}
              >
                Close
              </button>
            </div>

            {/* PDF embed — toolbar/download/print disabled */}
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&statusbar=0&download=0&print=0`}
              style={{ flex: 1, width: "100%", border: "none", background: isDark ? "#111" : "#f0f0f0" }}
              title="Invoice Preview"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Sign-In Form ─────────────────────────────────────────────────────────────

function OwnerSignInForm({
  kioskId,
  onExit,
  onSuccess,
}: {
  kioskId: string
  onExit: () => void
  onSuccess: (token: string, username: string, resolvedKioskId: string) => void
}) {
  const [inputKioskId, setInputKioskId] = useState(kioskId && kioskId !== "null" ? kioskId : "")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [kbField, setKbField] = useState<"kid" | "pw" | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem("pp-theme")
    setIsDark(saved !== "light")
  }, [])

  // Scroll content up when keyboard opens so fields stay visible
  useEffect(() => {
    if (kbField && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
    }
  }, [kbField])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem("pp-theme", next ? "dark" : "light")
    document.body.setAttribute("data-theme", next ? "dark" : "light")
  }

  const bg = isDark ? "#000" : "#f5f5f5"
  const fg = isDark ? "#fff" : "#000"
  const subtle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
  const muted = isDark ? "#a3a3a3" : "#666"
  const surfaceBg = isDark ? "#050505" : "#ececec"

  const handleSubmit = async () => {
    if (!inputKioskId.trim() || !password.trim()) { setError("Enter your Kiosk ID and password."); return }
    setLoading(true); setError("")
    try {
      const res = await fetch(`${KIOSK_BACKEND}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inputKioskId.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError("Invalid Kiosk ID or password.")
      } else {
        localStorage.setItem("innvera-auth", JSON.stringify({ role: "owner", kioskId: data.kioskId, token: data.token, username: data.username }))
        onSuccess(data.token, data.username, data.kioskId)
      }
    } catch { setError("Network error.") }
    finally { setLoading(false) }
  }

  const fieldStyle = (active: boolean): React.CSSProperties => ({
    borderTop: `1.5px solid ${active ? "#ff6b47" : subtle}`,
    cursor: "text", transition: "border-color 0.2s", userSelect: "none",
  })
  const labelStyle = (active: boolean): React.CSSProperties => ({
    display: "block", fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.2em", paddingTop: "1rem", paddingBottom: "0.3rem",
    color: active ? "#ff6b47" : "#a3a3a3", transition: "color 0.2s",
  })
  const valueStyle: React.CSSProperties = {
    fontSize: "1.1rem", fontWeight: 500, color: fg, paddingBottom: "1rem", minHeight: "2.2rem",
    display: "flex", alignItems: "center",
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: bg, color: fg, fontFamily: '"Inter", sans-serif', display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

      {/* Noise + grid lines */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.04, background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
      {["16.6%", "50%", "83.3%"].map(l => <div key={l} style={{ position: "fixed", top: 0, bottom: 0, left: l, width: 1, background: subtle, pointerEvents: "none", zIndex: 1 }} />)}

      {/* Header */}
      <header style={{ position: "relative", zIndex: 10, height: 60, background: surfaceBg, borderBottom: `1px solid ${subtle}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2rem", flexShrink: 0 }}>
        <span style={{ fontSize: "1.4rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.03em", color: fg }}>Innvera</span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button onClick={toggleTheme} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: muted, fontFamily: '"Inter", sans-serif' }}>
            {isDark ? "Dark" : "Light"}
          </button>
          <button onClick={onExit} style={{ background: "transparent", border: `1px solid ${subtle}`, color: muted, padding: "6px 16px", cursor: "pointer", fontFamily: '"Inter", sans-serif', fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em" }}>Back</button>
        </div>
      </header>

      {/* Main content — padding grows when keyboard open so fields stay visible */}
      <div
        ref={scrollRef}
        style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3rem 2rem", paddingBottom: kbField ? "360px" : "3rem", position: "relative", zIndex: 2, transition: "padding-bottom 0.35s ease" }}
      >
        <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} style={{ width: "100%", maxWidth: 480 }}>
          <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "#a3a3a3", marginBottom: "2rem" }}>01. Kiosk Owner</p>
          <h1 style={{ fontSize: "clamp(3rem, 7vw, 5.5rem)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.03em", lineHeight: 0.85, color: fg, marginBottom: "2.5rem" }}>
            Owner<br />Sign In
          </h1>

          {/* Kiosk ID */}
          <div style={fieldStyle(kbField === "kid")} onClick={() => setKbField("kid")}>
            <label style={labelStyle(kbField === "kid")}>Kiosk ID</label>
            <div style={valueStyle}>
              <span style={{ opacity: inputKioskId ? 1 : 0.3 }}>{inputKioskId || "e.g. nitw"}</span>
              {kbField === "kid" && <span style={{ display: "inline-block", width: 2, height: "1em", background: "#ff6b47", marginLeft: 3, animation: "blink 1s step-end infinite" }} />}
            </div>
          </div>

          {/* Password */}
          <div style={fieldStyle(kbField === "pw")} onClick={() => setKbField("pw")}>
            <label style={labelStyle(kbField === "pw")}>Password</label>
            <div style={valueStyle}>
              <span style={{ opacity: password ? 1 : 0.3, letterSpacing: password ? "0.18em" : 0 }}>{password ? "•".repeat(password.length) : "••••••••"}</span>
              {kbField === "pw" && <span style={{ display: "inline-block", width: 2, height: "1em", background: "#ff6b47", marginLeft: 3, animation: "blink 1s step-end infinite" }} />}
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ color: "#ff6b47", fontSize: "0.72rem", padding: "0.5rem 0", fontWeight: 600 }}>
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            onClick={() => { setKbField(null); handleSubmit() }}
            disabled={loading}
            style={{ marginTop: "1.5rem", width: "100%", padding: "1.1rem", background: "#ff6b47", color: "#000", border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", fontFamily: '"Inter", sans-serif', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </motion.div>
      </div>

      {/* Keyboard */}
      <AnimatePresence>
        {kbField === "kid" && <TouchKeyboard value={inputKioskId} onChange={setInputKioskId} onDone={() => setKbField(null)} isDark={isDark} />}
        {kbField === "pw" && <TouchKeyboard value={password} onChange={setPassword} onDone={() => setKbField(null)} isDark={isDark} isPassword />}
      </AnimatePresence>
    </div>
  )
}

// ─── Owner Dashboard ──────────────────────────────────────────────────────────

function OwnerDashboardView({ kioskId, onSignOut }: { kioskId: string; onSignOut: () => void }) {
  const [period, setPeriod] = useState("week")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [kioskData, setKioskData] = useState<any>(null)
  const [qrCopied, setQrCopied] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null)
  const [genId, setGenId] = useState<string | null>(null)

  useEffect(() => { const s = localStorage.getItem("pp-theme"); setIsDark(s !== "light") }, [])
  const toggleTheme = () => { const n = !isDark; setIsDark(n); localStorage.setItem("pp-theme", n ? "dark" : "light"); document.body.setAttribute("data-theme", n ? "dark" : "light") }

  useEffect(() => {
    Promise.all([
      fetch(`${FILE_UPLOADER_API}/api/transactions/kiosk/${kioskId}`).then(r => r.ok ? r.json() : null),
      fetch(`${KIOSK_BACKEND}/api/kiosk/${kioskId}`).then(r => r.ok ? r.json() : null),
    ]).then(([d, k]) => {
      if (d) { const t = d.transactions || d || []; setTransactions(Array.isArray(t) ? t : []) }
      if (k?.success) setKioskData(k.kiosk)
    }).catch(() => setTransactions([])).finally(() => setLoading(false))
  }, [kioskId])

  const bg = isDark ? "#000" : "#f5f5f5"
  const fg = isDark ? "#fff" : "#000"
  const subtle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"
  const surfaceBg = isDark ? "#050505" : "#ececec"
  const dimText = isDark ? "#4a4a4a" : "#999"
  const mutedText = isDark ? "#a3a3a3" : "#666"

  const filterByPeriod = (txs: Transaction[]) => {
    const now = new Date()
    return txs.filter(tx => {
      const d = new Date(tx.createdAt)
      if (period === "today") return d.toDateString() === now.toDateString()
      if (period === "week") { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w }
      if (period === "lastweek") { const w = new Date(now); w.setDate(now.getDate() - 7); const w2 = new Date(now); w2.setDate(now.getDate() - 14); return d >= w2 && d < w }
      if (period === "month") { const m = new Date(now); m.setDate(now.getDate() - 30); return d >= m }
      return true
    })
  }

  const filtered = filterByPeriod(transactions)
  const totalRevenue = filtered.reduce((s, t) => s + (t.amount || 0), 0) / 100
  const totalPages = filtered.reduce((s, t) => s + (t.totalPages || 0), 0)
  const colorPages = filtered.reduce((s, t) => s + (t.printDetails || []).filter(p => p.colorMode === "color").reduce((a, p) => a + p.pageCount * p.copies, 0), 0)

  const chartData = (() => {
    const days: Record<string, { date: string; revenue: number }> = {}
    filtered.forEach(tx => {
      const day = new Date(tx.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      if (!days[day]) days[day] = { date: day, revenue: 0 }
      days[day].revenue += (tx.amount || 0) / 100
    })
    return Object.values(days)
  })()

  // Open PDF in drawer (no download)
  const openPdf = async (id: string, genFn: () => Promise<Blob>, title: string) => {
    setGenId(id)
    try {
      const blob = await genFn()
      const url = URL.createObjectURL(blob)
      setPdfPreview({ url, title })
    } catch { alert("Could not generate preview.") }
    finally { setGenId(null) }
  }

  const previewTx = async (tx: Transaction) => {
    await openPdf(tx.transactionId, async () => {
      const { generateInvoicePDFBlob } = await import("../../utils/generateInvoicePDF")
      return generateInvoicePDFBlob({
        kioskId: tx.kioskId,
        customerPhone: (tx as any).customerPhone || "N/A",
        totalAmount: (tx.amount || 0) / 100,
        queue: (tx.printDetails || []).map((p: any) => ({
          fileName: p.fileName || "Document",
          pagesToPrint: p.pageCount || 1,
          printSettings: { copies: p.copies || 1, colorMode: p.colorMode || "bw", doubleSided: "one-side" },
          cost: (p.pageCount || 1) * (p.copies || 1) * (p.colorMode === "color" ? 10 : 2),
        })),
      })
    }, `INV-${tx.transactionId.slice(-8).toUpperCase()}`)
  }

  const previewSettlement = async (s: any) => {
    if (s.status !== "APPROVED") { alert("Invoice available after approval."); return }
    await openPdf(`s-${s.transactionId}`, async () => {
      const { generateInvoicePDFBlob } = await import("../../utils/generateInvoicePDF")
      return generateInvoicePDFBlob({
        kioskId: kioskData.kioskId,
        totalAmount: s.amount,
        isSettlement: true,
        queue: [{
          fileName: `Settlement (${new Date(s.fromDate).toLocaleDateString()} to ${new Date(s.toDate).toLocaleDateString()})`,
          cost: s.amount, pagesToPrint: 1,
          printSettings: { copies: 1, colorMode: "bw", doubleSided: "one-side" },
        }],
      })
    }, `Settlement ${new Date(s.fromDate).toLocaleDateString()} – ${new Date(s.toDate).toLocaleDateString()}`)
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.3em", color: dimText, fontFamily: '"Inter",sans-serif' }}>Loading...</p>
    </div>
  )

  const sc = (label: string, value: string | number, sub: string) => (
    <div key={label} style={{ padding: "1.5rem", border: `1px solid ${subtle}`, background: surfaceBg, display: "flex", flexDirection: "column", gap: 4 }}>
      <p style={{ fontSize: "0.5rem", textTransform: "uppercase", letterSpacing: "0.2em", color: dimText }}>{label}</p>
      <p style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", color: fg }}>{value}</p>
      <p style={{ fontSize: "0.55rem", textTransform: "uppercase", color: dimText }}>{sub}</p>
    </div>
  )

  const btnBase: React.CSSProperties = { padding: "6px 14px", fontSize: "0.52rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer", fontFamily: '"Inter",sans-serif', background: "transparent", border: `1px solid ${subtle}`, color: mutedText, transition: "background 0.15s,color 0.15s" }

  return (
    <div style={{ minHeight: "100vh", background: bg, color: fg, fontFamily: '"Inter",sans-serif' }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: surfaceBg, borderBottom: `1px solid ${subtle}`, padding: "1.1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: "0.5rem", textTransform: "uppercase", letterSpacing: "0.25em", color: "#ff6b47", marginBottom: 2 }}>Owner Dashboard</p>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 1, color: fg }}>{kioskId}</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={toggleTheme} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: mutedText, fontFamily: '"Inter",sans-serif' }}>{isDark ? "Dark" : "Light"}</button>
          <button onClick={onSignOut} style={{ ...btnBase }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = fg; (e.currentTarget as HTMLElement).style.color = bg }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = mutedText }}>
            Sign Out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem", position: "relative", zIndex: 1 }}>
        {/* Period */}
        <div style={{ display: "inline-flex", border: `1px solid ${subtle}`, marginBottom: "2rem" }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{ padding: "0.6rem 1.2rem", fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", cursor: "pointer", fontFamily: '"Inter",sans-serif', background: period === p.id ? "#ff6b47" : "transparent", color: period === p.id ? "#000" : mutedText, border: "none", borderRight: `1px solid ${subtle}` }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
          {sc("Total Revenue", `₹${totalRevenue.toFixed(0)}`, "INR")}
          {sc("Transactions", filtered.length, "orders")}
          {sc("Pages Printed", totalPages, "total pages")}
          {sc("Color / BW", `${colorPages} / ${totalPages - colorPages}`, "breakdown")}
        </div>

        {/* Chart */}
        <div style={{ padding: "1.5rem 2rem", border: `1px solid ${subtle}`, background: surfaceBg, marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "0.52rem", textTransform: "uppercase", letterSpacing: "0.25em", color: dimText, marginBottom: "1.5rem" }}>Revenue Chart (INR)</p>
          {chartData.length === 0 ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ fontSize: "0.65rem", color: dimText, textTransform: "uppercase", letterSpacing: "0.2em" }}>No data</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={subtle} />
                <XAxis dataKey="date" tick={{ fill: dimText, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: dimText, fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return <div style={{ background: surfaceBg, border: `1px solid ${subtle}`, padding: "0.75rem 1rem" }}><p style={{ fontSize: "0.58rem", color: dimText, marginBottom: 4 }}>{label}</p><p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ff6b47" }}>₹{Number(payload[0].value).toFixed(0)}</p></div>
                }} />
                <Bar dataKey="revenue" radius={0}>
                  {chartData.map((e, i) => {
                    const today = e.date === new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                    return <Cell key={i} fill={today ? "#ff6b47" : (isDark ? "#1a1a1a" : "#d0d0d0")} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* QR */}
        <div style={{ padding: "1.5rem 2rem", border: `1px solid ${subtle}`, background: surfaceBg, marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "0.52rem", textTransform: "uppercase", letterSpacing: "0.25em", color: dimText, marginBottom: "1.2rem" }}>Kiosk QR Code</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-start" }}>
            <div style={{ padding: "0.75rem", background: "#fff" }}>
              <QRCodeSVG value={`https://pixel-livid-two.vercel.app/?kiosk_id=${kioskId}`} size={96} bgColor="#ffffff" fgColor="#000000" level="M" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <code style={{ fontSize: "0.72rem", color: "#ff6b47", wordBreak: "break-all" }}>https://pixel-livid-two.vercel.app/?kiosk_id={kioskId}</code>
              <button onClick={() => { navigator.clipboard.writeText(`https://pixel-livid-two.vercel.app/?kiosk_id=${kioskId}`); setQrCopied(true); setTimeout(() => setQrCopied(false), 2000) }}
                style={{ ...btnBase, alignSelf: "flex-start", color: qrCopied ? "#22c55e" : mutedText }}>
                {qrCopied ? "Copied!" : "Copy URL"}
              </button>
            </div>
          </div>
        </div>

        {/* Lifetime analytics */}
        <div style={{ border: `1px solid ${subtle}`, background: surfaceBg, marginBottom: "2.5rem" }}>
          <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${subtle}` }}>
            <p style={{ fontSize: "0.52rem", textTransform: "uppercase", letterSpacing: "0.25em", color: dimText }}>Analytics — All Time</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
            {[
              { label: "Lifetime Revenue", value: `₹${(transactions.reduce((s, t) => s + (t.amount || 0), 0) / 100).toFixed(0)}`, sub: "all time" },
              { label: "Total Transactions", value: transactions.length, sub: "lifetime" },
              { label: "Total Pages", value: transactions.reduce((s, t) => s + (t.totalPages || 0), 0), sub: "all time" },
              { label: "Color vs B&W", value: (() => { const a = transactions.reduce((s, t) => s + (t.totalPages || 0), 0); const c = transactions.reduce((s, t) => s + (t.printDetails || []).filter(p => p.colorMode === "color").reduce((a, p) => a + p.pageCount * p.copies, 0), 0); return `${c} / ${a - c}` })(), sub: "color / b&w" },
            ].map((item, idx) => (
              <div key={item.label} style={{ padding: "1.5rem", borderRight: idx < 3 ? `1px solid ${subtle}` : "none", display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontSize: "0.48rem", textTransform: "uppercase", letterSpacing: "0.2em", color: dimText }}>{item.label}</p>
                <p style={{ fontSize: "1.8rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", color: "#ff6b47" }}>{item.value}</p>
                <p style={{ fontSize: "0.48rem", textTransform: "uppercase", color: dimText }}>{item.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <div style={{ border: `1px solid ${subtle}`, background: surfaceBg, marginBottom: "2.5rem" }}>
          <div style={{ padding: "1.2rem 1.5rem", borderBottom: `1px solid ${subtle}` }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", color: fg }}>Recent Transactions</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.7fr 0.8fr 0.8fr auto", gap: "1rem", padding: "0.75rem 1.5rem", borderBottom: `1px solid ${subtle}`, fontSize: "0.5rem", textTransform: "uppercase", letterSpacing: "0.2em", color: dimText }}>
            <span>Date</span><span>ID</span><span>Pages</span><span>Status</span><span>Amount</span><span>Invoice</span>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center" }}><p style={{ fontSize: "0.65rem", color: dimText }}>No transactions.</p></div>
          ) : filtered.map(tx => (
            <div key={tx.transactionId}
              style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.7fr 0.8fr 0.8fr auto", gap: "1rem", padding: "1rem 1.5rem", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, alignItems: "center" }}
              onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: fg }}>{new Date(tx.createdAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <span style={{ fontSize: "0.7rem", fontFamily: "monospace", color: mutedText }}>{tx.transactionId.slice(-8).toUpperCase()}</span>
              <span style={{ fontSize: "0.72rem", color: mutedText }}>{tx.totalPages} pg</span>
              <span style={{ fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", border: `1px solid ${tx.status === "CAPTURED" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`, color: tx.status === "CAPTURED" ? "#22c55e" : "#ef4444", background: tx.status === "CAPTURED" ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", display: "inline-block" }}>{tx.status}</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ff6b47" }}>₹{((tx.amount || 0) / 100).toFixed(0)}</span>
              <button
                onClick={() => previewTx(tx)}
                disabled={genId === tx.transactionId}
                style={{ ...btnBase, color: genId === tx.transactionId ? "#ff6b47" : mutedText }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = fg; (e.currentTarget as HTMLElement).style.color = bg }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = mutedText }}
              >
                {genId === tx.transactionId ? "..." : "View"}
              </button>
            </div>
          ))}
        </div>

        {/* Settlements */}
        {kioskData?.settlements?.length > 0 && (
          <div style={{ border: `1px solid ${subtle}`, background: surfaceBg }}>
            <div style={{ padding: "1.2rem 1.5rem", borderBottom: `1px solid ${subtle}` }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", color: fg }}>Settlements</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.7fr 0.8fr auto", gap: "1rem", padding: "0.75rem 1.5rem", borderBottom: `1px solid ${subtle}`, fontSize: "0.5rem", textTransform: "uppercase", letterSpacing: "0.2em", color: dimText }}>
              <span>Period</span><span>Tx ID</span><span>Status</span><span>Amount</span><span>Invoice</span>
            </div>
            {kioskData.settlements.map((s: any, idx: number) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.7fr 0.8fr auto", gap: "1rem", padding: "1rem 1.5rem", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 500, color: fg }}>{new Date(s.fromDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} — {new Date(s.toDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span style={{ fontSize: "0.52rem", color: mutedText }}>{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
                <span style={{ fontSize: "0.68rem", color: mutedText }}>{s.transactionId}</span>
                <span style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", color: s.status === "APPROVED" ? "#22c55e" : s.status === "REJECTED" ? "#ef4444" : "#ff6b47" }}>{s.status}</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: fg }}>₹{s.amount.toFixed(2)}</span>
                <button
                  onClick={() => previewSettlement(s)}
                  disabled={s.status !== "APPROVED" || genId === `s-${s.transactionId}`}
                  style={{ ...btnBase, color: s.status === "APPROVED" ? "#ff6b47" : dimText, opacity: s.status === "APPROVED" ? 1 : 0.4, cursor: s.status === "APPROVED" ? "pointer" : "not-allowed" }}
                >
                  {genId === `s-${s.transactionId}` ? "..." : "View"}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* PDF Preview Drawer */}
      <PDFPreviewDrawer
        pdfUrl={pdfPreview?.url ?? null}
        title={pdfPreview?.title ?? ""}
        onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null) }}
        isDark={isDark}
      />
    </div>
  )
}

// ─── Root Export ──────────────────────────────────────────────────────────────

export default function OwnerSignIn({ kioskId, onExit }: { kioskId: string; onExit: () => void }) {
  const [authed, setAuthed] = useState(false)
  const [resolvedKioskId, setResolvedKioskId] = useState(kioskId && kioskId !== "null" ? kioskId : "america")

  useEffect(() => {
    try {
      const s = localStorage.getItem("innvera-auth")
      if (s) {
        const p = JSON.parse(s)
        if (p.role === "owner" && p.token) { setResolvedKioskId(p.kioskId || resolvedKioskId); setAuthed(true) }
      }
    } catch { }
  }, [])

  if (authed) return <OwnerDashboardView kioskId={resolvedKioskId} onSignOut={() => { localStorage.removeItem("innvera-auth"); setAuthed(false) }} />

  return (
    <OwnerSignInForm
      kioskId={resolvedKioskId}
      onExit={onExit}
      onSuccess={(_, __, id) => { setResolvedKioskId(id); setAuthed(true) }}
    />
  )
}