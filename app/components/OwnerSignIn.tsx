"use client"

export default function OwnerSignIn({ kioskId, onExit }: { kioskId: string; onExit: () => void }) {
  const finalKioskId = kioskId && kioskId !== "null" ? kioskId : "america"
  const url = `https://innveraui.vercel.app/dashboard/owner?kiosk_id=${finalKioskId}`

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        fontFamily: '"Inter", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 56,
          background: "#050505",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              fontSize: "1rem",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              color: "#ff6b47",
            }}
          >
            INNVERA
          </span>
          <span
            style={{
              fontSize: "0.55rem",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Owner Dashboard — {finalKioskId}
          </span>
        </div>
        <button
          onClick={onExit}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.6)",
            padding: "6px 14px",
            cursor: "pointer",
            fontFamily: '"Inter", sans-serif',
            fontSize: "0.6rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
          }}
        >
          Close
        </button>
      </div>

      {/* Full Frame */}
      <iframe
        src={url}
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          background: "#000",
        }}
        title={`Owner Dashboard — ${finalKioskId}`}
      />
    </div>
  )
}
