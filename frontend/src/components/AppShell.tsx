"use client";

import { usePathname } from "next/navigation";
import NavLink from "@/components/NavLink";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLanding = pathname === "/";

    if (isLanding) return <>{children}</>;

    return (
        <>
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
                        <NavLink href="/alerts/clusters" label="Clusters" />
                        <NavLink href="/cases" label="Cases" />
                        <NavLink href="/entities" label="Entity search" />
                        <NavLink href="/graph" label="Graph explorer" />
                        <NavLink href="/ingest" label="Ingest (dev)" />
                    </div>
                </div>
            </div>

            <div className="container">{children}</div>
        </>
    );
}
