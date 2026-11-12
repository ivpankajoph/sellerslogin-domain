"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, ChevronDown, CircleUserRound, CreditCard, FileClock, Globe2, House, LogOut, Menu, Moon, Network, RefreshCcw, Search, Sun, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { domainApi } from "@/lib/domain-api";
import { getDomainSessionRole, getVendorName, readDomainSession, writeDomainSession, type DomainSession } from "@/lib/domain-session";
import { SuperAdminDashboard } from "./super-admin-dashboard";
import { Contacts, DnsRecords, DomainDetail, MyDomains, OrdersAndBilling, Renewals, SearchAndBuy, Transfers, VendorOverview } from "./vendor-domain-pages";

const adminUrl = String(process.env.NEXT_PUBLIC_ADMIN_URL || (process.env.NODE_ENV === "production" ? "https://demo.sellerslogin.com" : "http://localhost:5173")).replace(/\/$/, "");

const navigation = [
  { label: "Domain Dashboard", href: "/", icon: House },
  { label: "Search & Buy Domain", href: "/search", icon: Search },
  { label: "My Domains", href: "/domains", icon: Globe2 },
  { label: "Domain Transfers", href: "/transfers", icon: RefreshCcw },
  { label: "Renewals", href: "/renewals", icon: FileClock },
  { label: "DNS Records", href: "/dns", icon: Network },
  { label: "Contacts", href: "/contacts", icon: CircleUserRound },
  { label: "Orders & Billing", href: "/orders", icon: CreditCard },
];

const isActive = (pathname: string, href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

function VendorPage({ pathname, token }: { pathname: string; token: string }) {
  if (pathname === "/search") return <SearchAndBuy token={token} />;
  if (pathname === "/domains") return <MyDomains token={token} />;
  if (pathname.startsWith("/domains/")) return <DomainDetail token={token} domainName={decodeURIComponent(pathname.slice("/domains/".length))} />;
  if (pathname === "/transfers") return <Transfers token={token} />;
  if (pathname === "/renewals") return <Renewals token={token} />;
  if (pathname === "/dns") return <DnsRecords token={token} />;
  if (pathname.startsWith("/dns/")) return <DnsRecords token={token} domainName={decodeURIComponent(pathname.slice("/dns/".length))} />;
  if (pathname === "/contacts") return <Contacts token={token} />;
  if (pathname === "/orders") return <OrdersAndBilling token={token} />;
  return <VendorOverview token={token} />;
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

  useEffect(() => {
    const currentSession = readDomainSession();
    if (!currentSession) { router.replace("/login"); return; }
    setSession(currentSession);
    setAuthReady(true);
    setDarkMode(window.localStorage.getItem("sellerslogin-domain-theme") === "dark");
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
    return () => { active = false; };
  }, [session?.token, role]);

  const signOut = () => { writeDomainSession(null); router.replace("/login"); };
  if (!authReady || !session) return <div className="min-h-screen bg-background" />;

  const vendorName = getVendorName(session.user);
  const vendorEmail = String(session.user?.email || "");
  const initials = vendorName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "V";

  if (role === "admin" || role === "superadmin") {
    return <SuperAdminDashboard adminUrl={adminUrl} darkMode={darkMode} email={vendorEmail} name={vendorName} token={session.token} onSignOut={signOut} onToggleTheme={() => setDarkMode((value) => !value)} />;
  }

  const current = navigation.find((item) => isActive(pathname, item.href)) || navigation[0];
  return <div className={cn("min-h-screen bg-muted/30", darkMode && "dark")}>
    {sidebarOpen && <button className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r bg-background transition-all lg:translate-x-0", sidebarOpen && "translate-x-0", sidebarCollapsed && "lg:w-16")}>
      <div className="flex h-16 items-center justify-between border-b px-4"><Link href="/" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Globe2 className="size-5" /></span>{!sidebarCollapsed && <span><span className="block text-sm font-semibold">SellersLogin</span><span className="block text-xs text-muted-foreground">Domain</span></span>}</Link><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}><X /></Button></div>
      <div className="p-3"><Button asChild variant="outline" className={cn("w-full justify-start", sidebarCollapsed && "lg:px-2")}><a href={adminUrl}><ArrowLeft />{!sidebarCollapsed && "Go to Main Dashboard"}</a></Button></div>
      <div className="flex-1 overflow-y-auto px-3 py-2">{!sidebarCollapsed && <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">DOMAIN WORKSPACE</p>}<nav className="space-y-1">{navigation.map((item) => <Button key={item.href} asChild variant={isActive(pathname, item.href) ? "secondary" : "ghost"} className={cn("w-full justify-start", isActive(pathname, item.href) && "bg-primary/20", sidebarCollapsed && "lg:px-2")}><Link href={item.href} onClick={() => setSidebarOpen(false)}><item.icon />{!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}</Link></Button>)}</nav></div>
      <div className="border-t p-3"><Button variant="ghost" className="w-full" onClick={() => setSidebarCollapsed((value) => !value)}><ArrowLeft className={cn(sidebarCollapsed && "rotate-180")} />{!sidebarCollapsed && "Collapse sidebar"}</Button></div>
    </aside>
    <div className={cn("min-h-screen lg:pl-64", sidebarCollapsed && "lg:pl-16")}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6"><div className="flex items-center gap-3"><Button variant="outline" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu /></Button><div><p className="text-xs text-muted-foreground">Domain Console</p><h1 className="font-semibold">{current.label}</h1></div></div><div className="flex items-center gap-1 md:gap-2"><Button asChild variant="outline" className="hidden sm:inline-flex"><a href={`${adminUrl}/credits`}><WalletCards />{walletBalance == null ? "Credits" : `${walletBalance.toLocaleString("en-IN")} credits`}</a></Button><Button variant="ghost" size="icon" onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun /> : <Moon />}</Button><Button variant="ghost" size="icon"><Bell /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">{initials}</span><span className="hidden max-w-40 truncate sm:inline">{vendorName}</span><ChevronDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64"><DropdownMenuLabel><p>{vendorName}</p><p className="mt-1 text-xs font-normal text-muted-foreground">{vendorEmail || "SellersLogin vendor account"}</p></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={signOut}><LogOut />Log out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
      <main className="mx-auto max-w-7xl p-4 md:p-6"><VendorPage pathname={pathname} token={session.token} /></main>
    </div>
  </div>;
}

export function DomainDashboard() {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}><DomainDashboardContent /></Suspense>;
}
