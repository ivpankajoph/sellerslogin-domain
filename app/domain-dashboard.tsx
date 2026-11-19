"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bell, ChevronDown, CircleUserRound, CreditCard, FileClock, Globe2, House, LogOut, Menu, Moon, Network, RefreshCcw, Search, ShieldCheck, Sun, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VendorPageHeading, VendorWorkspacePreview } from "@/components/vendor-page-ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { domainApi } from "@/lib/domain-api";
import { getDomainSessionRole, getVendorName, readDomainSession, writeDomainSession, type DomainSession } from "@/lib/domain-session";
import { SuperAdminDashboard } from "./super-admin-dashboard";
import { SearchAndBuy, VendorOverview } from "./vendor-domain-pages";
import { DocumentsAndVerification, DomainForwarding, NameserversAndDnssec, VendorNotifications } from "./vendor-management-pages";
import { OptimizedContacts, OptimizedDnsRecords, OptimizedDomainDetail, OptimizedMyDomains, OptimizedOrdersAndBilling, OptimizedRenewals, OptimizedTransfers, VendorCreditActivity, VendorOrderDetails } from "./vendor-optimized-pages";

const adminUrl = String(process.env.NEXT_PUBLIC_ADMIN_URL || (process.env.NODE_ENV === "production" ? "https://demo.sellerslogin.com" : "http://localhost:5173")).replace(/\/$/, "");

const navigation = [
  { group: "OVERVIEW", label: "Domain Dashboard", href: "/", icon: House },
  { group: "DOMAINS", label: "Search & Buy Domain", href: "/search", icon: Search },
  { group: "DOMAINS", label: "My Domains", href: "/domains", icon: Globe2 },
  { group: "DOMAINS", label: "Domain Transfers", href: "/transfers", icon: RefreshCcw },
  { group: "DOMAINS", label: "Renewals", href: "/renewals", icon: FileClock },
  { group: "MANAGE DOMAINS", label: "DNS Records", href: "/dns", icon: Network },
  { group: "MANAGE DOMAINS", label: "Nameservers & Security", href: "/nameservers", icon: ShieldCheck },
  { group: "MANAGE DOMAINS", label: "Domain Forwarding", href: "/forwarding", icon: ArrowRight },
  { group: "MANAGE DOMAINS", label: "Contacts", href: "/contacts", icon: CircleUserRound },
  { group: "MANAGE DOMAINS", label: "Documents & Verification", href: "/documents", icon: FileClock },
  { group: "BILLING & ACTIVITY", label: "Orders & Billing", href: "/orders", icon: CreditCard },
  { group: "BILLING & ACTIVITY", label: "Credit Activity", href: "/credit-activity", icon: WalletCards },
];

