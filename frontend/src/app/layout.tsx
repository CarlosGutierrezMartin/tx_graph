import "./globals.css";
import { aeonik } from "./fonts";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "Transaction Intelligence Graph — Rev-celerator",
  description:
    "Full-stack operations console for financial transaction monitoring, alert triage, AI-assisted investigations, and graph-based entity analysis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={aeonik.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}