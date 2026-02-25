export default function SeverityPill({ severity }: { severity: string }) {
  const s = (severity || "").toLowerCase();
  const cls =
    s === "critical" ? "pill pillCritical" :
    s === "high" ? "pill pillHigh" :
    s === "medium" ? "pill pillMedium" :
    "pill";
  return <span className={cls}>{(severity || "low").toUpperCase()}</span>;
}