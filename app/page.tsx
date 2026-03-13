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

// ── Print Progress IPC ───────────────────────────────────────────────────────
interface PrintProgressData {
  status: "downloading" | "printing"
  filename: string
  current: number
  total: number
}

// ── Main UI ──────────────────────────────────────────────────────────────────
function MainUI() {
  const searchParams = useSearchParams()
  const KIOSK_USERNAME = searchParams.get("kiosk") || "nyc"
  const PASSKEY = searchParams.get("passkey") || ""

  const { playClick } = useAudio()

  // OTP state
  const [otp, setOtp] = useState("")
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null)
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sheet/overlay state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTitle, setSheetTitle] = useState("Verifying OTP...")
  const [sheetSubtitle, setSheetSubtitle] = useState("Please wait a moment")
  const [sheetSpinner, setSheetSpinner] = useState(true)
  const [sheetPrinting, setSheetPrinting] = useState(false)
  const [sheetProgress, setSheetProgress] = useState(0)
  const [sheetProgressVisible, setSheetProgressVisible] = useState(false)
  const [verifying, setVerifying] = useState(false)

  // Success overlay
  const [successVisible, setSuccessVisible] = useState(false)
  const [countdown, setCountdown] = useState(10)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Modes
  const [showPasskey, setShowPasskey] = useState(false)
  const [passkeyInput, setPasskeyInput] = useState("")
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [showOwnerSignIn, setShowOwnerSignIn] = useState(false)

  // Bar fill
  const barPct = (otp.length / 6) * 100

  // ── Toast ────────────────────────────────────────────────────────────────
  const showMsg = (text: string, isError = true) => {
    setMsg({ text, isError })
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    msgTimerRef.current = setTimeout(() => setMsg(null), 2800)
  }

  // ── Input state ──────────────────────────────────────────────────────────
  const inputEnabled = !verifying

  // ── Numpad ──────────────────────────────────────────────────────────────
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

  // ── Keyboard support ────────────────────────────────────────────────────
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

  // ── Passkey ──────────────────────────────────────────────────────────────
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

  // ── Sheet helpers ────────────────────────────────────────────────────────
  const openSheet = (title: string, subtitle: string, spinner = true, progress = false) => {
    setSheetTitle(title)
    setSheetSubtitle(subtitle)
    setSheetSpinner(spinner)
    setSheetPrinting(false)
    setSheetProgressVisible(progress)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setVerifying(false)
  }

  const updateSheet = (title: string, subtitle?: string) => {
    setSheetTitle(title)
    if (subtitle) setSheetSubtitle(subtitle)
  }

  // ── Print Progress from Electron ────────────────────────────────────────
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
          setSheetSpinner(false)
          setSheetPrinting(true)
        } else {
          updateSheet("Downloading...", `File ${data.current} of ${data.total}`)
          setSheetSpinner(true)
          setSheetPrinting(false)
        }
        setSheetProgress(pct)
      })
    }
  }, [])

  // ── Success Overlay ──────────────────────────────────────────────────────
  const showSuccess = () => {
    setSheetOpen(false)
    setSuccessVisible(true)
    let sec = 10
    setCountdown(sec)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      sec--
      setCountdown(sec)
      if (sec <= 0) {
        clearInterval(countdownRef.current!)
        resetAll()
      }
    }, 1000)
  }

  const resetAll = () => {
    setSuccessVisible(false)
    setOtp("")
    setVerifying(false)
    setSheetProgress(0)
  }

  // ── Start Download & Print ───────────────────────────────────────────────
  const startDownloadAndPrint = async (files: any[]) => {
    updateSheet("Starting...", "Initializing print job")
    setSheetProgressVisible(true)
    setSheetProgress(0)

    try {
      const api = (window as any).api || (window as any).electronAPI
      const results = await api.downloadAndPrint(files)
      setSheetProgress(100)
      setTimeout(() => showSuccess(), 1000)
    } catch (error: any) {
      closeSheet()
      showMsg("System Error: " + error.message)
    }
  }

  // ── Verify OTP ───────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (otp.length !== 6) {
      showMsg("Enter all 6 digits first")
      setOtp("")
      return
    }

    setVerifying(true)
    openSheet("Verifying OTP...", "Checking credentials", true, false)

    try {
      const res = await fetch(`${API}/api/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp,
          kioskId: KIOSK_USERNAME
        })
      })

      const data = await res.json()

      if (!data.success) {
        closeSheet()
        setOtp("")
        showMsg(data.error || "Invalid OTP — please try again")
        return
      }

      updateSheet("Verified!", "Preparing your files...")
      setOtp("")
      setTimeout(() => startDownloadAndPrint(data.files), 1000)

    } catch (error: any) {
      closeSheet()
      setOtp("")
      showMsg("Network error: " + error.message)
    }
  }

  // ── Admin/Owner views ────────────────────────────────────────────────────
  if (isAdminMode) {
    return <AdminPanel kioskId={KIOSK_USERNAME} onExit={() => setIsAdminMode(false)} />
  }

  if (showOwnerSignIn) {
    return <OwnerSignIn kioskId={KIOSK_USERNAME} onExit={() => setShowOwnerSignIn(false)} />
  }

  // ── Passkey screen ───────────────────────────────────────────────────────
  if (showPasskey) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#0c0c0e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        <button
          onClick={() => { setShowPasskey(false); setPasskeyInput("") }}
          style={{ position: "fixed", top: 20, right: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", padding: "8px 18px", cursor: "pointer", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Inter, sans-serif" }}
        >
          ← Back
        </button>

        <div style={{ width: 340, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: 40, textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>Admin Access</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Enter Passkey</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 32 }}>Enter passkey to access settings</div>

          {/* Digit display */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, justifyContent: "center" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                width: 40, height: 52,
                background: i < passkeyInput.length ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${i === passkeyInput.length ? "rgba(255,255,255,0.3)" : i < passkeyInput.length ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, fontWeight: 700, color: "#fff", position: "relative"
              }}>
                {passkeyInput[i] ? "•" : ""}
                {i === passkeyInput.length && (
                  <motion.div
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 1, repeatType: "reverse" }}
                    style={{ position: "absolute", bottom: 7, left: "50%", transform: "translateX(-50%)", width: 14, height: 2, background: "rgba(255,255,255,0.5)" }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Toast */}
          <AnimatePresence>
            {msg && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ fontSize: 13, fontWeight: 500, marginBottom: 16, color: msg.isError ? "#ff6b6b" : "rgba(255,255,255,0.6)" }}>
                {msg.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Numpad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(n => (
              <PasskeyNumBtn key={n} label={n} onClick={() => handleNum(n, true)} />
            ))}
            <div style={{ background: "transparent" }} />
            <PasskeyNumBtn label="0" onClick={() => handleNum("0", true)} />
            {/* Delete */}
            <button onClick={() => handleDel(true)} style={numBtnStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" /></svg>
            </button>
          </div>

          <button
            onClick={handlePasskeySubmit}
            disabled={passkeyInput.length === 0}
            style={{
              width: "100%", padding: "14px 0", background: passkeyInput.length > 0 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.08)",
              color: passkeyInput.length > 0 ? "#0c0c0e" : "rgba(255,255,255,0.2)", border: "none",
              fontSize: 12, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase",
              fontFamily: "Inter, sans-serif", cursor: passkeyInput.length > 0 ? "pointer" : "not-allowed", transition: "all 0.2s"
            }}
          >
            Unlock Admin
          </button>
        </div>
      </div>
    )
  }

  // ── MAIN OTP UI ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", fontFamily: "Inter, sans-serif", background: "#0c0c0e", color: "#fff", overflow: "hidden", position: "relative" }}>

      {/* ── RIGHT PANEL (art) — rendered first in DOM but visually behind ── */}
      <div style={{ flex: 1, height: "100%", position: "relative", overflow: "hidden", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>

        {/* Animated gradient blobs */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { width: 100%; height: 100%; overflow: hidden; background: #0c0c0e !important; }
          @keyframes floatA { from { transform: translate(0,0) scale(1); } to { transform: translate(6%,8%) scale(1.08); } }
          @keyframes floatB { from { transform: translate(0,0) scale(1); } to { transform: translate(-5%,-6%) scale(1.06); } }
          @keyframes floatOrb { from { transform: translate(-50%,-50%) scale(1); } to { transform: translate(-50%,-45%) scale(1.15); } }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        `}</style>

        <div style={{ position: "absolute", inset: 0, background: "#111014" }} />
        <div style={{ position: "absolute", top: "-10%", left: "-15%", width: "75%", height: "80%", background: "radial-gradient(ellipse, rgba(200,100,60,0.55) 0%, rgba(160,60,40,0.3) 35%, transparent 65%)", filter: "blur(60px)", animation: "floatA 9s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "70%", height: "70%", background: "radial-gradient(ellipse, rgba(80,120,200,0.5) 0%, rgba(40,80,160,0.25) 40%, transparent 65%)", filter: "blur(70px)", animation: "floatB 11s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", top: "30%", left: "55%", transform: "translate(-50%,-50%)", width: 260, height: 260, background: "radial-gradient(ellipse, rgba(240,160,80,0.35) 0%, rgba(200,90,50,0.2) 40%, transparent 70%)", filter: "blur(30px)", animation: "floatOrb 7s ease-in-out infinite alternate" }} />

        {/* Grid overlay */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        {/* Top-right action buttons */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "20px 24px", gap: 8 }}>
          {/* Owner Sign In */}
          <HoverButton
            label="Owner Sign In"
            onClick={() => setShowOwnerSignIn(true)}
            hoverColor="#ff6b47"
          />
          {/* Admin gear icon */}
          <button
            onClick={() => setShowPasskey(true)}
            title="Admin Access"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 8, transition: "all 0.2s", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.08)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "none" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>

        {/* Art cards 2×2 */}
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 12, padding: "80px 20px 20px" }}>
          {[
            { num: "01/", big: "6", label: "Six digits.\nOne access.", tint: "rgba(200,80,40,0.07)", bord: "rgba(200,80,40,0.12)" },
            { num: "02/", big: "∞", label: "Secure print\non demand.", tint: "rgba(60,100,200,0.07)", bord: "rgba(60,100,200,0.12)" },
            { num: "03/", big: "0", label: "Zero wait.\nTouch to start.", tint: "rgba(255,255,255,0.03)", bord: "rgba(255,255,255,0.06)" },
            { num: "04/", big: "1", label: "One tap\nto collect.", tint: "rgba(80,60,160,0.07)", bord: "rgba(80,60,160,0.12)" },
          ].map(c => (
            <ArtCard key={c.num} {...c} />
          ))}
        </div>

        {/* Brand watermark */}
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.12)", whiteSpace: "nowrap" }}>
          INNVERA — PRINT ANYWHERE
        </div>
      </div>

      {/* ── LEFT PANEL: OTP KEYPAD ─────────────────────────────────────────── */}
      <div style={{ width: "42%", minWidth: 360, height: "100%", display: "flex", flexDirection: "column", padding: "32px 36px", background: "#0c0c0e", position: "relative", zIndex: 10, boxSizing: "border-box" }}>

        {/* Top progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
          <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, rgba(255,255,255,0.0), rgba(255,255,255,0.4))", width: barPct + "%", transition: "width 0.4s ease" }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            OTP / {otp.length} of 6
          </span>
        </div>

        {/* OTP content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.22em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 14 }}>
            Kiosk — {KIOSK_USERNAME}
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1, color: "#fff", marginBottom: 8 }}>
            Enter your<br />access code
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontWeight: 400, marginBottom: 36 }}>
            Type the 6-digit OTP sent to the user
          </div>

          {/* Digit boxes */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 58,
                background: i < otp.length ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${i === otp.length ? "rgba(255,255,255,0.3)" : i < otp.length ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 700, color: "#fff", position: "relative",
                transition: "border-color 0.2s, background 0.2s"
              }}>
                {otp[i] || ""}
                {i === otp.length && (
                  <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 16, height: 2, background: "rgba(255,255,255,0.5)", borderRadius: 1, animation: "blink 1s step-end infinite" }} />
                )}
              </div>
            ))}
          </div>

          {/* Toast */}
          <div style={{ minHeight: 20, marginBottom: 24 }}>
            <AnimatePresence>
              {msg && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ fontSize: 13, fontWeight: 500, color: msg.isError ? "#ff6b6b" : "rgba(255,255,255,0.6)" }}
                >
                  {msg.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Numpad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {([
              ["1", ""],
              ["2", "ABC"],
              ["3", "DEF"],
              ["4", "GHI"],
              ["5", "JKL"],
              ["6", "MNO"],
              ["7", "PQRS"],
              ["8", "TUV"],
              ["9", "WXYZ"],
            ] as [string, string][]).map(([n, sub]) => (
              <OtpNumBtn key={n} label={n} sub={sub} onClick={() => handleNum(n)} disabled={!inputEnabled} />
            ))}
            {/* Ghost (empty) */}
            <div />
            <OtpNumBtn label="0" sub="" onClick={() => handleNum("0")} disabled={!inputEnabled} />
            {/* Delete */}
            <button
              onClick={() => handleDel()}
              disabled={!inputEnabled}
              style={{ ...numBtnStyle, opacity: !inputEnabled ? 0.3 : 1, cursor: !inputEnabled ? "not-allowed" : "pointer" }}
              onMouseEnter={e => { if (inputEnabled) e.currentTarget.style.background = "rgba(255,255,255,0.09)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
              onMouseDown={e => { if (inputEnabled) e.currentTarget.style.transform = "scale(0.93)" }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            </button>
          </div>

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={otp.length < 6 || !inputEnabled}
            style={{
              width: "100%", padding: 16, marginTop: 12,
              background: otp.length === 6 && inputEnabled ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.08)",
              color: otp.length === 6 && inputEnabled ? "#0c0c0e" : "rgba(255,255,255,0.2)",
              border: "none", borderRadius: 12,
              fontSize: 13, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase",
              fontFamily: "Inter, sans-serif",
              cursor: otp.length < 6 || !inputEnabled ? "not-allowed" : "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => { if (otp.length === 6 && inputEnabled) e.currentTarget.style.background = "#fff" }}
            onMouseLeave={e => { if (otp.length === 6 && inputEnabled) e.currentTarget.style.background = "rgba(255,255,255,0.92)" }}
          >
            {verifying ? "Verifying..." : "Verify & Print"}
          </button>
        </div>
      </div>

      {/* ── BOTTOM SHEET ─────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: sheetOpen ? 0 : "-55%", left: 0, width: "100%", height: "44vh",
        background: "rgba(10,10,14,0.97)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        boxShadow: "0 -12px 60px rgba(0,0,0,0.6)",
        transition: "bottom 0.5s cubic-bezier(0.19,1,0.22,1)",
        zIndex: 100,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "0 32px", backdropFilter: "blur(20px)"
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 2, position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)" }} />

        {/* Spinner */}
        {sheetSpinner && (
          <div style={{ border: "3px solid rgba(255,255,255,0.07)", borderTop: "3px solid rgba(255,255,255,0.6)", borderRadius: "50%", width: 40, height: 40, animation: "spin 0.8s linear infinite", marginBottom: 18 }} />
        )}

        {/* Printing icon */}
        {sheetPrinting && (
          <div style={{ marginBottom: 16 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </div>
        )}

        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6, textAlign: "center" }}>{sheetTitle}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>{sheetSubtitle}</div>

        {sheetProgressVisible && (
          <div style={{ width: "70%", height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginTop: 22, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "rgba(255,255,255,0.7)", width: sheetProgress + "%", transition: "width 0.3s ease", borderRadius: 2 }} />
          </div>
        )}
      </div>

      {/* ── SUCCESS OVERLAY ───────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", inset: 0, background: "#0c0c0e", zIndex: 200,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: "#fff",
        opacity: successVisible ? 1 : 0,
        pointerEvents: successVisible ? "all" : "none",
        transition: "opacity 0.5s ease"
      }}>
        <div style={{ width: 76, height: 76, border: "2px solid rgba(255,255,255,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, animation: successVisible ? "popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275)" : "none" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Printing Complete</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }}>Please collect your documents</div>
        <div style={{ marginTop: 32, fontSize: 13, color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)", padding: "6px 18px", borderRadius: 20 }}>
          Closing in {countdown}s
        </div>
      </div>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const numBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  color: "#fff",
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  padding: "16px 8px",
  cursor: "pointer",
  userSelect: "none",
  fontFamily: "Inter, sans-serif",
  transition: "background 0.12s, transform 0.1s, border-color 0.12s"
}

function OtpNumBtn({ label, sub, onClick, disabled }: { label: string; sub: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...numBtnStyle, opacity: disabled ? 0.3 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)" } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)" } }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = "scale(0.93)" }}
      onMouseUp={e => { e.currentTarget.style.transform = "scale(1)" }}
    >
      <div style={{ fontSize: 22, fontWeight: 500, color: "#fff", lineHeight: 1 }}>{label}</div>
      {sub && <div style={{ fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", fontWeight: 600, marginTop: 2 }}>{sub}</div>}
    </button>
  )
}

function PasskeyNumBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={numBtnStyle}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)" }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
      onMouseDown={e => e.currentTarget.style.transform = "scale(0.93)"}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <div style={{ fontSize: 22, fontWeight: 500, color: "#fff" }}>{label}</div>
    </button>
  )
}

function HoverButton({ label, onClick, hoverColor }: { label: string; onClick: () => void; hoverColor: string }) {
  return (
    <button
      onClick={onClick}
      style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", padding: "6px 12px", transition: "all 0.2s", fontFamily: "Inter, sans-serif" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = hoverColor; e.currentTarget.style.color = hoverColor }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)" }}
    >
      {label}
    </button>
  )
}

function ArtCard({ num, big, label, tint, bord }: { num: string; big: string; label: string; tint: string; bord: string }) {
  return (
    <div
      style={{ border: `1px solid ${bord}`, background: tint, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden", borderRadius: 18, transition: "border-color 0.3s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = bord }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>{num}</span>
      <div>
        <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, color: "rgba(255,255,255,0.06)", letterSpacing: -4, alignSelf: "flex-end" }}>{big}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, whiteSpace: "pre-line" }}>{label}</div>
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <Suspense fallback={<div style={{ height: "100vh", background: "#0c0c0e", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>Loading...</div>}>
      <MainUI />
    </Suspense>
  )
}