const isActive = (pathname: string, href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

function VendorPage({ pathname, token }: { pathname: string; token: string }) {
  if (pathname === "/search") return <SearchAndBuy token={token} />;
  if (pathname === "/domains") return <OptimizedMyDomains token={token} />;
  if (pathname.startsWith("/domains/")) return <OptimizedDomainDetail token={token} domainName={decodeURIComponent(pathname.slice("/domains/".length))} />;
  if (pathname === "/transfers") return <OptimizedTransfers token={token} />;
  if (pathname === "/renewals") return <OptimizedRenewals token={token} />;
  if (pathname === "/dns") return <OptimizedDnsRecords token={token} />;
  if (pathname.startsWith("/dns/")) return <OptimizedDnsRecords token={token} domainName={decodeURIComponent(pathname.slice("/dns/".length))} />;
  if (pathname === "/contacts") return <OptimizedContacts token={token} />;
  if (pathname === "/orders") return <OptimizedOrdersAndBilling token={token} />;
  if (pathname.startsWith("/orders/")) return <VendorOrderDetails token={token} orderId={decodeURIComponent(pathname.slice("/orders/".length))} />;
  if (pathname === "/credit-activity") return <VendorCreditActivity token={token} />;
  if (pathname === "/nameservers") return <NameserversAndDnssec token={token} />;
  if (pathname === "/forwarding") return <DomainForwarding token={token} />;
  if (pathname === "/documents") return <DocumentsAndVerification token={token} />;
  if (pathname === "/notifications") return <VendorNotifications token={token} />;
  return <VendorOverview token={token} />;
}

const previewPages = {
  "/domains": { page: "domains", title: "My Domains", description: "View every domain in your account and open the settings you want to manage." },
  "/dns": { page: "dns", title: "DNS Records", description: "Connect your website, email and verification services to a domain." },
  "/nameservers": { page: "nameservers", title: "Nameservers & Domain Security", description: "Choose where your domain connects and manage advanced security when needed." },
  "/forwarding": { page: "forwarding", title: "Domain Forwarding", description: "Send visitors from one domain to another website." },
  "/contacts": { page: "contacts", title: "Domain Contacts", description: "Review domain owner details and complete contact verification." },
  "/documents": { page: "documents", title: "Documents & Verification", description: "Upload documents when a domain requires verification and follow the review status." },
  "/renewals": { page: "renewals", title: "Renewals", description: "Check expiry dates, see the latest renewal price and keep domains active." },
  "/orders": { page: "orders", title: "Orders & Billing", description: "Review purchases, renewals, transfers and their payment status." },
  "/credit-activity": { page: "credits", title: "Credit Activity", description: "See credits reserved, used or returned for domain orders." },
  "/notifications": { page: "notifications", title: "Notifications", description: "See domain updates that need your attention." },
} as const;

function EmptyAccountPreview({ pathname }: { pathname: string }) {
  const config = previewPages[pathname as keyof typeof previewPages];
  if (!config) return null;
  return <div className="space-y-6"><VendorPageHeading title={config.title} description={config.description} /><VendorWorkspacePreview page={config.page} /></div>;
}

function DomainDashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<DomainSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [ownedDomainCount, setOwnedDomainCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [creditEntryCount, setCreditEntryCount] = useState<number | null>(null);
  const [notificationCount, setNotificationCount] = useState<number | null>(null);

  useEffect(() => {
    const currentSession = readDomainSession();
    if (!currentSession) { router.replace("/login"); return; }
    let active = true;
    const savedDarkMode = window.localStorage.getItem("sellerslogin-domain-theme") === "dark";
    queueMicrotask(() => {
      if (!active) return;
      setSession(currentSession);
      setAuthReady(true);
      setDarkMode(savedDarkMode);
    });
    return () => { active = false; };
  }, [router]);

  useEffect(() => { if (authReady) window.localStorage.setItem("sellerslogin-domain-theme", darkMode ? "dark" : "light"); }, [authReady, darkMode]);

  const role = getDomainSessionRole(session);
  useEffect(() => {
    if (authReady && session && role !== "admin" && role !== "superadmin" && pathname.startsWith("/admin")) {
      router.replace("/");
    }
  }, [authReady, pathname, role, router, session]);
  useEffect(() => {
    if (!session?.token || role === "admin" || role === "superadmin") return;
    let active = true;
    domainApi<{ availableCredits: number }>(session.token, "/v1/domain/wallet").then((wallet) => { if (active) setWalletBalance(Number(wallet.availableCredits || 0)); }).catch(() => { if (active) setWalletBalance(null); });
    domainApi<{ unread: number; total: number }>(session.token, "/v1/domain/notifications?page=1&limit=1&unreadOnly=false").then((value) => { if (active) { setUnreadNotifications(Number(value.unread || 0)); setNotificationCount(Number(value.total || 0)); } }).catch(() => { if (active) { setUnreadNotifications(0); setNotificationCount(null); } });
    domainApi<{ total: number }>(session.token, "/v1/domain/dashboard").then((value) => { if (active) setOwnedDomainCount(Number(value.total || 0)); }).catch(() => { if (active) setOwnedDomainCount(null); });
    if (pathname === "/orders") domainApi<{ total: number }>(session.token, "/v1/domain/orders?page=1&limit=1").then((value) => { if (active) setOrderCount(Number(value.total || 0)); }).catch(() => { if (active) setOrderCount(null); });
    if (pathname === "/credit-activity") domainApi<{ total: number }>(session.token, "/v1/domain/wallet/ledger?page=1&limit=1").then((value) => { if (active) setCreditEntryCount(Number(value.total || 0)); }).catch(() => { if (active) setCreditEntryCount(null); });
    return () => { active = false; };
  }, [session?.token, role, pathname]);

  const signOut = () => { writeDomainSession(null); router.replace("/login"); };
  if (!authReady || !session) return <div className="min-h-screen bg-background" />;

  const vendorName = getVendorName(session.user);
  const vendorEmail = String(session.user?.email || "");
  const initials = vendorName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "V";

  if (role === "admin" || role === "superadmin") {
    return <SuperAdminDashboard adminUrl={adminUrl} darkMode={darkMode} email={vendorEmail} name={vendorName} token={session.token} onSignOut={signOut} onToggleTheme={() => setDarkMode((value) => !value)} />;
  }

  const current = pathname === "/notifications"
    ? { group: "BILLING & ACTIVITY", label: "Notifications", href: "/notifications", icon: Bell }
    : navigation.find((item) => isActive(pathname, item.href)) || navigation[0];
  const showEmptyPreview = Boolean(previewPages[pathname as keyof typeof previewPages]) && (
    pathname === "/orders" ? orderCount === 0
      : pathname === "/credit-activity" ? creditEntryCount === 0
        : pathname === "/notifications" ? notificationCount === 0
          : ownedDomainCount === 0
  );
  return <div className={cn("min-h-screen bg-muted/30", darkMode && "dark")}>
    {sidebarOpen && <button className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r bg-background transition-all lg:translate-x-0", sidebarOpen && "translate-x-0", sidebarCollapsed && "lg:w-16")}>
      <div className="flex h-16 items-center justify-between border-b px-4"><Link href="/" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Globe2 className="size-5" /></span>{!sidebarCollapsed && <span><span className="block text-sm font-semibold">SellersLogin</span><span className="block text-xs text-muted-foreground">Domain</span></span>}</Link><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}><X /></Button></div>
      <div className="p-3"><Button asChild variant="outline" className={cn("w-full justify-start", sidebarCollapsed && "lg:px-2")}><a href={adminUrl}><ArrowLeft />{!sidebarCollapsed && "Go to Main Dashboard"}</a></Button></div>
      <div className="flex-1 overflow-y-auto px-3 py-2"><nav className="space-y-1">{navigation.map((item, index) => <div key={item.href}>{!sidebarCollapsed && (index === 0 || navigation[index - 1].group !== item.group) && <p className="mb-2 mt-4 px-2 text-xs font-medium text-muted-foreground first:mt-0">{item.group}</p>}<Button asChild variant={isActive(pathname, item.href) ? "secondary" : "ghost"} className={cn("w-full justify-start", isActive(pathname, item.href) && "bg-primary/20", sidebarCollapsed && "lg:px-2")}><Link href={item.href} onClick={() => setSidebarOpen(false)}><item.icon />{!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}</Link></Button></div>)}</nav></div>
      <div className="border-t p-3"><Button variant="ghost" className="w-full" onClick={() => setSidebarCollapsed((value) => !value)}><ArrowLeft className={cn(sidebarCollapsed && "rotate-180")} />{!sidebarCollapsed && "Collapse sidebar"}</Button></div>
    </aside>
    <div className={cn("min-h-screen lg:pl-64", sidebarCollapsed && "lg:pl-16")}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6"><div className="flex items-center gap-3"><Button variant="outline" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu /></Button><div><p className="text-xs text-muted-foreground">Domain Workspace</p><h1 className="font-semibold">{current.label}</h1></div></div><div className="flex items-center gap-1 md:gap-2"><Button asChild variant="outline" className="hidden sm:inline-flex"><a href={`${adminUrl}/credits`}><WalletCards />{walletBalance == null ? "Credits" : `${walletBalance.toLocaleString("en-IN")} credits`}</a></Button><Button variant="ghost" size="icon" onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun /> : <Moon />}</Button><Button asChild variant="ghost" size="icon" className="relative"><Link href="/notifications" aria-label={unreadNotifications ? `${unreadNotifications} unread notifications` : "Notifications"}><Bell />{unreadNotifications > 0 && <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 text-white">{Math.min(unreadNotifications, 99)}</span>}</Link></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">{initials}</span><span className="hidden max-w-40 truncate sm:inline">{vendorName}</span><ChevronDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64"><DropdownMenuLabel><p>{vendorName}</p><p className="mt-1 text-xs font-normal text-muted-foreground">{vendorEmail || "SellersLogin vendor account"}</p></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={signOut}><LogOut />Log out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">{showEmptyPreview ? <EmptyAccountPreview pathname={pathname} /> : <VendorPage pathname={pathname} token={session.token} />}</main>
    </div>
  </div>;
}

export function DomainDashboard() {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}><DomainDashboardContent /></Suspense>;
}
