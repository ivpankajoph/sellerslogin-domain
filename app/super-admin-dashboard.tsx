"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Bell,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  CircleCheck,
  Clock3,
  Database,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageCheck,
  Settings,
  ShoppingCart,
  Sun,
  Tags,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { domainApi } from "@/lib/domain-api";
import { AdminSectionPage } from "./admin-section-pages";

type SuperAdminDashboardProps = {
  adminUrl: string;
  darkMode: boolean;
  email: string;
  name: string;
  token: string;
  onSignOut: () => void;
  onToggleTheme: () => void;
};

type ProviderStatus = {
  configured: boolean;
  environment?: string;
  currencyCompatible?: boolean;
  resellerAutoRenewSafetyAcknowledged?: boolean;
  balance?: { usdBalance?: number } | null;
  latestStoredBalance?: { usdBalance?: number; checkedAt?: string } | null;
  lowBalanceThresholdUsd?: number;
  pendingFinancialConfirmations?: number;
  financialReviewCount?: number;
  unreadAdminNotifications?: number;
};

type DashboardData = {
  domains: { total: number; active: number; expiringSoon: number; vendors: number; providerAutoRenew: number };
  provider: ProviderStatus;
};

type DomainOrder = {
  orderId: string;
  domainName: string;
  vendorId: string;
  vendorName?: string;
  vendorEmail?: string;
  operation: string;
  amount: number;
  currency: string;
  status: string;
};

const adminNavigation = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Vendors", href: "/admin/vendors", icon: Users },
  { label: "Domains", href: "/admin/domains", icon: Globe2 },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Pricing", href: "/admin/pricing", icon: Tags },
  { label: "Operations", href: "/admin/operations/catalogue", icon: Database },
  { label: "Reports", href: "/admin/reports", icon: ChartNoAxesCombined },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const operationsNavigation = [
  { label: "Domain catalogue", href: "/admin/operations/catalogue" },
  { label: "Credit activity", href: "/admin/operations/wallet-ledger" },
  { label: "Search activity", href: "/admin/operations/search-activity" },
  { label: "Audit log", href: "/admin/operations/audit-logs" },
];

const reportsNavigation = [
  { label: "Report summary", href: "/admin/reports" },
  { label: "Sales & profit", href: "/admin/reports/sales-profit" },
  { label: "Domain performance", href: "/admin/reports/domain-performance" },
  { label: "Vendor performance", href: "/admin/reports/vendor-performance" },
  { label: "Provider charges", href: "/admin/reports/provider-charges" },
  { label: "Failed & pending orders", href: "/admin/reports/order-issues" },
];

const pricingNavigation = [
  { label: "Pricing overview", href: "/admin/pricing" },
  { label: "Domain prices", href: "/admin/pricing/domains" },
  { label: "Special pricing rules", href: "/admin/pricing/rules" },
  { label: "Offers & discounts", href: "/admin/pricing/offers" },
];

