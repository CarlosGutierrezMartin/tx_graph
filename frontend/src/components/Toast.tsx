"use client";

import { useEffect } from "react";

export type ToastTone = "success" | "error" | "info";

export default function Toast({
  open,
  message,
  tone = "info",
  onClose,
  durationMs = 2600,
}: {
  open: boolean;
  message: string;
  tone?: ToastTone;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  const toneStyle =
    tone === "success"
      ? { borderColor: "rgba(191,255,55,.35)", background: "rgba(191,255,55,.08)" }
      : tone === "error"
      ? { borderColor: "rgba(225,42,45,.45)", background: "rgba(225,42,45,.10)" }
      : { borderColor: "rgba(111,160,255,.35)", background: "rgba(111,160,255,.08)" };

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        right: 18,
        zIndex: 9999,
        maxWidth: 420,
      }}
      onClick={onClose}
    >
      <div
        className="card cardTight"
        style={{
          boxShadow: "0 16px 44px rgba(0,0,0,.55)",
          cursor: "pointer",
          ...toneStyle,
        }}
      >
        <div className="row" style={{ justifyContent: "space-between" }}>
          <b style={{ textTransform: "capitalize" }}>{tone}</b>
          <span className="pill">click to close</span>
        </div>
        <div style={{ marginTop: 8, fontWeight: 650 }}>{message}</div>
      </div>
    </div>
  );
}