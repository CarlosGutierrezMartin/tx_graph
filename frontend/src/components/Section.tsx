export default function Section({
  title,
  right,
  children,
  tight,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <div className={`card ${tight ? "cardTight" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 className="hTitle">{title}</h3>
        {right}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}
