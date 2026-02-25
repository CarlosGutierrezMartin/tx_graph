import "./globals.css";
import { aeonik } from "./fonts";
import NavLink from "@/components/NavLink";

export const metadata = { title: "Ops Console Prototype" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={aeonik.variable}>
      <body>
        <div className="nav">
          <div className="navInner">
            <div className="brand">
              <div className="brandMark" />
              <div>
                <div className="brandTitle">Ops console</div>
                <div className="brandSub">Alerts · Investigations · Graph · Cases</div>
              </div>
            </div>

            <div className="navLinks">
              <NavLink href="/alerts" label="Alerts" />
              <NavLink href="/cases" label="Cases" />
              <NavLink href="/entities" label="Entity search" />
              <NavLink href="/graph" label="Graph explorer" />
              <NavLink href="/ingest" label="Ingest (dev)" />
            </div>
          </div>
        </div>

        <div className="container">{children}</div>
      </body>
    </html>
  );
}