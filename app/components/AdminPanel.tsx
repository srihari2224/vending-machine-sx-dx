"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import OwnerSignIn from "./OwnerSignIn"

const KIOSK_BACKEND = "https://kiosk-backend-t1mi.onrender.com"

interface Printer { label: string; current: number; max: number }
type Theme = "dark" | "light"

const T = {
  dark: {
    bg: "#000000", bgPanel: "#0a0a0a", bgCard: "#0f0f0f",
    fg: "#ffffff", fgSub: "#a3a3a3", fgDim: "rgba(255,255,255,0.25)",
    border: "rgba(255,255,255,0.1)", borderStrong: "rgba(255,255,255,0.2)",
    trackBg: "rgba(255,255,255,0.06)", sshBg: "#050505",
    btnBg: "rgba(255,255,255,0.04)", btnBorder: "rgba(255,255,255,0.1)",
    accent: "#ff6b47", gridLine: "rgba(255,255,255,0.06)",
  },
  light: {
    bg: "#f5f5f5", bgPanel: "#ffffff", bgCard: "#fafafa",
    fg: "#000000", fgSub: "#555555", fgDim: "rgba(0,0,0,0.35)",
    border: "rgba(0,0,0,0.1)", borderStrong: "rgba(0,0,0,0.2)",
    trackBg: "rgba(0,0,0,0.08)", sshBg: "#1a1a1a",
    btnBg: "rgba(0,0,0,0.04)", btnBorder: "rgba(0,0,0,0.12)",
    accent: "#ff6b47", gridLine: "rgba(0,0,0,0.05)",
  },
}

