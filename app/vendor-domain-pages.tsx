"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Network,
  RefreshCcw,
  Search,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createIdempotencyKey, domainApi, formatDomainAmount, formatDomainDate } from "@/lib/domain-api";

type PageResult<T> = { items: T[]; total: number; page: number; limit: number; pages: number };
type DomainAsset = {
  domainName: string;
  unicodeDomainName?: string;
  status?: unknown;
  expirationDate?: string | null;
  renewalMode?: string;
  lockStatus?: boolean | null;
  privacyProtectionStatus?: boolean | null;
  nameservers?: string[];
  remainingDay?: number | null;
};
type DomainOrder = {
  orderId: string;
  domainName: string;
  operation: string;
  amount: number;
  currency: string;
  status: string;
  createdAt?: string;
  failureMessage?: string;
};
type Wallet = { availableCredits: number; reservedCredits: number; usedCredits: number; currency: string };
type SearchResult = {
  domainName: string;
  unicodeDomainName?: string;
  status: string;
  isPremium: boolean;
  isDocumentRequired: boolean;
  period: number;
  pricing: { customerAmount: number | null; customerCurrency: string | null };
};
type Quote = {
  quoteId: string;
  domainName: string;
  period: number;
  expiresAt: string;
  pricing: { customerAmount: number; customerCurrency: string };
};

function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 size-4 text-muted-foreground" /><p className="text-sm text-muted-foreground">{message}</p></div>
        {retry && <Button variant="outline" onClick={retry}><RefreshCcw />Retry</Button>}
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
      <Globe2 className="mb-3 size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function LoadingState() {
  return <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 size-4 animate-spin" />Loading...</div>;
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}

function DomainWorkspacePreview() {
  const features = [
    { title: "Domain details", description: "Status, registration date and validity", icon: Globe2 },
    { title: "Renewal", description: "Expiry date and renewal controls", icon: Clock3 },
    { title: "Security", description: "Domain lock and privacy protection", icon: LockKeyhole },
    { title: "DNS records", description: "A, CNAME, MX, TXT and other records", icon: Network },
  ];

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><CardTitle>Your domain workspace</CardTitle><Badge variant="outline">Preview</Badge></div>
            <CardDescription className="mt-1">This workspace becomes active as soon as you register or transfer a domain.</CardDescription>
          </div>
          <div className="flex gap-2"><Button asChild><Link href="/search">Buy a domain</Link></Button><Button asChild variant="outline"><Link href="/transfers">Transfer a domain</Link></Button></div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => <div key={feature.title} className="rounded-lg border p-4"><feature.icon className="mb-4 size-5 text-muted-foreground" /><p className="font-medium">{feature.title}</p><p className="mt-1 text-sm text-muted-foreground">{feature.description}</p></div>)}
      </CardContent>
    </Card>
  );
}

function DnsWorkspacePreview() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Choose a domain</CardTitle><CardDescription>Your purchased domains will be available here.</CardDescription></div><Badge variant="outline">No domains yet</Badge></div></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row"><Input disabled placeholder="Select a domain" /><Button asChild><Link href="/search">Buy a domain</Link></Button></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Add DNS record</CardTitle><CardDescription>Create website, email and verification records after selecting a domain.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5"><Input disabled placeholder="Name" /><Input disabled placeholder="Type" /><Input disabled placeholder="TTL" /><Input disabled placeholder="Value" /><Button disabled>Add record</Button></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>DNS records</CardTitle><CardDescription>Your A, AAAA, CNAME, MX, TXT and CAA records will appear here.</CardDescription></CardHeader>
        <CardContent><div className="overflow-x-auto"><table className="w-full min-w-2xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Name</th><th className="pb-3">Type</th><th className="pb-3">TTL</th><th className="pb-3">Value</th><th className="pb-3 text-right">Action</th></tr></thead></table></div><div className="py-10 text-center"><Network className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">DNS workspace ready</p><p className="mt-1 text-sm text-muted-foreground">Register or transfer a domain to start adding records.</p></div></CardContent>
      </Card>
    </div>
  );
}