export function SuperAdminDashboard({
  adminUrl,
  darkMode,
  email,
  name,
  token,
  onSignOut,
  onToggleTheme,
}: SuperAdminDashboardProps) {
  const pathname = usePathname();
  const pricingPathActive = pathname.startsWith("/admin/pricing");
  const operationsPathActive = pathname.startsWith("/admin/operations");
  const reportsPathActive = pathname.startsWith("/admin/reports");
  const activeItem = pathname === "/admin/notifications" ? "Notifications"
    : pricingPathActive ? "Pricing"
      : operationsPathActive ? "Operations"
        : adminNavigation.find((item) => item.href !== "/admin" && pathname.startsWith(item.href))?.label
          || adminNavigation.find((item) => item.href === pathname)?.label
    || (pathname === "/" ? "Overview" : "Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pricingMenuOpen, setPricingMenuOpen] = useState(false);
  const [operationsMenuOpen, setOperationsMenuOpen] = useState(false);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recentOrders, setRecentOrders] = useState<DomainOrder[]>([]);
  const [pendingOrders, setPendingOrders] = useState<number | null>(null);
  const [reconciliationOrders, setReconciliationOrders] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "SA";

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const read = <T,>(path: string) => domainApi<T>(token, path, { signal: controller.signal });

    setLoading(true);
    setLoadError("");
    Promise.allSettled([
      read<DashboardData>("/v1/admin/domain/dashboard"),
      read<{ items: DomainOrder[] }>("/v1/admin/domain/orders?page=1&limit=5"),
      read<{ total: number }>("/v1/admin/domain/orders?page=1&limit=1&status=PROVIDER_PENDING"),
      read<{ total: number }>("/v1/admin/domain/orders?page=1&limit=1&status=RECONCILIATION_REQUIRED"),
    ])
      .then(([dashboardResult, ordersResult, pendingResult, reconciliationResult]) => {
        if (!active) return;
        if (dashboardResult.status === "fulfilled") setDashboard(dashboardResult.value);
        if (ordersResult.status === "fulfilled") setRecentOrders(Array.isArray(ordersResult.value?.items) ? ordersResult.value.items : []);
        const providerPending = pendingResult.status === "fulfilled" ? Number(pendingResult.value.total || 0) : 0;
        const reconciliation = reconciliationResult.status === "fulfilled" ? Number(reconciliationResult.value.total || 0) : 0;
        if (pendingResult.status === "fulfilled" || reconciliationResult.status === "fulfilled") setPendingOrders(providerPending + reconciliation);
        if (reconciliationResult.status === "fulfilled") setReconciliationOrders(reconciliation);
        if (dashboardResult.status === "fulfilled") {
          setLoadError("");
        } else if ([dashboardResult, ordersResult, pendingResult, reconciliationResult].every((result) => result.status === "rejected")) {
          setLoadError("Live administration data is temporarily unavailable.");
        }
      })
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token]);

  useEffect(() => {
    const updateUnread = (event: Event) => {
      const unread = Number((event as CustomEvent<{ unread: number }>).detail?.unread);
      if (!Number.isFinite(unread)) return;
      setDashboard((current) => current ? { ...current, provider: { ...current.provider, unreadAdminNotifications: Math.max(0, unread) } } : current);
    };
    window.addEventListener("domain-admin-notifications-changed", updateUnread);
    return () => window.removeEventListener("domain-admin-notifications-changed", updateUnread);
  }, []);

  const summaryCards = useMemo(() => [
    { label: "Total domains", value: dashboard?.domains.total, description: "Across all vendor accounts", icon: Globe2 },
    { label: "Vendors", value: dashboard?.domains.vendors, description: "Using the domain service", icon: Building2 },
    { label: "Expiring soon", value: dashboard?.domains.expiringSoon, description: "Within the next 60 days", icon: Clock3 },
    { label: "Pending orders", value: pendingOrders, description: "Need processing or reconciliation", icon: PackageCheck },
  ], [dashboard, pendingOrders]);

  const attentionItems = useMemo(() => {
    const items: Array<{ title: string; detail: string; icon: LucideIcon; badge: string }> = [];
    if (loading || loadError) return items;
    if (!dashboard?.provider.configured) {
      items.push({ title: "Domain service not configured", detail: "Add the required backend credentials before enabling domain operations.", icon: TriangleAlert, badge: "Required" });
    }
    if (dashboard?.provider.configured && dashboard.provider.currencyCompatible === false) {
      items.push({ title: "INR pricing unavailable", detail: "Configure live currency conversion before enabling purchases.", icon: TriangleAlert, badge: "Blocked" });
    }
    if (dashboard?.provider.environment === "production" && !dashboard.provider.resellerAutoRenewSafetyAcknowledged) {
      items.push({ title: "Auto-renew safety not confirmed", detail: "Confirm the renewal policy before enabling production purchases.", icon: TriangleAlert, badge: "Required" });
    }
    if (dashboard?.domains.providerAutoRenew) {
      items.push({ title: "Provider auto-renew domains detected", detail: `${dashboard.domains.providerAutoRenew} synced domain${dashboard.domains.providerAutoRenew === 1 ? " is" : "s are"} still set to AutoRenew. Change them to AutoExpire in the reseller panel to prevent automatic balance deductions.`, icon: TriangleAlert, badge: String(dashboard.domains.providerAutoRenew) });
    }
    if (reconciliationOrders) {
      items.push({ title: "Orders require reconciliation", detail: `${reconciliationOrders} domain operation${reconciliationOrders === 1 ? "" : "s"} need admin review.`, icon: Activity, badge: String(reconciliationOrders) });
    }
    if (dashboard?.provider.pendingFinancialConfirmations) {
      items.push({ title: "Provider charges awaiting confirmation", detail: `${dashboard.provider.pendingFinancialConfirmations} completed order${dashboard.provider.pendingFinancialConfirmations === 1 ? " is" : "s are"} waiting for a matching provider debit.`, icon: Clock3, badge: String(dashboard.provider.pendingFinancialConfirmations) });
    }
    if (dashboard?.provider.financialReviewCount) {
      items.push({ title: "Provider charges need review", detail: `${dashboard.provider.financialReviewCount} charge record${dashboard.provider.financialReviewCount === 1 ? " has" : "s have"} a mismatch or could not be matched safely.`, icon: TriangleAlert, badge: String(dashboard.provider.financialReviewCount) });
    }
    const usdBalance = dashboard?.provider.balance?.usdBalance ?? dashboard?.provider.latestStoredBalance?.usdBalance;
    const lowBalanceThreshold = dashboard?.provider.lowBalanceThresholdUsd;
    if (usdBalance != null && lowBalanceThreshold != null && Number(usdBalance) < Number(lowBalanceThreshold)) {
      items.push({ title: "Provider balance is low", detail: `The available provider balance is $${Number(usdBalance).toFixed(2)}. Add funds before paid domain operations are affected.`, icon: TriangleAlert, badge: "Low" });
    }
    return items;
  }, [dashboard, reconciliationOrders, loading, loadError]);

  const serviceLabel = loadError
    ? "API status unavailable"
    : dashboard?.provider.configured
      ? "API configured"
      : "API not configured";

  const formatAmount = (order: DomainOrder) => {
    if (!Number.isFinite(Number(order.amount)) || !order.currency) return "—";
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: order.currency }).format(Number(order.amount));
    } catch {
      return `${order.amount} ${order.currency}`;
    }
  };

  return (
    <div className={cn("min-h-screen bg-muted/30", darkMode && "dark")}>
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r bg-background transition-transform lg:translate-x-0",
          sidebarOpen && "translate-x-0",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Globe2 className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">SellersLogin</p>
              <p className="text-xs text-muted-foreground">Domain Admin</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X />
          </Button>
        </div>

        <div className="p-3">
          <Button asChild variant="outline" className="w-full justify-start">
            <a href={adminUrl}><ArrowLeft />Go to Main Dashboard</a>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">DOMAIN ADMIN</p>
          <nav className="space-y-1">
            {adminNavigation.map((item) => item.label === "Pricing" ? (
              <div key={item.label}>
                <Button
                  type="button"
                  variant={pricingPathActive ? "secondary" : "ghost"}
                  className={cn("w-full justify-start", pricingPathActive && "bg-primary/20")}
                  onClick={() => setPricingMenuOpen((value) => !value)}
                  aria-expanded={pricingMenuOpen || pricingPathActive}
                >
                  <item.icon />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={cn("transition-transform", (pricingMenuOpen || pricingPathActive) && "rotate-180")} />
                </Button>
                {(pricingMenuOpen || pricingPathActive) && <div className="mt-1 space-y-1 border-l pl-4 ml-4">{pricingNavigation.map((child) => (
                  <Button key={child.href} asChild variant={pathname === child.href ? "secondary" : "ghost"} size="sm" className={cn("w-full justify-start", pathname === child.href && "bg-primary/15")}>
                    <Link href={child.href} onClick={() => setSidebarOpen(false)}>{child.label}</Link>
                  </Button>
                ))}</div>}
              </div>
            ) : item.label === "Operations" ? (
              <div key={item.label}>
                <Button type="button" variant={operationsPathActive ? "secondary" : "ghost"} className={cn("w-full justify-start", operationsPathActive && "bg-primary/20")} onClick={() => setOperationsMenuOpen((value) => !value)} aria-expanded={operationsMenuOpen || operationsPathActive}>
                  <item.icon /><span className="flex-1 text-left">{item.label}</span><ChevronDown className={cn("transition-transform", (operationsMenuOpen || operationsPathActive) && "rotate-180")} />
                </Button>
                {(operationsMenuOpen || operationsPathActive) && <div className="mt-1 ml-4 space-y-1 border-l pl-4">{operationsNavigation.map((child) => <Button key={child.href} asChild variant={pathname === child.href ? "secondary" : "ghost"} size="sm" className={cn("w-full justify-start", pathname === child.href && "bg-primary/15")}><Link href={child.href} onClick={() => setSidebarOpen(false)}>{child.label}</Link></Button>)}</div>}
              </div>
            ) : item.label === "Reports" ? (
              <div key={item.label}>
                <Button type="button" variant={reportsPathActive ? "secondary" : "ghost"} className={cn("w-full justify-start", reportsPathActive && "bg-primary/20")} onClick={() => setReportsMenuOpen((value) => !value)} aria-expanded={reportsMenuOpen || reportsPathActive}>
                  <item.icon /><span className="flex-1 text-left">{item.label}</span><ChevronDown className={cn("transition-transform", (reportsMenuOpen || reportsPathActive) && "rotate-180")} />
                </Button>
                {(reportsMenuOpen || reportsPathActive) && <div className="mt-1 ml-4 space-y-1 border-l pl-4">{reportsNavigation.map((child) => <Button key={child.href} asChild variant={pathname === child.href ? "secondary" : "ghost"} size="sm" className={cn("w-full justify-start", pathname === child.href && "bg-primary/15")}><Link href={child.href} onClick={() => setSidebarOpen(false)}>{child.label}</Link></Button>)}</div>}
              </div>
            ) : (
              <Button
                key={item.label}
                asChild
                variant={activeItem === item.label ? "secondary" : "ghost"}
                className={cn("w-full justify-start", activeItem === item.label && "bg-primary/20")}
              >
                <Link href={item.href} onClick={() => setSidebarOpen(false)}>
                  <item.icon />
                  <span className="flex-1 text-left">{item.label}</span>
                </Link>
              </Button>
            ))}
          </nav>
        </div>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            {dashboard?.provider.configured && !loadError
              ? <CircleCheck className="size-4 text-primary" />
              : <TriangleAlert className="size-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">{loading ? "Checking service..." : serviceLabel}</p>
              <p className="text-xs text-muted-foreground">SellersLogin Domains</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu />
            </Button>
            <div>
              <p className="text-xs text-muted-foreground">Domain Administration</p>
              <h1 className="font-semibold">{activeItem}</h1>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <Badge variant="outline" className="hidden gap-2 sm:flex">
              {dashboard?.provider.configured && !loadError
                ? <CircleCheck className="size-3.5" />
                : <TriangleAlert className="size-3.5" />}
              {loading ? "Checking service..." : serviceLabel}
            </Badge>
            <Button variant="ghost" size="icon" onClick={onToggleTheme}>
              {darkMode ? <Sun /> : <Moon />}
            </Button>
            <Button asChild variant="ghost" size="icon" className="relative"><Link href="/admin/notifications" aria-label="Domain notifications"><Bell />{dashboard?.provider.unreadAdminNotifications ? <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">{Math.min(dashboard.provider.unreadAdminNotifications, 9)}</span> : null}</Link></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">{initials}</span>
                  <span className="hidden max-w-40 truncate sm:inline">{name}</span>
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <p>{name}</p>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">{email || "SellersLogin super admin"}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onSignOut}><LogOut />Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {activeItem === "Overview" ? (
          <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Domain business overview</h2>
                <p className="text-sm text-muted-foreground">Monitor vendor activity, domain operations and revenue from one place.</p>
              </div>
            </div>

            {loadError && (
              <p className="text-sm text-muted-foreground">{loadError}</p>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => (
                <Card key={item.label}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
                    <item.icon className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{loading || item.value == null ? "—" : item.value.toLocaleString("en-IN")}</div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Recent domain orders</CardTitle>
                  <CardDescription>Latest purchases and renewals across all vendors.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-2xl text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium">Domain</th>
                        <th className="pb-3 font-medium">Vendor</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Amount</th>
                        <th className="pb-3 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.orderId} className="border-b last:border-0">
                          <td className="py-4 font-medium">{order.domainName}</td>
                          <td className="py-4"><p className="font-medium">{order.vendorName || "Vendor"}</p><p className="text-xs text-muted-foreground">{order.vendorEmail || "Email not available"}</p></td>
                          <td className="py-4">{order.operation}</td>
                          <td className="py-4">{formatAmount(order)}</td>
                          <td className="py-4 text-right">
                            <Badge variant={order.status === "COMPLETED" ? "secondary" : "outline"}>{order.status.replaceAll("_", " ")}</Badge>
                          </td>
                        </tr>
                      ))}
                      {!loading && recentOrders.length === 0 && (
                        <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No domain orders found.</td></tr>
                      )}
                      {loading && (
                        <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Loading domain orders...</td></tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Needs attention</CardTitle>
                  <CardDescription>Items that may require an admin action.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {attentionItems.map((item) => (
                    <div key={item.title} className="flex items-start gap-3 rounded-lg border p-3">
                      <item.icon className="mt-0.5 size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <Badge variant="outline">{item.badge}</Badge>
                    </div>
                  ))}
                  {!loading && attentionItems.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No items currently need attention.</p>
                  )}
                  {loading && <p className="py-8 text-center text-sm text-muted-foreground">Checking system status...</p>}
                </CardContent>
              </Card>
            </section>
          </main>
        ) : (
          <main className="mx-auto max-w-7xl p-4 md:p-6">
            <AdminSectionPage section={activeItem as "Vendors" | "Domains" | "Orders" | "Pricing" | "Reports" | "Settings" | "Operations" | "Notifications"} token={token} />
          </main>
        )}
      </div>
    </div>
  );
}