export default function AdminPanel({ kioskId, onExit }: { kioskId: string; onExit: () => void }) {
  const [kiosk, setKiosk] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null)
  const [theme, setTheme] = useState<Theme>("dark")
  const [showOwnerSignIn, setShowOwnerSignIn] = useState(false)

  const c = T[theme]

  const showMsg = (text: string, isError = false) => {
    setMsg({ text, isError })
    setTimeout(() => setMsg(null), 3000)
  }

  useEffect(() => {
    fetch(`${KIOSK_BACKEND}/api/kiosk/${kioskId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setKiosk(d.kiosk); else showMsg("Could not load kiosk data", true) })
      .catch(() => showMsg("Network error", true))
      .finally(() => setLoading(false))
  }, [kioskId])

  const printers: Printer[] = kiosk ? [
    { label: "Printer 1", current: kiosk.printer1Capacity ?? 250, max: kiosk.printer1Capacity ?? 250 },
    ...(kiosk.kioskType === "DX-Series"
      ? [{ label: "Printer 2", current: kiosk.printer2Capacity ?? 250, max: kiosk.printer2Capacity ?? 250 }]
      : []),
  ] : []

  const [levels, setLevels] = useState<number[]>([])
  useEffect(() => {
    if (printers.length > 0 && levels.length === 0) setLevels(printers.map(p => p.current))
  }, [printers.length])

  const resetPrinter = (idx: number) => {
    setLevels(prev => { const n = [...prev]; n[idx] = printers[idx]?.max ?? 250; return n })
    showMsg(`Printer ${idx + 1} paper level reset`)
  }

  const levelColor = (pct: number) => pct > 50 ? "#22c55e" : pct > 20 ? "#f59e0b" : "#ef4444"

  const infoRows = [
    { label: "Kiosk ID", value: kiosk?.kioskId || kioskId },
    { label: "Type", value: kiosk?.kioskType || "-" },
    { label: "Service", value: kiosk?.serviceType || "-" },
    { label: "IP Address", value: kiosk?.ipAddress || "-" },
    { label: "Status", value: kiosk?.status || "-" },
    { label: "Owner", value: kiosk?.ownerName || "-" },
  ]

  // If owner sign-in is shown, render it fullscreen
  if (showOwnerSignIn) {
    return <OwnerSignIn kioskId={kioskId} onExit={() => setShowOwnerSignIn(false)} />
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: c.bg, display: "flex", flexDirection: "column", fontFamily: '"Inter", sans-serif', transition: "background 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
      `}</style>

      {/* Grid lines */}
      {["16.6%", "50%", "83.3%"].map(l => (
        <div key={l} style={{ position: "fixed", top: 0, left: l, width: 1, height: "100%", background: c.gridLine, pointerEvents: "none", zIndex: 0 }} />
      ))}

      {/* Header */}
      <div style={{ height: 64, borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", background: c.bgPanel, position: "relative", zIndex: 10, flexShrink: 0 }}>
        {/* Left: brand */}
        <div>
          <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: c.accent, marginBottom: 4 }}>
            INNVERA Admin
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 1, color: c.fg }}>
            Kiosk Hardware Status
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Owner Sign In button */}
          <button
            onClick={() => setShowOwnerSignIn(true)}
            style={{
              background: "transparent",
              border: `1px solid ${c.accent}`,
              color: c.accent,
              padding: "7px 16px",
              cursor: "pointer",
              fontFamily: '"Inter", sans-serif',
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = "#000" }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = c.accent }}
          >
            Owner Sign In
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            style={{ background: c.btnBg, border: `1px solid ${c.btnBorder}`, color: c.fgSub, padding: "7px 14px", cursor: "pointer", fontFamily: '"Inter", sans-serif', fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.btnBorder; e.currentTarget.style.color = c.fgSub }}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>

          {/* Exit */}
          <button
            onClick={onExit}
            style={{ background: "transparent", border: `1px solid ${c.borderStrong}`, color: c.fgSub, padding: "8px 20px", cursor: "pointer", fontFamily: '"Inter", sans-serif', fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = c.fg; e.currentTarget.style.color = c.bg }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = c.fgSub }}
          >
            Exit Admin
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: c.fgDim, fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Loading kiosk data...
          </div>
        ) : (
          <div style={{ display: "flex", gap: 0, height: "100%" }}>
            {/* Left: Device info */}
            <div style={{ width: 320, borderRight: `1px solid ${c.border}`, background: c.bgPanel, padding: "48px 32px", flexShrink: 0 }}>
              <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: c.accent, marginBottom: 24, fontFamily: '"Space Mono", monospace' }}>
                Device Info
              </div>
              {infoRows.map(({ label, value }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", padding: "14px 0", borderBottom: `1px solid ${c.border}` }}>
                  <span style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: c.fgDim, fontFamily: '"Space Mono", monospace', marginBottom: 4 }}>
                    {label}
                  </span>
                  <span style={{
                    fontSize: "0.85rem", fontWeight: 700, letterSpacing: "-0.01em",
                    color: label === "Status"
                      ? value === "ACTIVE" ? "#22c55e" : value === "PENDING" ? "#f59e0b" : "#ef4444"
                      : c.fg,
                  }}>
                    {value}
                  </span>
                </div>
              ))}

              {/* SSH block */}
              {kiosk?.cpuUsername && kiosk?.ipAddress && (
                <div style={{ marginTop: 24, padding: "14px 16px", background: c.sshBg, border: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: "0.45rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: c.fgDim, fontFamily: '"Space Mono", monospace', marginBottom: 6 }}>
                    SSH Access
                  </div>
                  <code style={{ fontSize: "0.7rem", color: c.accent, fontFamily: '"Space Mono", monospace' }}>
                    ssh {kiosk.cpuUsername}@{kiosk.ipAddress}
                  </code>
                </div>
              )}
            </div>

            {/* Right: Printer panels */}
            <div style={{ flex: 1, padding: "48px 40px", overflowY: "auto" }}>
              <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: c.fgDim, marginBottom: 32, fontFamily: '"Space Mono", monospace' }}>
                Hardware Status
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {(printers.length > 0 ? printers : [{ label: "Printer 1", current: 145, max: 250 }]).map((printer, idx) => {
                  const current = levels[idx] ?? printer.current
                  const pct = Math.round((current / printer.max) * 100)
                  return (
                    <motion.div
                      key={printer.label}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{ border: `1px solid ${c.border}`, background: c.bgCard, padding: "32px 36px", marginBottom: 16 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                        <div>
                          <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: c.accent, marginBottom: 6, fontFamily: '"Space Mono", monospace' }}>
                            {printer.label}
                          </div>
                          <div style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 1, color: c.fg }}>
                            Paper Level
                          </div>
                        </div>
                        <div style={{ fontSize: "3.5rem", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: levelColor(pct) }}>
                          {pct}%
                        </div>
                      </div>

                      <div style={{ height: 4, background: c.trackBg, marginBottom: 12, position: "relative" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                          style={{ position: "absolute", top: 0, left: 0, height: "100%", background: levelColor(pct) }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, alignItems: "baseline" }}>
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, color: pct <= 20 ? "#ef4444" : c.fgDim, textTransform: "uppercase", letterSpacing: "0.18em", fontFamily: '"Space Mono", monospace' }}>
                          {pct <= 20 ? "Low — refill now" : pct <= 50 ? "Moderate" : "Good"}
                        </span>
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, color: c.fgDim, textTransform: "uppercase", letterSpacing: "0.18em", fontFamily: '"Space Mono", monospace' }}>
                          {current} / {printer.max} sheets
                        </span>
                      </div>

                      <button
                        onClick={() => resetPrinter(idx)}
                        style={{ width: "100%", padding: "14px 0", background: c.btnBg, border: `1px solid ${c.btnBorder}`, color: c.fg, cursor: "pointer", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", fontFamily: '"Inter", sans-serif', transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = "#000000"; e.currentTarget.style.borderColor = c.accent }}
                        onMouseLeave={e => { e.currentTarget.style.background = c.btnBg; e.currentTarget.style.color = c.fg; e.currentTarget.style.borderColor = c.btnBorder }}
                      >
                        Reset {printer.label} Paper Level
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", padding: "10px 24px", background: msg.isError ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${msg.isError ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`, color: msg.isError ? "#ef4444" : "#22c55e", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", whiteSpace: "nowrap", fontFamily: '"Space Mono", monospace', zIndex: 200 }}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}