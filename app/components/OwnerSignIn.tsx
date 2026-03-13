"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { generateInvoicePDF } from "@/utils/generateInvoicePDF"
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

// ─── Sign-In Form ────────────────────────────────────────────────────────────

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
  const [focused, setFocused] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem("pp-theme")
    setIsDark(saved !== "light")
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputKioskId.trim() || !password.trim()) {
      setError("Please enter your Kiosk ID and password.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${KIOSK_BACKEND}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inputKioskId.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError("Invalid Kiosk ID or password.")
      } else {
        localStorage.setItem(
          "innvera-auth",
          JSON.stringify({
            role: "owner",
            kioskId: data.kioskId,
            token: data.token,
            username: data.username,
          })
        )
        onSuccess(data.token, data.username, data.kioskId)
      }
    } catch {
      setError("Network error. Could not reach the server.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: bg,
        color: fg,
        fontFamily: '"Inter", sans-serif',
        display: "flex",
        flexDirection: "column",
        transition: "background 0.3s, color 0.3s",
      }}
    >
      {/* Noise overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.04,
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vertical grid lines */}
      {["16.6%", "50%", "83.3%"].map((left) => (
        <div
          key={left}
          style={{
            position: "fixed",
            top: 0,
            bottom: 0,
            left,
            width: 1,
            background: subtle,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      ))}

      {/* Header */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          height: 60,
          background: surfaceBg,
          borderBottom: `1px solid ${subtle}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "1.4rem",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
            color: fg,
          }}
        >
          Innvera
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button
            onClick={toggleTheme}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: muted,
              fontFamily: '"Inter", sans-serif',
            }}
          >
            {isDark ? "Dark" : "Light"}
          </button>
          <button
            onClick={onExit}
            style={{
              background: "transparent",
              border: `1px solid ${subtle}`,
              color: muted,
              padding: "6px 16px",
              cursor: "pointer",
              fontFamily: '"Inter", sans-serif',
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
            }}
          >
            Back
          </button>
        </div>
      </header>

      {/* Main */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          position: "relative",
          zIndex: 2,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: "100%", maxWidth: 480 }}
        >
          {/* Label */}
          <p
            style={{
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              color: "#a3a3a3",
              marginBottom: "2rem",
            }}
          >
            01. Kiosk Owner
          </p>

          {/* Title */}
          <h1
            style={{
              fontSize: "clamp(3rem, 7vw, 5.5rem)",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "-0.03em",
              lineHeight: 0.85,
              color: fg,
              marginBottom: "2.5rem",
            }}
          >
            Owner
            <br />
            Sign In
          </h1>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Kiosk ID */}
            <div
              style={{
                borderTop: `1px solid ${focused === "kid" ? "#ff6b47" : subtle}`,
                transition: "border-color 0.2s",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  paddingTop: "1rem",
                  paddingBottom: "0.3rem",
                  color: focused === "kid" ? "#ff6b47" : "#a3a3a3",
                  transition: "color 0.2s",
                }}
              >
                Kiosk ID
              </label>
              <input
                type="text"
                value={inputKioskId}
                onChange={(e) => setInputKioskId(e.target.value)}
                onFocus={() => setFocused("kid")}
                onBlur={() => setFocused(null)}
                placeholder="e.g. nitw"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: "1.1rem",
                  fontWeight: 500,
                  color: fg,
                  caretColor: "#ff6b47",
                  paddingBottom: "1rem",
                  fontFamily: '"Inter", sans-serif',
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Password */}
            <div
              style={{
                borderTop: `1px solid ${focused === "pw" ? "#ff6b47" : subtle}`,
                transition: "border-color 0.2s",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  paddingTop: "1rem",
                  paddingBottom: "0.3rem",
                  color: focused === "pw" ? "#ff6b47" : "#a3a3a3",
                  transition: "color 0.2s",
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("pw")}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: "1.1rem",
                  fontWeight: 500,
                  color: fg,
                  caretColor: "#ff6b47",
                  paddingBottom: "1rem",
                  fontFamily: '"Inter", sans-serif',
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    color: "#ff6b47",
                    fontSize: "0.72rem",
                    paddingTop: "0.5rem",
                    paddingBottom: "0.5rem",
                    fontWeight: 600,
                  }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "1.5rem",
                width: "100%",
                padding: "1.1rem",
                background: "#ff6b47",
                color: "#000",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                fontFamily: '"Inter", sans-serif',
                opacity: loading ? 0.6 : 1,
                transition: "opacity 0.2s, transform 0.15s",
              }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.transform = "scale(0.99)" }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)" }}
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </motion.div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: `1px solid ${subtle}`,
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: surfaceBg,
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#4a4a4a" }}>
          INNVERA Platform
        </span>
        <div style={{ display: "flex", gap: 20 }}>
          {["Terms", "Privacy"].map((l) => (
            <a
              key={l}
              href={`/${l.toLowerCase()}`}
              style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#4a4a4a", textDecoration: "none" }}
            >
              {l}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Owner Dashboard (inline, no iframe) ─────────────────────────────────────

function OwnerDashboardView({
  kioskId,
  onSignOut,
}: {
  kioskId: string
  onSignOut: () => void
}) {
  const [period, setPeriod] = useState("week")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [kioskData, setKioskData] = useState<any>(null)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [qrCopied, setQrCopied] = useState(false)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem("pp-theme")
    setIsDark(saved !== "light")
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem("pp-theme", next ? "dark" : "light")
    document.body.setAttribute("data-theme", next ? "dark" : "light")
  }

  useEffect(() => {
    Promise.all([
      fetch(`${FILE_UPLOADER_API}/api/transactions/kiosk/${kioskId}`).then((r) => r.ok ? r.json() : null),
      fetch(`${KIOSK_BACKEND}/api/kiosk/${kioskId}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([d, kData]) => {
        if (d) {
          const txs = d.transactions || d || []
          setTransactions(Array.isArray(txs) ? txs : [])
        }
        if (kData?.success) setKioskData(kData.kiosk)
      })
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false))
  }, [kioskId])

  // Theme tokens
  const bg = isDark ? "#000" : "#f5f5f5"
  const fg = isDark ? "#fff" : "#000"
  const subtle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"
  const surfaceBg = isDark ? "#050505" : "#ececec"
  const dimText = isDark ? "#4a4a4a" : "#999"
  const mutedText = isDark ? "#a3a3a3" : "#666"

  const filterByPeriod = (txs: Transaction[]) => {
    const now = new Date()
    return txs.filter((tx) => {
      const d = new Date(tx.createdAt)
      if (period === "today") return d.toDateString() === now.toDateString()
      if (period === "week") { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w }
      if (period === "lastweek") {
        const w = new Date(now); w.setDate(now.getDate() - 7)
        const w2 = new Date(now); w2.setDate(now.getDate() - 14)
        return d >= w2 && d < w
      }
      if (period === "month") { const m = new Date(now); m.setDate(now.getDate() - 30); return d >= m }
      return true
    })
  }

  const filtered = filterByPeriod(transactions)
  const totalRevenue = filtered.reduce((s, t) => s + (t.amount || 0), 0) / 100
  const totalPages = filtered.reduce((s, t) => s + (t.totalPages || 0), 0)
  const colorPages = filtered.reduce((s, t) => {
    return s + (t.printDetails || []).filter((p) => p.colorMode === "color").reduce((a, p) => a + p.pageCount * p.copies, 0)
  }, 0)
  const bwPages = totalPages - colorPages

  const chartData = (() => {
    const days: Record<string, { date: string; revenue: number; pages: number }> = {}
    filtered.forEach((tx) => {
      const day = new Date(tx.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      if (!days[day]) days[day] = { date: day, revenue: 0, pages: 0 }
      days[day].revenue += (tx.amount || 0) / 100
      days[day].pages += tx.totalPages || 0
    })
    return Object.values(days)
  })()

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.3em", color: dimText, fontFamily: '"Inter", sans-serif' }}>
          Loading dashboard...
        </p>
      </div>
    )
  }

  const stat = (label: string, value: string | number, sub: string) => (
    <div
      key={label}
      style={{
        padding: "1.5rem",
        border: `1px solid ${subtle}`,
        background: surfaceBg,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <p style={{ fontSize: "0.5rem", textTransform: "uppercase", letterSpacing: "0.2em", color: dimText }}>{label}</p>
      <p style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", color: fg }}>{value}</p>
      <p style={{ fontSize: "0.55rem", textTransform: "uppercase", color: dimText }}>{sub}</p>
    </div>
  )

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        color: fg,
        fontFamily: '"Inter", sans-serif',
        transition: "background 0.3s, color 0.3s",
      }}
    >
      {/* Noise */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.04,
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: surfaceBg,
          borderBottom: `1px solid ${subtle}`,
          padding: "1.1rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <p style={{ fontSize: "0.5rem", textTransform: "uppercase", letterSpacing: "0.25em", color: "#ff6b47", marginBottom: 2 }}>
            Owner Dashboard
          </p>
          <h1
            style={{
              fontSize: "1.3rem",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: fg,
            }}
          >
            {kioskId}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={toggleTheme}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "0.58rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: mutedText,
              fontFamily: '"Inter", sans-serif',
            }}
          >
            {isDark ? "Dark" : "Light"}
          </button>
          <button
            onClick={onSignOut}
            style={{
              background: "transparent",
              border: `1px solid ${subtle}`,
              color: mutedText,
              padding: "6px 16px",
              cursor: "pointer",
              fontFamily: '"Inter", sans-serif',
              fontSize: "0.58rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              transition: "background 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = fg; (e.currentTarget as HTMLElement).style.color = bg }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = mutedText }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem", position: "relative", zIndex: 1 }}>

        {/* Period selector */}
        <div style={{ display: "inline-flex", border: `1px solid ${subtle}`, marginBottom: "2rem" }}>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{
                padding: "0.6rem 1.2rem",
                fontSize: "0.58rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                cursor: "pointer",
                fontFamily: '"Inter", sans-serif',
                background: period === p.id ? "#ff6b47" : "transparent",
                color: period === p.id ? "#000" : mutedText,
                border: "none",
                borderRight: `1px solid ${subtle}`,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
          {stat("Total Revenue", `₹${totalRevenue.toFixed(0)}`, "INR")}
          {stat("Transactions", filtered.length, "orders")}
          {stat("Pages Printed", totalPages, "total pages")}
          {stat("Color / BW", `${colorPages} / ${bwPages}`, "breakdown")}
        </div>

        {/* Chart */}
        <div style={{ padding: "1.5rem 2rem", border: `1px solid ${subtle}`, background: surfaceBg, marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "0.52rem", textTransform: "uppercase", letterSpacing: "0.25em", color: dimText, marginBottom: "1.5rem" }}>
            Revenue Chart (INR)
          </p>
          {chartData.length === 0 ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.2em", color: dimText }}>No data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={subtle} />
                <XAxis dataKey="date" tick={{ fill: dimText, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: dimText, fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={{ background: surfaceBg, border: `1px solid ${subtle}`, padding: "0.75rem 1rem" }}>
                        <p style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.15em", color: dimText, marginBottom: 4 }}>{label}</p>
                        <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ff6b47" }}>₹{Number(payload[0].value).toFixed(0)}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="revenue" radius={0}>
                  {chartData.map((entry, i) => {
                    const isToday = entry.date === new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                    return <Cell key={`cell-${i}`} fill={isToday ? "#ff6b47" : (isDark ? "#1a1a1a" : "#d0d0d0")} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* QR Code */}
        <div style={{ padding: "1.5rem 2rem", border: `1px solid ${subtle}`, background: surfaceBg, marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "0.52rem", textTransform: "uppercase", letterSpacing: "0.25em", color: dimText, marginBottom: "1.2rem" }}>
            Kiosk QR Code
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-start" }}>
            <div style={{ padding: "0.75rem", background: "#fff" }}>
              <QRCodeSVG
                value={`https://pixel-livid-two.vercel.app/?kiosk_id=${kioskId}`}
                size={96}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ fontSize: "0.52rem", textTransform: "uppercase", letterSpacing: "0.15em", color: dimText, marginBottom: 4 }}>Kiosk URL</p>
                <code style={{ fontSize: "0.72rem", color: "#ff6b47", wordBreak: "break-all" }}>
                  https://pixel-livid-two.vercel.app/?kiosk_id={kioskId}
                </code>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://pixel-livid-two.vercel.app/?kiosk_id=${kioskId}`)
                  setQrCopied(true)
                  setTimeout(() => setQrCopied(false), 2000)
                }}
                style={{
                  alignSelf: "flex-start",
                  padding: "6px 16px",
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  cursor: "pointer",
                  fontFamily: '"Inter", sans-serif',
                  background: "transparent",
                  border: `1px solid ${subtle}`,
                  color: qrCopied ? "#22c55e" : mutedText,
                  transition: "color 0.2s",
                }}
              >
                {qrCopied ? "Copied!" : "Copy URL"}
              </button>
            </div>
          </div>
        </div>

        {/* Lifetime analytics */}
        <div style={{ border: `1px solid ${subtle}`, background: surfaceBg, marginBottom: "2.5rem" }}>
          <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${subtle}` }}>
            <p style={{ fontSize: "0.52rem", textTransform: "uppercase", letterSpacing: "0.25em", color: dimText }}>
              Analytics Overview — All Time
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {[
              { label: "Lifetime Revenue", value: `₹${(transactions.reduce((s, t) => s + (t.amount || 0), 0) / 100).toFixed(0)}`, sub: "all time" },
              { label: "Total Transactions", value: transactions.length, sub: "lifetime orders" },
              { label: "Total Pages", value: transactions.reduce((s, t) => s + (t.totalPages || 0), 0), sub: "all time" },
              {
                label: "Color vs B&W",
                value: (() => {
                  const all = transactions.reduce((s, t) => s + (t.totalPages || 0), 0)
                  const col = transactions.reduce((s, t) => s + (t.printDetails || []).filter(p => p.colorMode === "color").reduce((a, p) => a + p.pageCount * p.copies, 0), 0)
                  return `${col} / ${all - col}`
                })(),
                sub: "color / b&w",
              },
            ].map((item, idx) => (
              <div
                key={item.label}
                style={{
                  padding: "1.5rem",
                  borderRight: idx < 3 ? `1px solid ${subtle}` : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <p style={{ fontSize: "0.48rem", textTransform: "uppercase", letterSpacing: "0.2em", color: dimText }}>{item.label}</p>
                <p style={{ fontSize: "1.8rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", color: "#ff6b47" }}>{item.value}</p>
                <p style={{ fontSize: "0.48rem", textTransform: "uppercase", color: dimText }}>{item.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions table */}
        <div style={{ border: `1px solid ${subtle}`, background: surfaceBg, marginBottom: "2.5rem" }}>
          <div style={{ padding: "1.2rem 1.5rem", borderBottom: `1px solid ${subtle}` }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", color: fg }}>
              Recent Transactions
            </h2>
          </div>

          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 1fr 0.7fr 0.8fr 0.8fr auto",
              gap: "1rem",
              padding: "0.75rem 1.5rem",
              borderBottom: `1px solid ${subtle}`,
              fontSize: "0.5rem",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: dimText,
            }}
          >
            <span>Date</span><span>ID</span><span>Pages</span><span>Status</span><span>Amount</span><span>Action</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <p style={{ fontSize: "0.65rem", color: dimText }}>No transactions for this period.</p>
            </div>
          ) : (
            filtered.map((tx) => (
              <div
                key={tx.transactionId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr 0.7fr 0.8fr 0.8fr auto",
                  gap: "1rem",
                  padding: "1rem 1.5rem",
                  borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                  alignItems: "center",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: fg }}>
                  {new Date(tx.createdAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={{ fontSize: "0.7rem", fontFamily: "monospace", letterSpacing: "0.1em", color: mutedText }}>
                  {tx.transactionId.slice(-8).toUpperCase()}
                </span>
                <span style={{ fontSize: "0.72rem", color: mutedText }}>{tx.totalPages} pg</span>
                <span
                  style={{
                    fontSize: "0.5rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    padding: "3px 8px",
                    border: `1px solid ${tx.status === "CAPTURED" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                    color: tx.status === "CAPTURED" ? "#22c55e" : "#ef4444",
                    background: tx.status === "CAPTURED" ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                    display: "inline-block",
                  }}
                >
                  {tx.status}
                </span>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ff6b47" }}>
                  ₹{((tx.amount || 0) / 100).toFixed(0)}
                </span>
                <button
                  onClick={() => setSelectedTx(tx)}
                  style={{
                    padding: "6px 14px",
                    fontSize: "0.52rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    fontFamily: '"Inter", sans-serif',
                    background: "transparent",
                    border: `1px solid ${subtle}`,
                    color: mutedText,
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = fg; (e.currentTarget as HTMLElement).style.color = bg }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = mutedText }}
                >
                  Invoice
                </button>
              </div>
            ))
          )}
        </div>

        {/* Settlements */}
        {kioskData?.settlements?.length > 0 && (
          <div style={{ border: `1px solid ${subtle}`, background: surfaceBg }}>
            <div style={{ padding: "1.2rem 1.5rem", borderBottom: `1px solid ${subtle}` }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", color: fg }}>
                Settlements
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1fr 0.7fr 0.8fr auto",
                gap: "1rem",
                padding: "0.75rem 1.5rem",
                borderBottom: `1px solid ${subtle}`,
                fontSize: "0.5rem",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: dimText,
              }}
            >
              <span>Period</span><span>Tx ID</span><span>Status</span><span>Amount</span><span>Invoice</span>
            </div>
            {kioskData.settlements.map((s: any, idx: number) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr 0.7fr 0.8fr auto",
                  gap: "1rem",
                  padding: "1rem 1.5rem",
                  borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 500, color: fg }}>
                    {new Date(s.fromDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} — {new Date(s.toDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span style={{ fontSize: "0.52rem", color: mutedText }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span style={{ fontSize: "0.68rem", color: mutedText }}>{s.transactionId}</span>
                <span
                  style={{
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: s.status === "APPROVED" ? "#22c55e" : s.status === "REJECTED" ? "#ef4444" : "#ff6b47",
                  }}
                >
                  {s.status}
                </span>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: fg }}>₹{s.amount.toFixed(2)}</span>
                <button
                  onClick={async () => {
                    if (s.status !== "APPROVED") { alert("Invoice available after approval."); return }
                    try {
                      await generateInvoicePDF({
                        kioskId: kioskData.kioskId,
                        totalAmount: s.amount,
                        isSettlement: true,
                        queue: [{
                          fileName: `Settlement (${new Date(s.fromDate).toLocaleDateString()} to ${new Date(s.toDate).toLocaleDateString()})`,
                          cost: s.amount,
                          pagesToPrint: 1,
                          printSettings: { copies: 1, colorMode: "bw", doubleSided: "one-side" },
                        }],
                      })
                    } catch { alert("Could not generate invoice.") }
                  }}
                  style={{
                    padding: "6px 14px",
                    fontSize: "0.52rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    cursor: s.status === "APPROVED" ? "pointer" : "not-allowed",
                    fontFamily: '"Inter", sans-serif',
                    background: "transparent",
                    border: `1px solid ${subtle}`,
                    color: s.status === "APPROVED" ? "#ff6b47" : dimText,
                    opacity: s.status === "APPROVED" ? 1 : 0.4,
                  }}
                >
                  DL Invoice
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Invoice Modal */}
      <AnimatePresence>
        {selectedTx && (
          <InvoiceModal tx={selectedTx} onClose={() => setSelectedTx(null)} isDark={isDark} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────

function InvoiceModal({ tx, onClose, isDark }: { tx: Transaction; onClose: () => void; isDark: boolean }) {
  const bg = isDark ? "#050505" : "#fff"
  const fg = isDark ? "#fff" : "#000"
  const subtle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"
  const dimText = isDark ? "#4a4a4a" : "#999"

  const handleDownload = async () => {
    try {
      await generateInvoicePDF({
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
    } catch { alert("Could not generate PDF invoice") }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, background: bg, border: `1px solid ${subtle}` }}
      >
        <div style={{ padding: "1.5rem 2rem", borderBottom: `1px solid ${subtle}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: "0.52rem", textTransform: "uppercase", letterSpacing: "0.2em", color: dimText, marginBottom: 4 }}>Invoice</p>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", color: fg }}>
              {tx.transactionId.slice(-12).toUpperCase()}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.15em", color: dimText, fontFamily: '"Inter", sans-serif' }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: "1.5rem 2rem" }}>
          {[
            ["Kiosk ID", tx.kioskId],
            ["Date & Time", new Date(tx.createdAt).toLocaleString("en-IN")],
            ["Total Pages", tx.totalPages],
            ["Files", tx.filesCount],
            ["Status", tx.status],
            ["Total Amount", `₹${((tx.amount || 0) / 100).toFixed(2)}`],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ display: "flex", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"}`, padding: "0.75rem 0", gap: "1rem" }}>
              <span style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.15em", color: dimText, width: 120, flexShrink: 0 }}>{l}</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: String(l) === "Total Amount" ? "#ff6b47" : fg }}>{v}</span>
            </div>
          ))}

          {tx.printDetails?.length > 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <p style={{ fontSize: "0.52rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "#ff6b47", marginBottom: "0.75rem" }}>
                Document Breakdown
              </p>
              {tx.printDetails.map((p, i) => (
                <div key={i} style={{ paddingBottom: "0.75rem", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}`, marginBottom: "0.5rem" }}>
                  <p style={{ fontSize: "0.78rem", color: fg, marginBottom: 4 }}>{p.fileName}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3" }}>
                    <span>{p.pageCount} Pages × {p.copies} Copies</span>
                    <span>{p.colorMode === "color" ? "COLOR" : "B&W"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "1.5rem 2rem", borderTop: `1px solid ${subtle}`, background: isDark ? "#000" : "#f0f0f0" }}>
          <button
            onClick={handleDownload}
            style={{
              width: "100%",
              padding: "1rem",
              background: "#ff6b47",
              color: "#000",
              border: "none",
              cursor: "pointer",
              fontSize: "0.65rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontFamily: '"Inter", sans-serif',
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            Download Invoice
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Root Export ──────────────────────────────────────────────────────────────

export default function OwnerSignIn({ kioskId, onExit }: { kioskId: string; onExit: () => void }) {
  const [authed, setAuthed] = useState(false)
  const [resolvedKioskId, setResolvedKioskId] = useState(
    kioskId && kioskId !== "null" ? kioskId : "america"
  )

  // If already signed in as owner, skip straight to dashboard
  useEffect(() => {
    try {
      const saved = localStorage.getItem("innvera-auth")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.role === "owner" && parsed.token) {
          setResolvedKioskId(parsed.kioskId || resolvedKioskId)
          setAuthed(true)
        }
      }
    } catch { }
  }, [])

  const handleSignOut = () => {
    localStorage.removeItem("innvera-auth")
    setAuthed(false)
  }

  if (authed) {
    return (
      <OwnerDashboardView
        kioskId={resolvedKioskId}
        onSignOut={handleSignOut}
      />
    )
  }

  return (
    <OwnerSignInForm
      kioskId={resolvedKioskId}
      onExit={onExit}
      onSuccess={(token, username, resolvedId) => {
        setResolvedKioskId(resolvedId)
        setAuthed(true)
      }}
    />
  )
}