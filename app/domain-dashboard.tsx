"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpenText,
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  Clock3,
  CreditCard,
  Database,
  FileClock,
  Globe2,
  House,
  LogOut,
  Menu,
  Moon,
  Network,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShoppingBag,
  Sun,
  WalletCards,
  X,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getVendorName, readDomainSession, writeDomainSession, type DomainSession } from "@/lib/domain-session";

const adminUrl = String(process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:5173").replace(/\/$/, "");

const navigation = [
  { label: "Domain Dashboard", icon: House },
  { label: "Search & Buy Domain", icon: Search },
  { label: "My Domains", icon: Globe2, count: 4 },
  { label: "Domain Transfers", icon: RefreshCcw },
  { label: "Renewals", icon: FileClock, count: 2 },
  { label: "DNS Manager", icon: Network },
  { label: "Contacts", icon: CircleUserRound },
  { label: "Orders & Billing", icon: CreditCard },
];

const stats = [
  { label: "Active domains", value: "4", description: "All domains are active", icon: Globe2 },
  { label: "Expiring soon", value: "2", description: "Within the next 60 days", icon: Clock3 },
  { label: "Auto-renew", value: "3", description: "Protected from expiry", icon: RefreshCcw },
  { label: "Wallet balance", value: "735.28", description: "Credits available", icon: WalletCards },
];

const domains = [
  { name: "techsolutionhub.com", expiry: "24 Dec 2026", renew: true },
  { name: "sellerslogin.store", expiry: "19 Jan 2027", renew: true },
  { name: "freshcart.in", expiry: "08 Mar 2027", renew: false },
];

export function DomainDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<DomainSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeItem, setActiveItem] = useState("Domain Dashboard");
  const [query, setQuery] = useState("");
  const [searchedDomain, setSearchedDomain] = useState("");

  useEffect(() => {
    const authCheck = window.setTimeout(() => {
      const currentSession = readDomainSession();
      if (!currentSession) {
        router.replace("/login");
        return;
      }
      setSession(currentSession);
      setAuthReady(true);
      setDarkMode(window.localStorage.getItem("sellerslogin-domain-theme") === "dark");
    }, 0);
    return () => window.clearTimeout(authCheck);
  }, [router]);

  useEffect(() => {
    if (authReady) window.localStorage.setItem("sellerslogin-domain-theme", darkMode ? "dark" : "light");
  }, [authReady, darkMode]);

  const normalizedDomain = useMemo(() => {
    const value = searchedDomain.trim().toLowerCase().replace(/\s+/g, "");
    return value ? (value.includes(".") ? value : `${value}.com`) : "";
  }, [searchedDomain]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim()) setSearchedDomain(query);
  };

  const signOut = () => {
    writeDomainSession(null);
    router.replace("/login");
  };

  if (!authReady) return <div className="min-h-screen bg-background" />;

  const vendorName = getVendorName(session?.user);
  const vendorEmail = String(session?.user?.email || "");
  const initials = vendorName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "V";

  return (
    <div className={cn("min-h-screen bg-muted/30", darkMode && "dark")}>
      {sidebarOpen && <button className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r bg-background transition-all lg:translate-x-0",
        sidebarOpen && "translate-x-0",
        sidebarCollapsed && "lg:w-16",
      )}>
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Globe2 className="size-5" /></div>
            {!sidebarCollapsed && <div><p className="text-sm font-semibold">SellersLogin</p><p className="text-xs text-muted-foreground">Domain</p></div>}
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}><X /></Button>
        </div>

        <div className="p-3">
          <Button asChild variant="outline" className={cn("w-full justify-start", sidebarCollapsed && "lg:px-2")}>
            <a href={adminUrl}><ArrowLeft />{!sidebarCollapsed && "Go to Main Dashboard"}</a>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {!sidebarCollapsed && <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">DOMAIN WORKSPACE</p>}
          <nav className="space-y-1">
            {navigation.map((item) => (
              <Button
                key={item.label}
                variant={activeItem === item.label ? "secondary" : "ghost"}
                className={cn("w-full justify-start", activeItem === item.label && "bg-primary/20", sidebarCollapsed && "lg:px-2")}
                onClick={() => { setActiveItem(item.label); setSidebarOpen(false); }}
              >
                <item.icon />
                {!sidebarCollapsed && <><span className="flex-1 text-left">{item.label}</span>{item.count ? <Badge variant="secondary">{item.count}</Badge> : null}</>}
              </Button>
            ))}
          </nav>

          {!sidebarCollapsed && <>
            <p className="mt-6 mb-2 px-2 text-xs font-medium text-muted-foreground">HELP & SETTINGS</p>
            {[{ label: "Help Centre", icon: CircleHelp }, { label: "Documentation", icon: BookOpenText }, { label: "Settings", icon: Settings2 }].map((item) => (
              <Button key={item.label} variant="ghost" className="w-full justify-start"><item.icon />{item.label}</Button>
            ))}
          </>}
        </div>

        <div className="border-t p-3">
          <Button variant="ghost" className="w-full" onClick={() => setSidebarCollapsed((value) => !value)}>
            <ArrowLeft className={cn(sidebarCollapsed && "rotate-180")} />{!sidebarCollapsed && "Collapse sidebar"}
          </Button>
        </div>
      </aside>

      <div className={cn("min-h-screen lg:pl-64", sidebarCollapsed && "lg:pl-16")}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu /></Button>
            <div><p className="text-xs text-muted-foreground">Domain Console</p><h1 className="font-semibold">{activeItem}</h1></div>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <Button asChild variant="outline" className="hidden sm:inline-flex"><a href={`${adminUrl}/credits`}><WalletCards />735.28 credits</a></Button>
            <Button variant="ghost" size="icon" onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun /> : <Moon />}</Button>
            <Button variant="ghost" size="icon"><Bell /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">{initials}</span><span className="hidden max-w-40 truncate sm:inline">{vendorName}</span><ChevronDown /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel><p>{vendorName}</p><p className="mt-1 text-xs font-normal text-muted-foreground">{vendorEmail || "SellersLogin vendor account"}</p></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={signOut}><LogOut />Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <Card className="border-primary/40 bg-primary/10">
            <CardHeader>
              <Badge className="mb-2"><Globe2 />Domain search</Badge>
              <CardTitle className="text-2xl md:text-3xl">Find the right domain for your business</CardTitle>
              <CardDescription>Search, buy and manage your domains from one workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex max-w-3xl gap-2" onSubmit={handleSearch}>
                <div className="relative flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a domain, for example mybrand.com" className="pl-9" /></div>
                <Button type="submit">Search<ArrowRight /></Button>
              </form>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span>Popular:</span>{[".com", ".in", ".store", ".co"].map((extension) => <Button key={extension} size="sm" variant="outline" onClick={() => setQuery(`mybrand${extension}`)}>{extension}</Button>)}</div>
            </CardContent>
          </Card>

          {normalizedDomain && <Card className="border-primary"><CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between"><div><Badge>Available</Badge><h2 className="mt-2 text-xl font-semibold">{normalizedDomain}</h2><p className="text-sm text-muted-foreground">₹999/year · Renews at ₹1,299</p></div><Button><Plus />Add to cart</Button></CardContent></Card>}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => <Card key={stat.label}><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm font-medium">{stat.label}</CardTitle><stat.icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stat.value}</div><p className="text-xs text-muted-foreground">{stat.description}</p></CardContent></Card>)}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Common domain management tasks.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {[{ title: "Buy domain", icon: ShoppingBag }, { title: "Transfer domain", icon: RefreshCcw }, { title: "Manage DNS", icon: Database }].map((action) => <Button key={action.title} variant="outline" className="h-auto flex-col py-6"><action.icon className="size-5" />{action.title}</Button>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Upcoming renewals</CardTitle><CardDescription>Domains that need your attention.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {domains.slice(0, 2).map((domain) => <div key={domain.name} className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">{domain.name}</p><p className="text-xs text-muted-foreground">Expires {domain.expiry}</p></div><Badge variant="secondary">Renewal due</Badge></div>)}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader><CardTitle>Your domains</CardTitle><CardDescription>Manage registration, DNS and renewals.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-lg text-sm"><thead><tr className="border-b text-left"><th className="pb-3 font-medium">Domain</th><th className="pb-3 font-medium">Expiry</th><th className="pb-3 font-medium">Auto-renew</th><th className="pb-3 text-right font-medium">Status</th></tr></thead><tbody>{domains.map((domain) => <tr key={domain.name} className="border-b last:border-0"><td className="py-4 font-medium">{domain.name}</td><td className="py-4 text-muted-foreground">{domain.expiry}</td><td className="py-4"><Badge variant={domain.renew ? "default" : "secondary"}>{domain.renew ? "On" : "Off"}</Badge></td><td className="py-4 text-right"><Badge variant="outline">Active</Badge></td></tr>)}</tbody></table>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
