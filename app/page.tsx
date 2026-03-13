"use client"

import { useEffect, useState, useCallback, useRef, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"
import AdminPanel from "./components/AdminPanel"
import OwnerSignIn from "./components/OwnerSignIn"

declare global {
  interface Window {
    electronAPI?: any
    api?: any
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }
}

const API = "https://printing-pixel-1.onrender.com"

// ── Sound Engine ────────────────────────────────────────────────────────────
function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null)
  const getCtx = () => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (Ctx) ctxRef.current = new Ctx()
    }
    return ctxRef.current
  }
  const playClick = (freq = 1000, duration = 0.045, gain = 0.16) => {
    const ctx = getCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const vol = ctx.createGain()
    osc.connect(vol); vol.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, ctx.currentTime + duration)
    vol.gain.setValueAtTime(gain, ctx.currentTime)
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  }
  return { playClick }
}

interface PrintProgressData {
  status: "downloading" | "printing"
  filename: string
  current: number
  total: number
}

// ── Theme Context ────────────────────────────────────────────────────────────
type Theme = "dark" | "light"

// ── Main UI ──────────────────────────────────────────────────────────────────
function MainUI() {
  const searchParams = useSearchParams()
  const KIOSK_USERNAME = searchParams.get("kiosk") || "nyc"
  const PASSKEY = searchParams.get("passkey") || ""

  const { playClick } = useAudio()

  const [theme, setTheme] = useState<Theme>("dark")
  const isDark = theme === "dark"

  const [otp, setOtp] = useState("")
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null)
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTitle, setSheetTitle] = useState("Verifying OTP...")
  const [sheetSubtitle, setSheetSubtitle] = useState("Please wait a moment")
  const [sheetSpinner, setSheetSpinner] = useState(true)
  const [sheetPrinting, setSheetPrinting] = useState(false)
  const [sheetProgress, setSheetProgress] = useState(0)
  const [sheetProgressVisible, setSheetProgressVisible] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const [successVisible, setSuccessVisible] = useState(false)
  const [countdown, setCountdown] = useState(10)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [showPasskey, setShowPasskey] = useState(false)
  const [passkeyInput, setPasskeyInput] = useState("")
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [showOwnerSignIn, setShowOwnerSignIn] = useState(false)

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://pixel-livid-two.vercel.app/?kiosk_id=${KIOSK_USERNAME}`)}&bgcolor=${isDark ? "0c0c0e" : "f8f7f4"}&color=${isDark ? "ffffff" : "0c0c0e"}&margin=4`

  // Theme tokens
  const T = {
    bg: isDark ? "#0c0c0e" : "#f8f7f4",
    surface: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
    surfaceHover: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)",
    borderActive: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.5)",
    borderFilled: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
    text: isDark ? "#fff" : "#0c0c0e",
    textMuted: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)",
    textDim: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.2)",
    btnActive: isDark ? "rgba(255,255,255,0.92)" : "#0c0c0e",
    btnActiveText: isDark ? "#0c0c0e" : "#f8f7f4",
    btnInactive: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
    btnInactiveText: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
    leftBg: isDark ? "#111014" : "#eeecea",
    rightBg: isDark ? "#0c0c0e" : "#f8f7f4",
    accentA: isDark ? "rgba(200,100,60,0.5)" : "rgba(220,90,40,0.3)",
    accentB: isDark ? "rgba(80,120,200,0.45)" : "rgba(60,100,180,0.2)",
    accentC: isDark ? "rgba(240,160,80,0.3)" : "rgba(220,140,60,0.2)",
    divider: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
    sheetBg: isDark ? "rgba(10,10,14,0.97)" : "rgba(248,247,244,0.97)",
    sheetBorder: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)",
    successBg: isDark ? "#0c0c0e" : "#f8f7f4",
    numLabel: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
    watermark: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)",
  }

  const showMsg = (text: string, isError = true) => {
    setMsg({ text, isError })
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    msgTimerRef.current = setTimeout(() => setMsg(null), 2800)
  }

  const inputEnabled = !verifying

  const handleNum = useCallback((digit: string, isPasskey = false) => {
    playClick(1080, 0.04, 0.16)
    if (isPasskey) {
      setPasskeyInput(p => p.length < 6 ? p + digit : p)
    } else {
      setOtp(p => p.length < 6 ? p + digit : p)
    }
  }, [playClick])

  const handleDel = useCallback((isPasskey = false) => {
    playClick(580, 0.055, 0.12)
    if (isPasskey) {
      setPasskeyInput(p => p.slice(0, -1))
    } else {
      setOtp(p => p.slice(0, -1))
    }
  }, [playClick])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        showPasskey ? handleNum(e.key, true) : handleNum(e.key)
      }
      if (e.key === "Backspace") {
        showPasskey ? handleDel(true) : handleDel()
      }
      if (e.key === "Enter") {
        if (showPasskey && passkeyInput.length > 0) handlePasskeySubmit()
        else if (otp.length === 6 && !verifying) handleVerify()
      }
      if (e.key === "Escape") {
        setShowPasskey(false)
        setShowOwnerSignIn(false)
      }
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [handleNum, handleDel, otp, verifying, showPasskey, passkeyInput])

  const handlePasskeySubmit = () => {
    if (!PASSKEY || passkeyInput === PASSKEY) {
      setIsAdminMode(true)
      setShowPasskey(false)
      setPasskeyInput("")
    } else {
      showMsg("Invalid passkey", true)
      setPasskeyInput("")
    }
  }

  const openSheet = (title: string, subtitle: string, spinner = true, progress = false) => {
    setSheetTitle(title); setSheetSubtitle(subtitle)
    setSheetSpinner(spinner); setSheetPrinting(false)
    setSheetProgressVisible(progress); setSheetOpen(true)
  }

  const closeSheet = () => { setSheetOpen(false); setVerifying(false) }

  const updateSheet = (title: string, subtitle?: string) => {
    setSheetTitle(title)
    if (subtitle) setSheetSubtitle(subtitle)
  }

  useEffect(() => {
    const api = (window as any).api
    if (api?.onPrintProgress) {
      api.onPrintProgress((data: PrintProgressData) => {
        const totalSteps = data.total * 2
        let currentStep = (data.current - 1) * 2
        if (data.status === "printing") currentStep += 2
        else currentStep += 1
        const pct = (currentStep / totalSteps) * 100
        if (data.status === "printing") {
          updateSheet("Printing...", `File ${data.current} of ${data.total}: ${data.filename}`)
          setSheetSpinner(false); setSheetPrinting(true)
        } else {
          updateSheet("Downloading...", `File ${data.current} of ${data.total}`)
          setSheetSpinner(true); setSheetPrinting(false)
        }
        setSheetProgress(pct)
      })
    }
  }, [])

  const showSuccess = () => {
    setSheetOpen(false); setSuccessVisible(true)
    let sec = 10; setCountdown(sec)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      sec--; setCountdown(sec)
      if (sec <= 0) { clearInterval(countdownRef.current!); resetAll() }
    }, 1000)
  }

  const resetAll = () => {
    setSuccessVisible(false); setOtp(""); setVerifying(false); setSheetProgress(0)
  }

  const startDownloadAndPrint = async (files: any[]) => {
    updateSheet("Starting...", "Initializing print job")
    setSheetProgressVisible(true); setSheetProgress(0)
    try {
      const api = (window as any).api || (window as any).electronAPI
      await api.downloadAndPrint(files)
      setSheetProgress(100)
      setTimeout(() => showSuccess(), 1000)
    } catch (error: any) {
      closeSheet(); showMsg("System Error: " + error.message)
    }
  }

  const handleVerify = async () => {
    if (otp.length !== 6) { showMsg("Enter all 6 digits first"); setOtp(""); return }
    setVerifying(true)
    openSheet("Verifying OTP...", "Checking credentials", true, false)
    try {
      const res = await fetch(`${API}/api/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp, kioskId: KIOSK_USERNAME })
      })
      const data = await res.json()
      if (!data.success) {
        closeSheet(); setOtp(""); showMsg(data.error || "Invalid OTP — please try again"); return
      }
      updateSheet("Verified!", "Preparing your files...")
      setOtp("")
      setTimeout(() => startDownloadAndPrint(data.files), 1000)
    } catch (error: any) {
      closeSheet(); setOtp(""); showMsg("Network error: " + error.message)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const numBtnBase: React.CSSProperties = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 0,
    color: T.text,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "18px 8px",
    cursor: "pointer",
    userSelect: "none",
    fontFamily: "'Space Grotesk', sans-serif",
    transition: "background 0.1s, transform 0.08s, border-color 0.12s",
    position: "relative", overflow: "hidden"
  }

  if (isAdminMode) return <AdminPanel kioskId={KIOSK_USERNAME} onExit={() => setIsAdminMode(false)} />
  if (showOwnerSignIn) return <OwnerSignIn kioskId={KIOSK_USERNAME} onExit={() => setShowOwnerSignIn(false)} />

  // ── PASSKEY SCREEN ──────────────────────────────────────────────────────
  if (showPasskey) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", transition: "background 0.4s" }}>
        <style>{globalStyles}</style>
        <button onClick={() => { setShowPasskey(false); setPasskeyInput("") }}
          style={{ position: "fixed", top: 20, right: 20, background: T.surface, border: `1px solid ${T.border}`, color: T.textMuted, padding: "8px 18px", cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'Space Grotesk', sans-serif" }}>
          ← Back
        </button>
        <div style={{ width: 360, background: T.surface, border: `1px solid ${T.border}`, padding: 44, textAlign: "center", color: T.text }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: T.textDim, marginBottom: 12 }}>Admin Access</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.03em" }}>Enter Passkey</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 32 }}>Restricted area — authorized personnel only</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24, justifyContent: "center" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ width: 40, height: 50, background: i < passkeyInput.length ? T.surfaceHover : T.surface, border: `1.5px solid ${i === passkeyInput.length ? T.borderActive : i < passkeyInput.length ? T.borderFilled : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: T.text, position: "relative" }}>
                {passkeyInput[i] ? "•" : ""}
                {i === passkeyInput.length && (
                  <motion.div animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 1, repeatType: "reverse" }}
                    style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: 14, height: 2, background: T.borderActive }} />
                )}
              </div>
            ))}
          </div>
          <AnimatePresence>
            {msg && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ fontSize: 12, fontWeight: 600, marginBottom: 14, color: msg.isError ? "#e05c3a" : T.textMuted }}>
                {msg.text}
              </motion.div>
            )}
          </AnimatePresence>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(n => (
              <button key={n} onClick={() => handleNum(n, true)} style={numBtnBase}
                onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
                onMouseLeave={e => e.currentTarget.style.background = T.surface}
                onMouseDown={e => e.currentTarget.style.transform = "scale(0.94)"}
                onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
                <div style={{ fontSize: 22, fontWeight: 500, color: T.text }}>{n}</div>
              </button>
            ))}
            <div />
            <button onClick={() => handleNum("0", true)} style={numBtnBase}
              onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
              onMouseLeave={e => e.currentTarget.style.background = T.surface}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.94)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
              <div style={{ fontSize: 22, fontWeight: 500, color: T.text }}>0</div>
            </button>
            <button onClick={() => handleDel(true)} style={numBtnBase}
              onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
              onMouseLeave={e => e.currentTarget.style.background = T.surface}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.94)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" /></svg>
            </button>
          </div>
          <button onClick={handlePasskeySubmit} disabled={passkeyInput.length === 0}
            style={{ width: "100%", padding: "15px 0", background: passkeyInput.length > 0 ? T.btnActive : T.btnInactive, color: passkeyInput.length > 0 ? T.btnActiveText : T.btnInactiveText, border: "none", fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", fontFamily: "'Space Grotesk', sans-serif", cursor: passkeyInput.length > 0 ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
            Unlock Admin
          </button>
        </div>
      </div>
    )
  }

  // ── MAIN UI ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", fontFamily: "'Space Grotesk', sans-serif", background: T.bg, color: T.text, overflow: "hidden", position: "relative", transition: "background 0.4s, color 0.4s" }}>
      <style>{globalStyles}</style>

      {/* ── LEFT PANEL: Hero + QR ─────────────────────────────────────────── */}
      <div style={{ flex: 1, height: "100%", position: "relative", overflow: "hidden", borderRight: `1px solid ${T.divider}`, background: T.leftBg, transition: "background 0.4s" }}>

        {/* Ambient blobs */}
        <div style={{ position: "absolute", top: "-15%", left: "-20%", width: "80%", height: "80%", background: `radial-gradient(ellipse, ${T.accentA} 0%, transparent 65%)`, filter: "blur(70px)", animation: "floatA 9s ease-in-out infinite alternate", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-15%", right: "-15%", width: "70%", height: "70%", background: `radial-gradient(ellipse, ${T.accentB} 0%, transparent 65%)`, filter: "blur(80px)", animation: "floatB 11s ease-in-out infinite alternate", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "40%", left: "60%", transform: "translate(-50%,-50%)", width: 200, height: 200, background: `radial-gradient(ellipse, ${T.accentC} 0%, transparent 70%)`, filter: "blur(40px)", animation: "floatOrb 7s ease-in-out infinite alternate", pointerEvents: "none" }} />

        {/* Grid overlay */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.025)"} 1px, transparent 1px), linear-gradient(90deg, ${isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.025)"} 1px, transparent 1px)`, backgroundSize: "52px 52px", pointerEvents: "none" }} />

        {/* Top-left brand */}
        <div style={{ position: "absolute", top: 28, left: 28, zIndex: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.32em", textTransform: "uppercase", color: T.textDim }}>INNVERA</div>
        </div>

        {/* Theme toggle */}
        <div style={{ position: "absolute", top: 20, right: 20, zIndex: 20 }}>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title="Toggle theme"
            style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMuted, padding: "8px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'Space Grotesk', sans-serif", display: "flex", alignItems: "center", gap: 7, transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHover; e.currentTarget.style.color = T.text }}
            onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.color = T.textMuted }}
          >
            {isDark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
            {isDark ? "Light" : "Dark"}
          </button>
        </div>

        {/* Admin icon */}
        <div style={{ position: "absolute", top: 20, right: 110, zIndex: 20 }}>
          <button onClick={() => setShowPasskey(true)} title="Admin Access"
            style={{ background: T.surface, border: `1px solid ${T.border}`, cursor: "pointer", color: T.textMuted, padding: 8, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.background = T.surfaceHover }}
            onMouseLeave={e => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.background = T.surface }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>

        {/* Hero text */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 44px 80px", zIndex: 5 }}>

          {/* Kiosk label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ width: 28, height: 1, background: T.textDim }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: T.textDim }}>
              Station — {KIOSK_USERNAME.toUpperCase()}
            </span>
          </div>

          {/* Main headline */}
          <div style={{ fontSize: "clamp(2.2rem, 5.5vw, 4.2rem)", fontWeight: 900, lineHeight: 0.92, letterSpacing: "-0.04em", textTransform: "uppercase", color: T.text, marginBottom: 24 }}>
            <div>Collect</div>
            <div style={{ color: T.textMuted }}>Your</div>
            <div>Prints.</div>
          </div>

          {/* Sub description */}
          <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 500, lineHeight: 1.7, maxWidth: 300, marginBottom: 48 }}>
            Enter the 6-digit OTP from your confirmation to release your print job from this kiosk.
          </div>

          {/* Decorative rule */}
          <div style={{ width: 48, height: 1, background: T.divider, marginBottom: 44 }} />

          {/* QR code section */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: T.textDim, marginBottom: 16 }}>
              Scan to generate your OTP
            </div>

            <div style={{ display: "inline-block", padding: 12, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", border: `1px solid ${T.border}`, position: "relative" }}>
              {/* Corner accents */}
              <div style={{ position: "absolute", top: -1, left: -1, width: 14, height: 14, borderTop: `2px solid ${T.text}`, borderLeft: `2px solid ${T.text}` }} />
              <div style={{ position: "absolute", top: -1, right: -1, width: 14, height: 14, borderTop: `2px solid ${T.text}`, borderRight: `2px solid ${T.text}` }} />
              <div style={{ position: "absolute", bottom: -1, left: -1, width: 14, height: 14, borderBottom: `2px solid ${T.text}`, borderLeft: `2px solid ${T.text}` }} />
              <div style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14, borderBottom: `2px solid ${T.text}`, borderRight: `2px solid ${T.text}` }} />

              <img
                src={qrUrl}
                alt="QR Code"
                width={148}
                height={148}
                style={{ display: "block", imageRendering: "pixelated" }}
              />
            </div>

            <div style={{ marginTop: 12, fontSize: 11, color: T.textDim, fontWeight: 500, letterSpacing: "0.04em" }}>
              pixel-livid-two.vercel.app
            </div>
          </div>
        </div>

        {/* Bottom watermark */}
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, letterSpacing: "0.32em", textTransform: "uppercase", color: T.watermark, whiteSpace: "nowrap", zIndex: 5 }}>
          INNVERA — PRINT ANYWHERE
        </div>
      </div>

      {/* ── RIGHT PANEL: OTP KEYPAD ───────────────────────────────────────── */}
      <div style={{ width: "44%", minWidth: 380, height: "100%", display: "flex", flexDirection: "column", background: T.rightBg, position: "relative", zIndex: 10, boxSizing: "border-box", transition: "background 0.4s" }}>

        {/* Vertical accent line */}
        <div style={{ position: "absolute", left: 0, top: "10%", height: "80%", width: 1, background: `linear-gradient(to bottom, transparent, ${T.divider}, transparent)` }} />

        {/* Scrollable inner */}
        <div style={{ flex: 1, overflowY: "auto", padding: "36px 40px 28px", display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: T.textDim, marginBottom: 8 }}>
              OTP Entry
            </div>
            <div style={{ fontSize: "clamp(1.3rem, 2.5vw, 1.9rem)", fontWeight: 900, letterSpacing: "-0.03em", color: T.text, lineHeight: 1.1 }}>
              Enter Access Code
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
              Type the 6-digit OTP sent to the user
            </div>
          </div>

          {/* OTP display boxes */}
          <div style={{ display: "flex", gap: 7, marginBottom: 6 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 56,
                background: i < otp.length ? T.surfaceHover : T.surface,
                border: `1.5px solid ${i === otp.length ? T.borderActive : i < otp.length ? T.borderFilled : T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, fontWeight: 700, color: T.text, position: "relative",
                transition: "border-color 0.15s, background 0.15s",
                fontVariantNumeric: "tabular-nums"
              }}>
                {otp[i] || ""}
                {i === otp.length && (
                  <div style={{ position: "absolute", bottom: 7, left: "50%", transform: "translateX(-50%)", width: 16, height: 2, background: T.borderActive, animation: "blink 1s step-end infinite" }} />
                )}
              </div>
            ))}
          </div>

          {/* Progress fill */}
          <div style={{ height: 2, background: T.border, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ height: "100%", background: T.borderActive, width: `${(otp.length / 6) * 100}%`, transition: "width 0.3s ease" }} />
          </div>

          {/* Toast */}
          <div style={{ minHeight: 22, marginBottom: 16 }}>
            <AnimatePresence>
              {msg && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ fontSize: 12, fontWeight: 600, color: msg.isError ? "#e05c3a" : T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                  {msg.isError && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e05c3a", display: "inline-block", flexShrink: 0 }} />}
                  {msg.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* NUMPAD */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10, flex: "0 0 auto" }}>
            {([
              ["1", ""], ["2", "ABC"], ["3", "DEF"],
              ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
              ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
            ] as [string, string][]).map(([n, sub]) => (
              <button key={n} onClick={() => handleNum(n)} disabled={!inputEnabled}
                style={{ ...numBtnBase, opacity: !inputEnabled ? 0.3 : 1, cursor: !inputEnabled ? "not-allowed" : "pointer" }}
                onMouseEnter={e => { if (inputEnabled) e.currentTarget.style.background = T.surfaceHover }}
                onMouseLeave={e => { if (inputEnabled) e.currentTarget.style.background = T.surface }}
                onMouseDown={e => { if (inputEnabled) e.currentTarget.style.transform = "scale(0.94)" }}
                onMouseUp={e => { e.currentTarget.style.transform = "scale(1)" }}>
                <div style={{ fontSize: 24, fontWeight: 500, color: T.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{n}</div>
                {sub && <div style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: T.numLabel, fontWeight: 700, marginTop: 3 }}>{sub}</div>}
              </button>
            ))}

            {/* Bottom row: empty, 0, del */}
            <div />
            <button onClick={() => handleNum("0")} disabled={!inputEnabled}
              style={{ ...numBtnBase, opacity: !inputEnabled ? 0.3 : 1, cursor: !inputEnabled ? "not-allowed" : "pointer" }}
              onMouseEnter={e => { if (inputEnabled) e.currentTarget.style.background = T.surfaceHover }}
              onMouseLeave={e => { if (inputEnabled) e.currentTarget.style.background = T.surface }}
              onMouseDown={e => { if (inputEnabled) e.currentTarget.style.transform = "scale(0.94)" }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)" }}>
              <div style={{ fontSize: 24, fontWeight: 500, color: T.text, fontVariantNumeric: "tabular-nums" }}>0</div>
            </button>
            <button onClick={() => handleDel()} disabled={!inputEnabled}
              style={{ ...numBtnBase, opacity: !inputEnabled ? 0.3 : 1, cursor: !inputEnabled ? "not-allowed" : "pointer" }}
              onMouseEnter={e => { if (inputEnabled) e.currentTarget.style.background = T.surfaceHover }}
              onMouseLeave={e => { if (inputEnabled) e.currentTarget.style.background = T.surface }}
              onMouseDown={e => { if (inputEnabled) e.currentTarget.style.transform = "scale(0.94)" }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            </button>
          </div>

          {/* Verify button */}
          <button onClick={handleVerify} disabled={otp.length < 6 || !inputEnabled}
            style={{
              width: "100%", padding: 17, marginTop: 4,
              background: otp.length === 6 && inputEnabled ? T.btnActive : T.btnInactive,
              color: otp.length === 6 && inputEnabled ? T.btnActiveText : T.btnInactiveText,
              border: "none",
              fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase",
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: otp.length < 6 || !inputEnabled ? "not-allowed" : "pointer",
              transition: "all 0.2s", position: "relative", overflow: "hidden"
            }}
            onMouseEnter={e => { if (otp.length === 6 && inputEnabled) { e.currentTarget.style.opacity = "0.9" } }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1" }}>
            {verifying ? "Verifying..." : "Verify & Print"}
          </button>

          {/* Footer note */}
          <div style={{ marginTop: 20, fontSize: 11, color: T.textDim, textAlign: "center", letterSpacing: "0.04em" }}>
            OTPs expire after use — valid for one print session
          </div>
        </div>
      </div>

      {/* ── BOTTOM SHEET ─────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: sheetOpen ? 0 : "-55%", left: 0, width: "100%", height: "42vh",
        background: T.sheetBg,
        borderTop: `1px solid ${T.sheetBorder}`,
        boxShadow: isDark ? "0 -12px 60px rgba(0,0,0,0.6)" : "0 -8px 40px rgba(0,0,0,0.12)",
        transition: "bottom 0.5s cubic-bezier(0.19,1,0.22,1), background 0.4s",
        zIndex: 100,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "0 32px", backdropFilter: "blur(24px)"
      }}>
        <div style={{ width: 32, height: 3, background: T.border, position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)" }} />

        {sheetSpinner && (
          <div style={{ border: `3px solid ${T.surface}`, borderTop: `3px solid ${T.textMuted}`, borderRadius: "50%", width: 40, height: 40, animation: "spin 0.8s linear infinite", marginBottom: 18 }} />
        )}

        {sheetPrinting && (
          <div style={{ marginBottom: 16 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </div>
        )}

        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 6, textAlign: "center", letterSpacing: "-0.02em" }}>{sheetTitle}</div>
        <div style={{ fontSize: 13, color: T.textMuted, textAlign: "center" }}>{sheetSubtitle}</div>

        {sheetProgressVisible && (
          <div style={{ width: "60%", height: 2, background: T.border, marginTop: 22, overflow: "hidden" }}>
            <div style={{ height: "100%", background: T.text, width: sheetProgress + "%", transition: "width 0.3s ease" }} />
          </div>
        )}
      </div>

      {/* ── SUCCESS OVERLAY ───────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", inset: 0, background: T.successBg, zIndex: 200,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: T.text,
        opacity: successVisible ? 1 : 0,
        pointerEvents: successVisible ? "all" : "none",
        transition: "opacity 0.5s ease"
      }}>
        {/* Checkmark circle */}
        <div style={{ width: 80, height: 80, border: `1.5px solid ${T.borderFilled}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28, animation: successVisible ? "popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275)" : "none" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Success text */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: T.textDim, marginBottom: 16 }}>Print Job Complete</div>
        <div style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 900, letterSpacing: "-0.04em", textTransform: "uppercase", marginBottom: 12, textAlign: "center" }}>
          Collect Your<br />Documents
        </div>
        <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 40, textAlign: "center" }}>
          Your files have been sent to the printer
        </div>

        {/* Status indicators */}
        <div style={{ display: "flex", gap: 24, marginBottom: 36 }}>
          {[
            { icon: "✓", label: "OTP Verified" },
            { icon: "✓", label: "Files Downloaded" },
            { icon: "✓", label: "Sent to Printer" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: 40, height: 40, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: T.text }}>
                {item.icon}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: T.textDim }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: T.textDim, border: `1px solid ${T.border}`, padding: "7px 20px", letterSpacing: "0.12em" }}>
          Screen resets in {countdown}s
        </div>
      </div>

    </div>
  )
}

// ── Global Styles ─────────────────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  ::-webkit-scrollbar { width: 0; }
  @keyframes floatA { from { transform: translate(0,0) scale(1); } to { transform: translate(6%,8%) scale(1.08); } }
  @keyframes floatB { from { transform: translate(0,0) scale(1); } to { transform: translate(-5%,-6%) scale(1.06); } }
  @keyframes floatOrb { from { transform: translate(-50%,-50%) scale(1); } to { transform: translate(-50%,-45%) scale(1.15); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
`

// ── Export ────────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <Suspense fallback={<div style={{ height: "100vh", background: "#0c0c0e", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 12 }}>Loading Kiosk...</div>}>
      <MainUI />
    </Suspense>
  )
}