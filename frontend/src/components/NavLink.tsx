"use client";

import { usePathname } from "next/navigation";

export default function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));
  return (
    <a className={`navLink ${active ? "navLinkActive" : ""}`} href={href}>
      {label}
    </a>
  );
}