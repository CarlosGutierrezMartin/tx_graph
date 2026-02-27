"use client";

import { usePathname } from "next/navigation";

const NAV_ITEMS = [
    {
        href: "/alerts",
        label: "Alerts",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sidebarIcon">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
        ),
    },
    {
        href: "/alerts/clusters",
        label: "Clusters",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sidebarIcon">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
        ),
    },
    {
        href: "/cases",
        label: "Cases",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sidebarIcon">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        ),
    },
    {
        href: "/entities",
        label: "Entity Search",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sidebarIcon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
        ),
    },
    {
        href: "/graph",
        label: "Graph Explorer",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sidebarIcon">
                <circle cx="12" cy="5" r="3" />
                <circle cx="5" cy="19" r="3" />
                <circle cx="19" cy="19" r="3" />
                <line x1="12" y1="8" x2="5" y2="16" />
                <line x1="12" y1="8" x2="19" y2="16" />
                <line x1="5" y1="19" x2="19" y2="19" />
            </svg>
        ),
    },
    {
        href: "/ingest",
        label: "Ingest",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sidebarIcon">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
        ),
    },
];

const PAGE_TITLES: Record<string, string> = {
    "/alerts": "Alerts",
    "/alerts/clusters": "Clusters",
    "/alerts/cluster": "Cluster Detail",
    "/cases": "Cases",
    "/entities": "Entity Search",
    "/graph": "Graph Explorer",
    "/ingest": "Ingest",
};

function getPageTitle(pathname: string): string {
    for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
        if (pathname === prefix || pathname.startsWith(prefix + "/")) return title;
    }
    // Dynamic routes
    if (pathname.startsWith("/alerts/")) return "Alert Detail";
    if (pathname.startsWith("/cases/")) return "Case Detail";
    return "Console";
}

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLanding = pathname === "/";

    if (isLanding) return <>{children}</>;

    const pageTitle = getPageTitle(pathname);

    return (
        <div className="shellWrap">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebarBrand">
                    <a href="/" className="sidebarBrandRow">
                        <div className="sidebarMark">R</div>
                        <div>
                            <div className="sidebarBrandName">Rev-celerator</div>
                            <div className="sidebarBrandSub">Ops Console</div>
                        </div>
                    </a>
                </div>

                <nav className="sidebarNav">
                    {NAV_ITEMS.map((item) => {
                        const active =
                            pathname === item.href ||
                            (item.href !== "/" && pathname?.startsWith(item.href + "/"));
                        // Special case: /alerts should not match /alerts/clusters or /alerts/cluster
                        const isExactAlertsMatch =
                            item.href === "/alerts" &&
                            (pathname === "/alerts" || pathname?.match(/^\/alerts\/\d/));
                        const isActive =
                            item.href === "/alerts" ? !!isExactAlertsMatch : active;

                        return (
                            <a
                                key={item.href}
                                href={item.href}
                                className={`sidebarLink ${isActive ? "sidebarLinkActive" : ""}`}
                            >
                                {item.icon}
                                <span className="sidebarLinkLabel">{item.label}</span>
                            </a>
                        );
                    })}
                </nav>

                <div className="sidebarFooter">
                    <div className="sidebarFooterText">
                        Rev-celerator · Portfolio Prototype
                    </div>
                </div>
            </aside>

            {/* Main content area */}
            <main className="mainArea">
                <div className="topbar">
                    <div className="topbarTitle">{pageTitle}</div>
                    <div className="topbarRight">
                        <a href="/" className="btn" style={{ fontSize: 12, padding: "6px 12px" }}>
                            ← Landing
                        </a>
                    </div>
                </div>
                <div className="container">{children}</div>
            </main>
        </div>
    );
}
