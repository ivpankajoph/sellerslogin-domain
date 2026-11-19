"use client";

import { usePathname } from "next/navigation";
import { DomainDashboard } from "./domain-dashboard";

const workspaceRoutes = [
  "/admin",
  "/contacts",
  "/credit-activity",
  "/dns",
  "/documents",
  "/domains",
  "/forwarding",
  "/nameservers",
  "/notifications",
  "/orders",
  "/renewals",
  "/search",
  "/transfers",
];

const isWorkspaceRoute = (pathname: string) => pathname === "/" || workspaceRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

export function DomainAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return isWorkspaceRoute(pathname) ? <DomainDashboard /> : children;
}