function useResource<T>(token: string, path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    domainApi<T>(token, path).then((value) => { if (active) setData(value); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Request failed."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, path, version]);
  return { data, loading, error, reload };
}

export function VendorOverview({ token }: { token: string }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [domains, setDomains] = useState<PageResult<DomainAsset> | null>(null);
  const [orders, setOrders] = useState<PageResult<DomainOrder> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    Promise.allSettled([
      domainApi<Wallet>(token, "/v1/domain/wallet"),
      domainApi<PageResult<DomainAsset>>(token, "/v1/domain/domains?page=1&limit=100"),
      domainApi<PageResult<DomainOrder>>(token, "/v1/domain/orders?page=1&limit=5"),
    ]).then(([walletResult, domainResult, orderResult]) => {
      if (!active) return;
      if (walletResult.status === "fulfilled") setWallet(walletResult.value);
      if (domainResult.status === "fulfilled") setDomains(domainResult.value);
      if (orderResult.status === "fulfilled") setOrders(orderResult.value);
      if ([walletResult, domainResult, orderResult].every((result) => result.status === "rejected")) {
        setError("Live dashboard information is temporarily unavailable.");
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, version]);
  const items = domains?.items || [];
  const now = Date.now();
  const expiringSoon = items.filter((item) => { const expiry = new Date(item.expirationDate || 0).getTime(); return expiry >= now && expiry <= now + 60 * 86400000; }).length;
  const autoRenew = items.filter((item) => String(item.renewalMode).toLowerCase() === "autorenew").length;
  const cards = [
    { label: "Owned domains", value: domains?.total, description: "Domains in your account", icon: Globe2 },
    { label: "Expiring soon", value: expiringSoon, description: "Within the next 60 days", icon: Clock3 },
    { label: "Provider auto-renew", value: autoRenew, description: "Provider renewal mode", icon: RefreshCcw },
    { label: "Wallet balance", value: wallet ? `${wallet.availableCredits.toLocaleString("en-IN")} ${wallet.currency}` : null, description: wallet ? `${wallet.reservedCredits.toLocaleString("en-IN")} reserved` : "Available credits", icon: WalletCards },
  ];
  return <div className="space-y-6">
    <PageHeading title="Domain Dashboard" description="Live overview of your domains, renewals, orders and wallet." action={<Button asChild><Link href="/search"><Search />Search a domain</Link></Button>} />
    {error && <p className="text-sm text-muted-foreground">{error} <button className="underline" onClick={() => setVersion((value) => value + 1)}>Try again</button></p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Card key={card.label}><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm font-medium">{card.label}</CardTitle><card.icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading || card.value == null ? "—" : typeof card.value === "number" ? card.value.toLocaleString("en-IN") : card.value}</div><p className="text-xs text-muted-foreground">{card.description}</p></CardContent></Card>)}</section>
    <section className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Upcoming expirations</CardTitle><CardDescription>Your nearest domain renewals.</CardDescription></CardHeader><CardContent className="space-y-3">{loading ? <LoadingState /> : items.filter((item) => item.expirationDate).sort((a, b) => new Date(a.expirationDate || 0).getTime() - new Date(b.expirationDate || 0).getTime()).slice(0, 4).map((domain) => <Link href={`/domains/${encodeURIComponent(domain.domainName)}`} key={domain.domainName} className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">{domain.domainName}</p><p className="text-xs text-muted-foreground">Expires {formatDomainDate(domain.expirationDate)}</p></div><ArrowRight className="size-4" /></Link>)}{!loading && !items.some((item) => item.expirationDate) && <EmptyState title="No registered domains" description="Purchased or transferred domains will appear here." action={<Button asChild><Link href="/search">Buy a domain</Link></Button>} />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Recent orders</CardTitle><CardDescription>Latest registrations, renewals and transfers.</CardDescription></CardHeader><CardContent className="space-y-3">{loading ? <LoadingState /> : orders?.items.map((order) => <div key={order.orderId} className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">{order.domainName}</p><p className="text-xs text-muted-foreground">{order.operation} · {formatDomainAmount(order.amount, order.currency)}</p></div><Badge variant={order.status === "COMPLETED" ? "secondary" : "outline"}>{order.status.replaceAll("_", " ")}</Badge></div>)}{!loading && !orders?.items.length && <EmptyState title="No orders yet" description="Your domain transactions will appear here." />}</CardContent></Card>
    </section>
  </div>;
}

const emptyContact = { firstName: "", lastName: "", companyName: "", eMail: "", address: "", city: "", state: "", postalCode: "", country: "IN", phoneCountryCode: "91", phone: "" };
const liveSearchCache = new Map<string, { result: SearchResult; expiresAt: number }>();

function buildDomainSuggestions(value: string) {
  const cleaned = value.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/[^a-z0-9.-]/g, "").replace(/^\.+|\.+$/g, "");
  if (cleaned.length < 2) return [];
  const labels = cleaned.split(".").filter(Boolean);
  const base = labels[0];
  if (!base || base.length < 2) return [];
  const alternatives = ["com", "in", "co.in", "net", "store"];
  const candidates = cleaned.includes(".") ? [cleaned, ...alternatives.map((tld) => `${base}.${tld}`)] : alternatives.map((tld) => `${base}.${tld}`);
  return [...new Set(candidates)].slice(0, 6);
}

export function SearchAndBuy({ token }: { token: string }) {
  const [query, setQuery] = useState(""); const [suggestions, setSuggestions] = useState<SearchResult[]>([]); const [result, setResult] = useState<SearchResult | null>(null); const [quote, setQuote] = useState<Quote | null>(null);
  const [contact, setContact] = useState(emptyContact); const [searching, setSearching] = useState(false); const [retryVersion, setRetryVersion] = useState(0); const [searchError, setSearchError] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [order, setOrder] = useState<DomainOrder | null>(null);
  const suggestionNames = useMemo(() => buildDomainSuggestions(query), [query]);
  useEffect(() => {
    const domainNames = suggestionNames;
    setResult(null); setQuote(null); setOrder(null); setError(""); setSearchError("");
    if (!domainNames.length) { setSuggestions([]); setSearching(false); return; }
    const now = Date.now();
    const cached = domainNames.map((domainName) => liveSearchCache.get(domainName)).filter((item) => item && item.expiresAt > now).map((item) => item!.result);
    const cachedNames = new Set(cached.map((item) => item.domainName));
    const missing = domainNames.filter((domainName) => !cachedNames.has(domainName));
    setSuggestions(cached);
    if (!missing.length) { setSearching(false); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      domainApi<{ results: SearchResult[] }>(token, "/v1/domain/search/bulk", { method: "POST", body: JSON.stringify({ domainNames: missing }) })
        .then((data) => { if (!active) return; const expiresAt = Date.now() + 60_000; (data.results || []).forEach((item) => liveSearchCache.set(item.domainName, { result: item, expiresAt })); setSuggestions(domainNames.map((domainName) => liveSearchCache.get(domainName)?.result).filter((item): item is SearchResult => Boolean(item))); })
        .catch(() => { if (active) setSearchError("We couldn't check availability right now. Please try again in a moment."); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [retryVersion, suggestionNames, token]);
  const searchDomain = (event: FormEvent) => { event.preventDefault(); if (!searching && suggestionNames.length) setRetryVersion((value) => value + 1); };
  const createQuote = async (selected: SearchResult) => { setResult(selected); setQuote(null); setOrder(null); setPending(true); setError(""); try { const nextQuote = await domainApi<Quote>(token, "/v1/domain/quotes/registration", { method: "POST", body: JSON.stringify({ domainName: selected.domainName, period: selected.period }) }); setQuote(nextQuote); window.requestAnimationFrame(() => document.getElementById("domain-checkout-form")?.scrollIntoView({ behavior: "smooth", block: "start" })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create quote."); } finally { setPending(false); } };
  const purchase = async (event: FormEvent) => { event.preventDefault(); if (!quote) return; setPending(true); setError(""); try { const contacts = ["Registrant", "Admin", "Tech", "Billing"].map((contactType) => ({ ...contact, contactType })); const value = await domainApi<DomainOrder>(token, "/v1/domain/purchases/registration", { method: "POST", headers: { "Idempotency-Key": createIdempotencyKey("domain-register") }, body: JSON.stringify({ quoteId: quote.quoteId, contacts, tldAttributes: {}, useTrusteeContact: false }) }); setOrder(value); } catch (cause) { setError(cause instanceof Error ? cause.message : "Registration failed."); } finally { setPending(false); } };
  return <div className="space-y-6"><PageHeading title="Search & Buy Domain" description="Type a name to see live availability and prices." />
    <Card className="border-primary/40 bg-primary/10"><CardContent className="pt-6"><form className="flex flex-col gap-2 sm:flex-row" onSubmit={searchDomain}><div className="relative flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} required autoComplete="off" placeholder="Type your domain name" className="pl-9" /></div><Button disabled={searching || suggestionNames.length === 0}>{searching ? <LoaderCircle className="animate-spin" /> : <Search />}Search</Button></form></CardContent></Card>
    {searchError && <ErrorState message={searchError} retry={() => { setSearchError(""); setRetryVersion((value) => value + 1); }} />}
    {error && <ErrorState message={error} />}
    {suggestionNames.length > 0 && (!searchError || suggestions.length > 0) && <Card><CardHeader><CardTitle>Domain suggestions</CardTitle><CardDescription>Live availability and current registration price.</CardDescription></CardHeader><CardContent className="p-0"><div className="divide-y">{(searchError ? suggestions.map((item) => item.domainName) : suggestionNames).map((domainName) => { const suggestion = suggestions.find((item) => item.domainName === domainName); if (!suggestion) return <div key={domainName} className="flex items-center justify-between gap-4 p-4"><p className="font-medium">{domainName}</p><Badge variant="outline"><LoaderCircle className="animate-spin" />Checking</Badge></div>; const available = suggestion.status === "AVAILABLE"; const selected = result?.domainName === suggestion.domainName; return <div key={suggestion.domainName} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{suggestion.domainName}</p><Badge variant={available ? "secondary" : "outline"}>{available ? "Available" : "Not available"}</Badge>{suggestion.isPremium && <Badge variant="outline">Premium</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{available ? `${formatDomainAmount(suggestion.pricing.customerAmount, suggestion.pricing.customerCurrency)} / ${suggestion.period} year` : "Try another extension from the suggestions below."}</p></div>{available && <Button onClick={() => createQuote(suggestion)} disabled={pending || (selected && Boolean(quote))}>{pending && selected ? <LoaderCircle className="animate-spin" /> : null}{selected && quote ? "Checkout ready" : "Continue to checkout"}<ArrowRight /></Button>}</div>; })}</div></CardContent></Card>}
    {quote && !order && <Card id="domain-checkout-form"><CardHeader><CardTitle>Registrant details</CardTitle><CardDescription>Complete the details for {quote.domainName}. SellersLogin configures DNS automatically, and nameservers can be changed after purchase.</CardDescription></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={purchase}>{Object.entries(contact).map(([key, value]) => <div key={key} className="space-y-2"><Label htmlFor={key}>{key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</Label><Input id={key} type={key === "eMail" ? "email" : "text"} value={value} required={key !== "companyName"} onChange={(event) => setContact((current) => ({ ...current, [key]: event.target.value }))} /></div>)}<div className="flex items-center justify-between border-t pt-4 sm:col-span-2"><div><p className="font-medium">Total: {formatDomainAmount(quote.pricing.customerAmount, quote.pricing.customerCurrency)}</p><p className="text-xs text-muted-foreground">Quote expires {formatDomainDate(quote.expiresAt)}</p></div><Button disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <CreditCard />}Confirm purchase</Button></div></form></CardContent></Card>}
    {order && <Card className="border-primary"><CardContent className="flex items-start gap-3 py-6"><CheckCircle2 className="size-5 text-primary" /><div><p className="font-medium">Order {order.status.replaceAll("_", " ")}</p><p className="text-sm text-muted-foreground">Order ID: {order.orderId}</p></div></CardContent></Card>}
  </div>;
}

export function MyDomains({ token }: { token: string }) {
  const [filter, setFilter] = useState(""); const resource = useResource<PageResult<DomainAsset>>(token, `/v1/domain/domains?page=1&limit=100&filter=${encodeURIComponent(filter)}`);
  const hasDomains = Boolean(resource.data?.items.length);
  return <div className="space-y-6"><PageHeading title="My Domains" description="Manage validity, renewal, security and DNS from one place." action={<Button asChild><Link href="/search">Buy new domain</Link></Button>} />{hasDomains && <div className="relative max-w-md"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter domains" className="pl-9" /></div>}{resource.error && <ErrorState message={resource.error} retry={resource.reload} />}{resource.loading ? <Card><CardContent className="pt-6"><LoadingState /></CardContent></Card> : hasDomains ? <Card><CardContent className="pt-6"><div className="overflow-x-auto"><table className="w-full min-w-2xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Domain</th><th className="pb-3">Status</th><th className="pb-3">Valid until</th><th className="pb-3">Renewal</th><th /></tr></thead><tbody>{resource.data!.items.map((domain) => <tr key={domain.domainName} className="border-b last:border-0"><td className="py-4 font-medium">{domain.domainName}</td><td className="py-4"><Badge variant="outline">{String(domain.status || "Unknown")}</Badge></td><td className="py-4 text-muted-foreground">{formatDomainDate(domain.expirationDate)}</td><td className="py-4">{domain.renewalMode || "—"}</td><td className="py-4 text-right"><Button asChild size="sm" variant="outline"><Link href={`/domains/${encodeURIComponent(domain.domainName)}`}>Manage domain</Link></Button></td></tr>)}</tbody></table></div></CardContent></Card> : <DomainWorkspacePreview />}</div>;
}

export function DomainDetail({ token, domainName }: { token: string; domainName: string }) {
  const resource = useResource<Record<string, unknown> & { local?: DomainAsset }>(token, `/v1/domain/domains/${encodeURIComponent(domainName)}`); const [nameservers, setNameservers] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false); const [authCode, setAuthCode] = useState("");
  useEffect(() => { const list = resource.data?.local?.nameservers; if (list?.length) setNameservers(list.join(", ")); }, [resource.data]);
  const mutate = async (path: string, body?: unknown) => { setPending(true); setError(""); setMessage(""); try { await domainApi(token, path, { method: path.endsWith("auth-code") ? "POST" : "PUT", body: body ? JSON.stringify(body) : undefined }); setMessage("Domain settings updated successfully."); resource.reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Update failed."); } finally { setPending(false); } };
  const generateAuthCode = async () => { setPending(true); setError(""); setAuthCode(""); try { const data = await domainApi<{ authCode: string }>(token, `/v1/domain/domains/${encodeURIComponent(domainName)}/auth-code`, { method: "POST" }); setAuthCode(String(data.authCode || "")); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to generate authorization code."); } finally { setPending(false); } };
  if (resource.loading) return <LoadingState />; if (resource.error || !resource.data) return <ErrorState message={resource.error || "Domain not found."} retry={resource.reload} />;
  const domain = resource.data.local || { domainName };
  return <div className="space-y-6"><PageHeading title={domain.domainName} description="Registration, security, nameserver and lifecycle settings." action={<Button asChild variant="outline"><Link href="/domains">Back to domains</Link></Button>} />{error && <ErrorState message={error} />}{message && <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">{message}</div>}{authCode && <div className="rounded-lg border border-primary/40 bg-primary/10 p-4"><p className="text-sm font-medium">Authorization code</p><p className="mt-1 break-all font-mono text-sm">{authCode}</p><p className="mt-1 text-xs text-muted-foreground">Store it securely. It is displayed only for this request.</p></div>}<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ label: "Status", value: String(domain.status || "Unknown"), icon: Globe2 }, { label: "Expires", value: formatDomainDate(domain.expirationDate), icon: Clock3 }, { label: "Lock", value: domain.lockStatus ? "Locked" : "Unlocked", icon: LockKeyhole }, { label: "Privacy", value: domain.privacyProtectionStatus ? "Enabled" : "Disabled", icon: ShieldCheck }].map((item) => <Card key={item.label}><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">{item.label}</CardTitle><item.icon className="size-4 text-muted-foreground" /></CardHeader><CardContent className="text-xl font-semibold">{item.value}</CardContent></Card>)}</section><Card><CardHeader><CardTitle>Nameservers</CardTitle><CardDescription>Update the authoritative nameservers for this domain.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><Input value={nameservers} onChange={(event) => setNameservers(event.target.value)} placeholder="ns1.example.com, ns2.example.com" /><Button disabled={pending} onClick={() => mutate(`/v1/domain/domains/${encodeURIComponent(domainName)}/nameservers`, { nameServers: nameservers.split(",").map((item) => item.trim()).filter(Boolean), dnssecMode: 0 })}>Save nameservers</Button></CardContent></Card><Card><CardHeader><CardTitle>Security and ownership</CardTitle><CardDescription>Changes are sent directly to the registrar.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button variant="outline" disabled={pending} onClick={() => mutate(`/v1/domain/domains/${encodeURIComponent(domainName)}/lock`, { locked: !domain.lockStatus })}>{domain.lockStatus ? "Unlock domain" : "Lock domain"}</Button><Button variant="outline" disabled={pending} onClick={() => mutate(`/v1/domain/domains/${encodeURIComponent(domainName)}/privacy`, { enabled: !domain.privacyProtectionStatus })}>{domain.privacyProtectionStatus ? "Disable privacy" : "Enable privacy"}</Button><Button variant="outline" disabled={pending} onClick={generateAuthCode}><LockKeyhole />Generate auth code</Button><Button asChild variant="outline"><Link href={`/dns/${encodeURIComponent(domainName)}`}><Network />Manage DNS records</Link></Button></CardContent></Card></div>;
}

export function Transfers({ token }: { token: string }) {
  const [domainName, setDomainName] = useState(""); const [authCode, setAuthCode] = useState(""); const [period, setPeriod] = useState(1); const [quote, setQuote] = useState<Quote | null>(null); const [order, setOrder] = useState<DomainOrder | null>(null); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const check = async (event: FormEvent) => { event.preventDefault(); setPending(true); setError(""); setQuote(null); try { setQuote(await domainApi<Quote>(token, "/v1/domain/quotes/transfer", { method: "POST", body: JSON.stringify({ domainName, authCode, period }) })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Transfer check failed."); } finally { setPending(false); } };
  const transfer = async () => { if (!quote) return; setPending(true); setError(""); try { setOrder(await domainApi<DomainOrder>(token, "/v1/domain/purchases/transfer", { method: "POST", headers: { "Idempotency-Key": createIdempotencyKey("domain-transfer") }, body: JSON.stringify({ quoteId: quote.quoteId, authCode }) })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Transfer failed."); } finally { setPending(false); } };
  return <div className="space-y-6"><PageHeading title="Domain Transfers" description="Transfer a domain into SellersLogin and track the registrar process." />{error && <ErrorState message={error} />}<Card><CardHeader><CardTitle>Start a transfer</CardTitle><CardDescription>Unlock the domain at its current registrar and obtain its EPP/auth code first.</CardDescription></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-3" onSubmit={check}><div className="space-y-2 sm:col-span-2"><Label htmlFor="transfer-domain">Domain name</Label><Input id="transfer-domain" value={domainName} onChange={(event) => setDomainName(event.target.value)} required placeholder="example.com" /></div><div className="space-y-2"><Label htmlFor="transfer-period">Renewal period</Label><select id="transfer-period" className="h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={period} onChange={(event) => setPeriod(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => index + 1).map((year) => <option key={year} value={year}>{year} {year === 1 ? "year" : "years"}</option>)}</select></div><div className="space-y-2 sm:col-span-3"><Label htmlFor="transfer-auth-code">Authorization code</Label><Input id="transfer-auth-code" type="password" value={authCode} onChange={(event) => setAuthCode(event.target.value)} placeholder="Enter EPP/auth code" /><p className="text-xs text-muted-foreground">Get this code after unlocking the domain at your current registrar. Some extensions may not require it.</p></div><Button className="sm:col-span-3" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <RefreshCcw />}Check transfer and price</Button></form></CardContent></Card>{quote && !order && <Card><CardHeader><CardTitle>Transfer quote</CardTitle><CardDescription>Quote expires {formatDomainDate(quote.expiresAt)}</CardDescription></CardHeader><CardContent className="flex items-center justify-between"><p className="text-2xl font-semibold">{formatDomainAmount(quote.pricing.customerAmount, quote.pricing.customerCurrency)}</p><Button disabled={pending} onClick={transfer}>Confirm transfer</Button></CardContent></Card>}{order && <Card><CardContent className="py-6"><p className="font-medium">Transfer order: {order.status.replaceAll("_", " ")}</p><p className="text-sm text-muted-foreground">{order.orderId}</p></CardContent></Card>}</div>;
}

export function Renewals({ token }: { token: string }) {
  const domains = useResource<PageResult<DomainAsset>>(token, "/v1/domain/domains?page=1&limit=100"); const [selected, setSelected] = useState(""); const [period, setPeriod] = useState(1); const [quote, setQuote] = useState<Quote | null>(null); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const getQuote = async () => { setPending(true); setError(""); setMessage(""); try { setQuote(await domainApi<Quote>(token, "/v1/domain/quotes/renewal", { method: "POST", body: JSON.stringify({ domainName: selected, period }) })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Renewal quote failed."); } finally { setPending(false); } };
  const renew = async () => { if (!quote) return; setPending(true); setError(""); try { const order = await domainApi<DomainOrder>(token, "/v1/domain/purchases/renewal", { method: "POST", headers: { "Idempotency-Key": createIdempotencyKey("domain-renew") }, body: JSON.stringify({ quoteId: quote.quoteId }) }); setMessage(`Renewal order ${order.status.replaceAll("_", " ")}.`); setQuote(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Renewal failed."); } finally { setPending(false); } };
  return <div className="space-y-6"><PageHeading title="Renewals" description="Review expiry dates and renew using a fresh SellersLogin quote." />{error && <ErrorState message={error} />}{message && <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">{message}</div>}<Card><CardHeader><CardTitle>Renew a domain</CardTitle><CardDescription>Select one of your owned domains.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div className="space-y-2 sm:col-span-2"><Label>Domain</Label><select className="h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={selected} onChange={(event) => { setSelected(event.target.value); setQuote(null); }}><option value="">Select a domain</option>{domains.data?.items.map((domain) => <option key={domain.domainName} value={domain.domainName}>{domain.domainName} — {formatDomainDate(domain.expirationDate)}</option>)}</select></div><div className="space-y-2"><Label>Years</Label><Input type="number" min={1} max={10} value={period} onChange={(event) => setPeriod(Number(event.target.value))} /></div><Button disabled={!selected || pending} onClick={getQuote} className="sm:col-span-3">Get renewal quote</Button></CardContent></Card>{quote && <Card><CardContent className="flex items-center justify-between gap-4 py-6"><div><p className="font-medium">{quote.domainName}</p><p className="text-2xl font-semibold">{formatDomainAmount(quote.pricing.customerAmount, quote.pricing.customerCurrency)}</p></div><Button disabled={pending} onClick={renew}>Confirm renewal</Button></CardContent></Card>}</div>;
}

export function DnsRecords({ token, domainName }: { token: string; domainName?: string }) {
  const domains = useResource<PageResult<DomainAsset>>(token, "/v1/domain/domains?page=1&limit=100");
  if (!domainName) return <div className="space-y-6"><PageHeading title="DNS Records" description="Connect websites, email and services to your domains." />{domains.error && <ErrorState message={domains.error} retry={domains.reload} />}{domains.loading ? <Card><CardContent className="pt-6"><LoadingState /></CardContent></Card> : domains.data?.items.length ? <Card><CardHeader><CardTitle>Choose a domain</CardTitle><CardDescription>Select the domain whose DNS records you want to manage.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2">{domains.data.items.map((domain) => <Button key={domain.domainName} asChild variant="outline" className="h-auto justify-between py-4"><Link href={`/dns/${encodeURIComponent(domain.domainName)}`}><span>{domain.domainName}</span><ArrowRight /></Link></Button>)}</div></CardContent></Card> : <DnsWorkspacePreview />}</div>;
  return <DnsZone token={token} domainName={domainName} />;
}

function DnsZone({ token, domainName }: { token: string; domainName: string }) {
  const records = useResource<{ records: Array<Record<string, unknown>> }>(token, `/v1/domain/domains/${encodeURIComponent(domainName)}/dns`); const [name, setName] = useState(""); const [type, setType] = useState("A"); const [ttl, setTtl] = useState(300); const [value, setValue] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const add = async (event: FormEvent) => { event.preventDefault(); setPending(true); setError(""); try { await domainApi(token, `/v1/domain/domains/${encodeURIComponent(domainName)}/dns`, { method: "POST", body: JSON.stringify({ zoneStruct: { name, type, ttl, contents: [value] } }) }); records.reload(); setValue(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add DNS record."); } finally { setPending(false); } };
  const apply = async () => { setPending(true); setError(""); try { await domainApi(token, `/v1/domain/domains/${encodeURIComponent(domainName)}/dns/apply`, { method: "POST" }); records.reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to publish DNS zone."); } finally { setPending(false); } };
  const remove = async (recordName: string, recordType: string, record: string) => { setPending(true); setError(""); try { await domainApi(token, `/v1/domain/domains/${encodeURIComponent(domainName)}/dns`, { method: "DELETE", body: JSON.stringify({ name: recordName, recordType, record }) }); records.reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete DNS record."); } finally { setPending(false); } };
  const zoneRows = (records.data?.records || []).flatMap((record) => {
    const values = Array.isArray(record.contents) ? record.contents : [record.content ?? record.value].filter(Boolean);
    return values.map((content) => ({ name: String(record.name ?? ""), type: String(record.type ?? record.recordType ?? ""), ttl: Number(record.ttl || 0), content: String(content) }));
  });
  return <div className="space-y-6"><PageHeading title={`DNS Records · ${domainName}`} description="Connect your domain to websites, email and other services." action={<Button variant="outline" asChild><Link href="/dns">Change domain</Link></Button>} />{(error || records.error) && <ErrorState message={error || records.error} retry={records.reload} />}<Card><CardHeader><CardTitle>Add DNS record</CardTitle><CardDescription>Add A, CNAME, MX, TXT or other supported records.</CardDescription></CardHeader><CardContent><form className="grid gap-3 sm:grid-cols-5" onSubmit={add}><Input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Name" /><select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={type} onChange={(event) => setType(event.target.value)}>{["A", "AAAA", "CNAME", "MX", "TXT", "CAA"].map((item) => <option key={item}>{item}</option>)}</select><Input type="number" min={1} max={86400} value={ttl} onChange={(event) => setTtl(Number(event.target.value))} /><Input value={value} onChange={(event) => setValue(event.target.value)} required placeholder="Value" /><Button disabled={pending}>Add record</Button></form></CardContent></Card><Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>DNS records</CardTitle><CardDescription>Publish after completing your changes.</CardDescription></div><Button onClick={apply} disabled={pending}>Publish records</Button></CardHeader><CardContent>{records.loading ? <LoadingState /> : zoneRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-2xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Name</th><th className="pb-3">Type</th><th className="pb-3">TTL</th><th className="pb-3">Value</th><th /></tr></thead><tbody>{zoneRows.map((record, index) => <tr key={`${record.name}-${record.type}-${record.content}-${index}`} className="border-b last:border-0"><td className="py-3 font-medium">{record.name || "@"}</td><td className="py-3"><Badge variant="outline">{record.type}</Badge></td><td className="py-3">{record.ttl || "—"}</td><td className="max-w-sm break-all py-3 font-mono text-xs">{record.content}</td><td className="py-3 text-right"><Button size="sm" variant="outline" disabled={pending} onClick={() => remove(record.name, record.type, record.content)}>Delete</Button></td></tr>)}</tbody></table></div> : <EmptyState title="No DNS records" description="Add the first record to create this domain's DNS zone." />}</CardContent></Card></div>;
}

function findContactHandles(value: unknown, found = new Set<string>(), depth = 0): Set<string> {
  if (depth > 8 || value == null) return found;
  if (Array.isArray(value)) { value.forEach((item) => findContactHandles(item, found, depth + 1)); return found; }
  if (typeof value !== "object") return found;
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (/^(handle|handleCode|contactHandle)$/i.test(key) && typeof item === "string" && item.trim()) found.add(item.trim());
    else findContactHandles(item, found, depth + 1);
  });
  return found;
}

export function Contacts({ token }: { token: string }) {
  const domains = useResource<PageResult<DomainAsset>>(token, "/v1/domain/domains?page=1&limit=100");
  const [selected, setSelected] = useState(""); const [detail, setDetail] = useState<Record<string, unknown> | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [verification, setVerification] = useState<Record<string, Record<string, unknown> | null>>({});
  useEffect(() => { if (!selected) { setDetail(null); return; } let active = true; setLoading(true); setError(""); domainApi<Record<string, unknown>>(token, `/v1/domain/domains/${encodeURIComponent(selected)}`).then((value) => { if (active) setDetail(value); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load contacts."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [selected, token]);
  const handles = useMemo(() => [...findContactHandles(detail)], [detail]);
  const check = async (handle: string) => { setError(""); try { const data = await domainApi<Record<string, unknown>>(token, `/v1/domain/domains/${encodeURIComponent(selected)}/contacts/${encodeURIComponent(handle)}/verification`); setVerification((current) => ({ ...current, [handle]: data })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to check verification."); } };
  const resend = async (handle: string) => { setError(""); try { await domainApi(token, `/v1/domain/domains/${encodeURIComponent(selected)}/contacts/${encodeURIComponent(handle)}/verification/resend`, { method: "POST" }); await check(handle); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to resend verification."); } };
  return <div className="space-y-6"><PageHeading title="Contacts" description="Review registrar handles and prevent verification-related suspension." />{(error || domains.error) && <ErrorState message={error || domains.error} retry={domains.reload} />}<Card><CardHeader><CardTitle>Choose a domain</CardTitle><CardDescription>Contact data is fetched from the registrar only when requested.</CardDescription></CardHeader><CardContent><select className="h-9 w-full max-w-lg rounded-md border bg-transparent px-3 text-sm" value={selected} onChange={(event) => { setSelected(event.target.value); setVerification({}); }}><option value="">Select a domain</option>{domains.data?.items.map((domain) => <option key={domain.domainName} value={domain.domainName}>{domain.domainName}</option>)}</select></CardContent></Card>{loading && <LoadingState />}{selected && !loading && handles.length > 0 && <Card><CardHeader><CardTitle>Registrar contact handles</CardTitle><CardDescription>Check each handle and resend pending verification when required.</CardDescription></CardHeader><CardContent className="space-y-3">{handles.map((handle) => <div key={handle} className="rounded-lg border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{handle}</p><p className="text-xs text-muted-foreground">Contact handle linked to {selected}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => check(handle)}>Check status</Button><Button onClick={() => resend(handle)}>Resend verification</Button></div></div>{verification[handle] && <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(verification[handle], null, 2)}</pre>}</div>)}</CardContent></Card>}{selected && !loading && detail && handles.length === 0 && <EmptyState title="No contact handles returned" description="This registrar response did not expose reusable contact handles for the selected domain." />}{!selected && !domains.loading && !domains.data?.items.length && <EmptyState title="No domain contacts" description="Contacts become available after a registration or transfer." />}</div>;
}

export function OrdersAndBilling({ token }: { token: string }) {
  const orders = useResource<PageResult<DomainOrder>>(token, "/v1/domain/orders?page=1&limit=100"); const wallet = useResource<Wallet>(token, "/v1/domain/wallet");
  return <div className="space-y-6"><PageHeading title="Orders & Billing" description="Domain transactions and SellersLogin credit usage." action={<Button asChild variant="outline"><Link href="/search">New purchase</Link></Button>} /><section className="grid gap-4 sm:grid-cols-3">{[{ label: "Available", value: wallet.data?.availableCredits }, { label: "Reserved", value: wallet.data?.reservedCredits }, { label: "Used", value: wallet.data?.usedCredits }].map((item) => <Card key={item.label}><CardHeader><CardDescription>{item.label} credits</CardDescription><CardTitle className="text-2xl">{wallet.loading || item.value == null ? "—" : `${item.value.toLocaleString("en-IN")} ${wallet.data?.currency}`}</CardTitle></CardHeader></Card>)}</section>{(orders.error || wallet.error) && <ErrorState message={orders.error || wallet.error} retry={() => { orders.reload(); wallet.reload(); }} />}<Card><CardContent className="pt-6">{orders.loading ? <LoadingState /> : orders.data?.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-3xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Domain</th><th className="pb-3">Operation</th><th className="pb-3">Amount</th><th className="pb-3">Date</th><th className="pb-3 text-right">Status</th></tr></thead><tbody>{orders.data.items.map((order) => <tr key={order.orderId} className="border-b last:border-0"><td className="py-4 font-medium">{order.domainName}</td><td className="py-4">{order.operation}</td><td className="py-4">{formatDomainAmount(order.amount, order.currency)}</td><td className="py-4 text-muted-foreground">{formatDomainDate(order.createdAt)}</td><td className="py-4 text-right"><Badge variant={order.status === "COMPLETED" ? "secondary" : "outline"}>{order.status.replaceAll("_", " ")}</Badge></td></tr>)}</tbody></table></div> : <EmptyState title="No billing activity" description="Completed and pending domain orders will appear here." />}</CardContent></Card></div>;
}
