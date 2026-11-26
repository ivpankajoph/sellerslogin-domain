"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { createIdempotencyKey, domainApi, domainNdjsonStream, DomainApiError, formatDomainAmount, formatDomainDate } from "@/lib/domain-api";
import { useDomainResource } from "@/lib/domain-resource";
import { boundedSearchSignal, domainSearchRank, isCurrentDomainSearch, isSuggestionCheckFailed, isVerifiedAvailable, shouldStartDomainSearch } from "@/lib/domain-search-state";

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
  tld?: string;
  unicodeDomainName?: string;
  status: string;
  liveVerified?: boolean;
  estimated?: boolean;
  checkFailed?: boolean;
  reason?: string | null;
  isPremium: boolean;
  isDocumentRequired: boolean;
  period: number;
  pricing: { customerAmount: number | null; customerCurrency: string | null; regularAmount?: number | null; discountAmount?: number; taxCollectionMode?: string; taxRatePercent?: number; taxAmount?: number };
  badges?: Array<"EXACT_MATCH" | "PREMIUM" | "GREAT_ALTERNATIVE">;
  originalPrice?: number | null;
  discountedPrice?: number | null;
  renewalPricing?: { customerAmount: number | null; customerCurrency: string | null } | null;
  renewalPricingStatus?: "NOT_APPLICABLE" | "NOT_LOADED" | "LOADING" | "READY" | "UNKNOWN";
  promotion?: { campaignId: string; name: string; firstYearPrice: number; additionalYearPrice: number; requiredYears: number; bundleSubtotal: number; currency: string } | null;
  metrics?: { upstreamCallCount?: number; cacheHit?: boolean; totalMs?: number };
};
type CatalogueAttribute = {
  name?: string;
  key?: string;
  label?: string;
  description?: string;
  required?: boolean;
  isRequired?: boolean;
  type?: string;
  values?: Array<string | { value?: string; label?: string; name?: string }>;
  options?: Array<string | { value?: string; label?: string; name?: string }>;
};
type TldCheckoutInfo = {
  registrationPeriods: number[];
  attributes?: CatalogueAttribute[];
  capabilities?: { supportsTrustee?: boolean; requiresTrustee?: boolean; mayRequireDocument?: boolean };
};
type PrimarySearchResponse = { exactDomain: string; result: SearchResult };
type SmartStreamEvent =
  | { type: "meta"; candidates: string[]; offset: number; total: number; hasMore: boolean }
  | { type: "result"; result: SearchResult; timing: { lookupMs: number; timedOut: boolean; completedCount: number; elapsedMs: number } }
  | { type: "done"; nextOffset: number; hasMore: boolean; upstreamCallCount: number; errorCount: number; totalMs: number }
  | { type: "error"; message: string };
type RenewalPriceResponse = { domainName: string; renewalPricing: SearchResult["renewalPricing"]; renewalPricingStatus: SearchResult["renewalPricingStatus"] };
type Quote = {
  quoteId: string;
  domainName: string;
  operation?: "RENEW" | "RESTORE";
  period: number;
  expiresAt: string;
  pricing: { customerAmount: number; customerCurrency: string; regularAmount?: number; discountAmount?: number; taxCollectionMode?: string; campaign?: { name: string; firstYearPrice: number; additionalYearPrice: number; requiredYears: number } | null };
};
type RenewalItem = {
  domainName: string;
  unicodeDomainName?: string;
  status?: unknown;
  statusReason?: string;
  expirationDate?: string | null;
  recoveryDeadline?: string | null;
  renewalMode?: string;
  providerAutoRenewRisk: boolean;
  renewalPeriods: number[];
  lifecycle: {
    stage: "ACTIVE" | "DUE_SOON" | "EXPIRED" | "REDEMPTION" | "PENDING_DELETE";
    daysRemaining: number | null;
    canRenew: boolean;
    canRestore: boolean;
    autoRenewGracePeriodDays?: number | null;
    redemptionPeriodDays?: number | null;
  };
  pendingOrder?: { orderId: string; operation: "RENEW" | "RESTORE"; status: string } | null;
};
type RenewalResponse = PageResult<RenewalItem> & { wallet: Wallet };

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
  return useDomainResource<T>(token, path);
}

export function VendorOverview({ token }: { token: string }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [domains, setDomains] = useState<PageResult<DomainAsset> | null>(null);
  const [stats, setStats] = useState<{ total: number; active: number; expiringSoon: number; expired: number; providerAutoRenew: number; actionRequired: number } | null>(null);
  const [orders, setOrders] = useState<PageResult<DomainOrder> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    Promise.allSettled([
      domainApi<Wallet>(token, "/v1/domain/wallet"),
      domainApi<PageResult<DomainAsset>>(token, "/v1/domain/domains?page=1&limit=5"),
      domainApi<PageResult<DomainOrder>>(token, "/v1/domain/orders?page=1&limit=5"),
      domainApi<{ total: number; active: number; expiringSoon: number; expired: number; providerAutoRenew: number; actionRequired: number }>(token, "/v1/domain/dashboard"),
    ]).then(([walletResult, domainResult, orderResult, statsResult]) => {
      if (!active) return;
      if (walletResult.status === "fulfilled") setWallet(walletResult.value);
      if (domainResult.status === "fulfilled") setDomains(domainResult.value);
      if (orderResult.status === "fulfilled") setOrders(orderResult.value);
      if (statsResult.status === "fulfilled") setStats(statsResult.value);
      if ([walletResult, domainResult, orderResult, statsResult].every((result) => result.status === "rejected")) {
        setError("Live dashboard information is temporarily unavailable.");
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, version]);
  const items = domains?.items || [];
  const cards = [
    { label: "Owned domains", value: stats?.total, description: "Domains in your account", icon: Globe2 },
    { label: "Expiring soon", value: stats?.expiringSoon, description: "Within the next 60 days", icon: Clock3 },
    { label: "Need attention", value: stats?.actionRequired, description: "Domains waiting for an action", icon: RefreshCcw },
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

function availabilityLabel(status: string) {
  switch (status) {
    case "PREVIEW": return "Checking availability";
    case "AVAILABLE": return "Available";
    case "NOTAVAILABLE": return "Already taken";
    case "UNSUPPORTEDTLD": return "Extension not supported";
    case "INVALIDDOMAINNAME": return "Invalid domain name";
    case "ERROR": return "Availability check failed";
    case "NONE":
    case "UNKNOWN":
    default: return "Could not verify availability";
  }
}

function markDomainsUnverified(current: SearchResult[], domainNames: string[]): SearchResult[] {
  const targets = new Set(domainNames);
  return current.map((item) => targets.has(item.domainName) && item.liveVerified !== true
    ? { ...item, status: "UNKNOWN", liveVerified: false, checkFailed: true }
    : item);
}

function mergeSearchResults(current: SearchResult[], incoming: SearchResult[]): SearchResult[] {
  const updates = new Map(incoming.map((item) => [item.domainName, item]));
  const merged = current.map((item) => {
    const update = updates.get(item.domainName);
    if (!update) return item;
    if (item.liveVerified === true && update.status === "PREVIEW") return item;
    if (update.liveVerified !== true && item.estimated) {
      return { ...item, status: "UNKNOWN", reason: update.reason, liveVerified: false, checkFailed: true };
    }
    const persistentBadges = (item.badges || []).filter((badge) => badge === "EXACT_MATCH");
    const liveBadges = [
      ...(update.badges || []),
      ...(update.isPremium ? ["PREMIUM" as const] : []),
    ];
    return {
      ...update,
      badges: [...new Set([...persistentBadges, ...liveBadges])],
      checkFailed: isSuggestionCheckFailed(update),
    };
  });
  for (const item of incoming) if (!merged.some((value) => value.domainName === item.domainName)) merged.push(item);
  const normalized: SearchResult[] = merged.map((item) => ({ ...item, badges: (item.badges || []).filter((badge) => badge !== "GREAT_ALTERNATIVE") }));
  const preferred = { in: 0, com: 1, "co.in": 2 } as Record<string, number>;
  const alternative = normalized
    .filter((item) => item.status === "AVAILABLE" && item.liveVerified === true && !item.isPremium && !(item.badges || []).includes("EXACT_MATCH"))
    .sort((left, right) => (preferred[left.domainName.split(".").slice(1).join(".")] ?? 3) - (preferred[right.domainName.split(".").slice(1).join(".")] ?? 3))[0];
  return normalized.map((item) => item.domainName === alternative?.domainName
    ? { ...item, badges: [...(item.badges || []), "GREAT_ALTERNATIVE" as const] }
    : item);
}

export function DomainSearchLoading() {
  return <div role="status" aria-live="polite" aria-label="Checking domain availability" className="divide-y">
    {[0, 1, 2, 3, 4].map((row) => <div key={row} className="flex items-center justify-between gap-4 p-4">
      <div className="flex flex-1 items-center gap-3">
        <div className="h-5 w-32 animate-pulse rounded bg-muted sm:w-44" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="hidden h-9 w-40 animate-pulse rounded-md bg-muted sm:block" />
    </div>)}
    <span className="sr-only">Checking live availability and prices...</span>
  </div>;
}

export function DomainSuggestionRows({ suggestions, selectedDomain, checkoutReady, pending, onSelect, onRetry }: {
  suggestions: SearchResult[];
  selectedDomain?: string;
  checkoutReady: boolean;
  pending: boolean;
  onSelect: (suggestion: SearchResult) => void;
  onRetry?: () => void;
}) {
  const displaySuggestions = suggestions
    .map((suggestion, index) => ({ suggestion, index }))
    .sort((left, right) => {
      return domainSearchRank(left.suggestion) - domainSearchRank(right.suggestion) || left.index - right.index;
    })
    .map(({ suggestion }) => suggestion);
  return <div className="divide-y">{displaySuggestions.map((suggestion) => {
    const available = suggestion.status === "AVAILABLE" && suggestion.liveVerified === true;
    const preview = suggestion.status === "PREVIEW";
    const selected = selectedDomain === suggestion.domainName;
    const smartBadges = suggestion.badges || [];
    return <div key={suggestion.domainName} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{suggestion.domainName}</p>
          <Badge variant={available ? "secondary" : "outline"}>{availabilityLabel(suggestion.status)}</Badge>
          {smartBadges.includes("PREMIUM") && <Badge variant="outline">Premium</Badge>}
          {smartBadges.includes("GREAT_ALTERNATIVE") && <Badge>Great alternative</Badge>}
          {suggestion.promotion && <Badge>Multi-year offer</Badge>}
        </div>
        {suggestion.promotion && <p className="mt-1 text-xs text-muted-foreground">{suggestion.promotion.requiredYears}-year offer · Additional years {formatDomainAmount(suggestion.promotion.additionalYearPrice, suggestion.promotion.currency)} each</p>}
        {suggestion.renewalPricing?.customerAmount != null && <p className="mt-1 text-xs text-muted-foreground">Renews at {formatDomainAmount(suggestion.renewalPricing.customerAmount, suggestion.renewalPricing.customerCurrency)} / year</p>}
        {suggestion.isPremium && suggestion.renewalPricingStatus === "LOADING" && <p className="mt-1 text-xs text-muted-foreground">Checking premium renewal price separately...</p>}
        {suggestion.isPremium && ["NOT_LOADED", "UNKNOWN"].includes(suggestion.renewalPricingStatus || "") && <p className="mt-1 text-xs text-muted-foreground">Premium renewal price is not available yet.</p>}
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:min-w-52 sm:items-end">
        {(available || preview || suggestion.checkFailed) && (suggestion.discountedPrice != null || suggestion.pricing.customerAmount != null) && <div className="text-left sm:text-right">
          {suggestion.promotion && suggestion.originalPrice != null && <span className="mr-2 text-sm text-muted-foreground line-through">{formatDomainAmount(suggestion.originalPrice, suggestion.promotion.currency)}</span>}
          <span className="font-semibold">{formatDomainAmount(suggestion.discountedPrice ?? suggestion.pricing.customerAmount, suggestion.promotion?.currency || suggestion.pricing.customerCurrency)}</span>
          <p className="text-xs text-muted-foreground">{suggestion.promotion ? "for the first year" : `/ ${suggestion.period} ${suggestion.period === 1 ? "year" : "years"}`}</p>
        </div>}
        {available ? <Button onClick={() => onSelect(suggestion)} disabled={pending || (selected && checkoutReady)}>{pending && selected ? <LoaderCircle className="animate-spin" /> : null}{selected && checkoutReady ? "Checkout ready" : "Continue to checkout"}<ArrowRight /></Button>
          : preview ? <Button variant="outline" disabled><LoaderCircle className="animate-spin" />Checking...</Button>
            : suggestion.checkFailed || ["UNKNOWN", "NONE", "ERROR"].includes(suggestion.status) ? <Button variant="outline" onClick={onRetry}><RefreshCcw />Unable to check — Retry</Button> : null}
      </div>
    </div>;
  })}</div>;
}

function DomainPrice({ suggestion }: { suggestion: SearchResult }) {
  const amount = suggestion.discountedPrice ?? suggestion.pricing.customerAmount;
  if (suggestion.liveVerified !== true || suggestion.status !== "AVAILABLE" || amount == null) return null;
  return <div>
    {suggestion.promotion && suggestion.originalPrice != null && <span className="mr-2 text-sm text-muted-foreground line-through">{formatDomainAmount(suggestion.originalPrice, suggestion.promotion.currency)}</span>}
    <span className="text-xl font-semibold tracking-tight">{formatDomainAmount(amount, suggestion.promotion?.currency || suggestion.pricing.customerCurrency)}</span>
    <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.promotion ? "First year offer" : `${suggestion.period}-year registration`}</p>
  </div>;
}

function FeaturedDomainCard({ title, suggestion, loading, selectedDomain, checkoutReady, pending, onSelect, onRetry }: {
  title: string;
  suggestion?: SearchResult;
  loading?: boolean;
  selectedDomain?: string;
  checkoutReady: boolean;
  pending: boolean;
  onSelect: (suggestion: SearchResult) => void;
  onRetry: (suggestion: SearchResult) => void;
}) {
  if (!suggestion && loading) return <Card className="min-h-64 overflow-hidden border-teal-200/80 shadow-sm">
    <CardContent className="space-y-6 p-6">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="h-9 w-56 animate-pulse rounded bg-muted" />
      <div className="mt-12 h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
    </CardContent>
  </Card>;
  if (!suggestion) return <Card className="min-h-64 border-dashed"><CardContent className="flex h-full min-h-64 flex-col justify-center p-6"><Badge variant="outline" className="w-fit">{title}</Badge><p className="mt-4 text-lg font-semibold">No verified alternative yet</p><p className="mt-2 text-sm text-muted-foreground">Load more suggestions to continue checking live availability.</p></CardContent></Card>;

  const available = suggestion.status === "AVAILABLE" && suggestion.liveVerified === true;
  const checking = suggestion.status === "PREVIEW";
  const failed = suggestion.checkFailed || ["UNKNOWN", "NONE", "ERROR"].includes(suggestion.status);
  const selected = selectedDomain === suggestion.domainName;
  return <Card className={`min-h-64 overflow-hidden shadow-sm ${available ? "border-teal-300" : "border-border"}`}>
    <CardContent className="flex min-h-64 flex-col p-6">
      <div className="flex items-center justify-between gap-3"><Badge className={title === "Recommended alternative" ? "bg-amber-100 text-amber-950 hover:bg-amber-100" : ""} variant={title === "Recommended alternative" ? "default" : "outline"}>{title}</Badge>{suggestion.isPremium && <Badge variant="outline">Premium</Badge>}</div>
      <div className="mt-5"><p className="break-all text-2xl font-semibold tracking-tight sm:text-3xl">{suggestion.domainName}</p><p className={`mt-2 text-sm font-medium ${available ? "text-teal-700" : "text-muted-foreground"}`}>{availabilityLabel(suggestion.status)}</p></div>
      <div className="mt-auto pt-8">
        <DomainPrice suggestion={suggestion} />
        <div className="mt-4">
          {available ? <Button className="w-full bg-teal-700 text-white hover:bg-teal-800" onClick={() => onSelect(suggestion)} disabled={pending || (selected && checkoutReady)}>{pending && selected ? <LoaderCircle className="animate-spin" /> : null}{selected && checkoutReady ? "Checkout ready" : "Continue to checkout"}<ArrowRight /></Button>
            : checking ? <Button className="w-full" variant="outline" disabled><LoaderCircle className="animate-spin" />Checking live availability</Button>
              : failed ? <Button className="w-full" variant="outline" onClick={() => onRetry(suggestion)}><RefreshCcw />Unable to check — Retry</Button>
                : <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">This domain is not available for registration.</p>}
        </div>
      </div>
    </CardContent>
  </Card>;
}

function CompactSuggestionRows({ suggestions, selectedDomain, checkoutReady, pending, onSelect, onRetry }: {
  suggestions: SearchResult[];
  selectedDomain?: string;
  checkoutReady: boolean;
  pending: boolean;
  onSelect: (suggestion: SearchResult) => void;
  onRetry: (suggestion: SearchResult) => void;
}) {
  return <div className="divide-y">{suggestions.map((suggestion) => {
    const available = suggestion.status === "AVAILABLE" && suggestion.liveVerified === true;
    const checking = suggestion.status === "PREVIEW";
    const failed = suggestion.checkFailed || ["UNKNOWN", "NONE", "ERROR"].includes(suggestion.status);
    const selected = selectedDomain === suggestion.domainName;
    return <div key={suggestion.domainName} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6">
      <div className="min-w-0"><p className="truncate font-semibold">{suggestion.domainName}</p><div className="mt-1 flex items-center gap-2"><span className={`size-2 rounded-full ${available ? "bg-teal-500" : checking ? "animate-pulse bg-amber-400" : failed ? "bg-rose-400" : "bg-slate-400"}`} /><span className="text-xs text-muted-foreground">{availabilityLabel(suggestion.status)}</span>{suggestion.isPremium && <Badge variant="outline">Premium</Badge>}</div></div>
      <div className="sm:min-w-40 sm:text-right">{available ? <DomainPrice suggestion={suggestion} /> : checking ? <div className="h-6 w-28 animate-pulse rounded bg-muted" /> : null}</div>
      <div className="sm:w-44">{available ? <Button className="w-full" variant="outline" onClick={() => onSelect(suggestion)} disabled={pending || (selected && checkoutReady)}>{selected && checkoutReady ? "Checkout ready" : "Choose"}<ArrowRight /></Button> : checking ? <Button className="w-full" variant="outline" disabled><LoaderCircle className="animate-spin" />Checking</Button> : failed ? <Button className="w-full" variant="outline" onClick={() => onRetry(suggestion)}><RefreshCcw />Retry</Button> : null}</div>
    </div>;
  })}</div>;
}

const contactLabels: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  companyName: "Company name (optional)",
  eMail: "Email address",
  address: "Street address",
  city: "City",
  state: "State or province",
  postalCode: "Postal code",
  country: "Country code",
  phoneCountryCode: "Phone country code",
  phone: "Phone number",
};

const attributeName = (attribute: CatalogueAttribute) => String(attribute.name || attribute.key || "").trim();
const attributeLabel = (attribute: CatalogueAttribute) => String(attribute.label || attribute.description || attributeName(attribute)).trim();
const attributeOptions = (attribute: CatalogueAttribute) => attribute.options || attribute.values || [];

function RegistrationCheckoutFields({ catalogue, result, quote, contact, pending, attributes, onContact, onAttributes, onPeriod }: {
  catalogue: TldCheckoutInfo | null;
  result: SearchResult;
  quote: Quote;
  contact: typeof emptyContact;
  pending: boolean;
  attributes: Record<string, string | number | boolean>;
  onContact: (value: typeof emptyContact) => void;
  onAttributes: (value: Record<string, string | number | boolean>) => void;
  onPeriod: (period: number) => void;
}) {
  const periods = result.isPremium
    ? [1]
    : Array.from(new Set((catalogue?.registrationPeriods?.length ? catalogue.registrationPeriods : [quote.period]).map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= 10))).sort((a, b) => a - b);
  const visibleAttributes = (catalogue?.attributes || []).filter((attribute) => attributeName(attribute));
  const requiresTrustee = Boolean(catalogue?.capabilities?.requiresTrustee);
  return <>
    <div className="rounded-lg border bg-muted/20 p-4 sm:col-span-2">
      <Label htmlFor="registration-period">Registration period</Label>
      <select id="registration-period" className="mt-2 h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm" value={quote.period} disabled={pending || Boolean(quote.pricing.campaign) || result.isPremium} onChange={(event) => onPeriod(Number(event.target.value))}>
        {periods.map((value) => <option key={value} value={value}>{value} {value === 1 ? "year" : "years"}</option>)}
      </select>
      {result.isPremium && <p className="mt-2 text-xs text-muted-foreground">This premium domain can be registered for one year at a time.</p>}
      {quote.pricing.campaign && <p className="mt-2 text-xs text-muted-foreground">This offer uses a fixed {quote.period}-year registration period.</p>}
    </div>
    {Object.entries(contact).map(([key, value]) => <div key={key} className="space-y-2"><Label htmlFor={key}>{contactLabels[key] || key}</Label><Input id={key} type={key === "eMail" ? "email" : "text"} value={value} required={key !== "companyName"} placeholder={key === "country" ? "IN" : key === "phoneCountryCode" ? "91" : undefined} onChange={(event) => onContact({ ...contact, [key]: event.target.value })} /></div>)}
    {visibleAttributes.length > 0 && <div className="space-y-4 rounded-lg border p-4 sm:col-span-2"><div><p className="font-medium">Additional domain details</p><p className="text-sm text-muted-foreground">This domain ending needs a few extra details before it can be registered.</p></div><div className="grid gap-4 sm:grid-cols-2">{visibleAttributes.map((attribute) => { const name = attributeName(attribute); const options = attributeOptions(attribute); const required = Boolean(attribute.required || attribute.isRequired); return <div key={name} className="space-y-2"><Label htmlFor={`attribute-${name}`}>{attributeLabel(attribute)}{required ? " *" : ""}</Label>{options.length ? <select id={`attribute-${name}`} className="h-9 w-full rounded-md border bg-background px-3 text-sm" required={required} value={String(attributes[name] ?? "")} onChange={(event) => onAttributes({ ...attributes, [name]: event.target.value })}><option value="">Select an option</option>{options.map((option) => { const value = typeof option === "string" ? option : String(option.value || option.name || ""); const label = typeof option === "string" ? option : String(option.label || option.name || option.value || ""); return <option key={value} value={value}>{label}</option>; })}</select> : <Input id={`attribute-${name}`} required={required} value={String(attributes[name] ?? "")} onChange={(event) => onAttributes({ ...attributes, [name]: event.target.value })} />}</div>; })}</div></div>}
    {(result.isDocumentRequired || catalogue?.capabilities?.mayRequireDocument) && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:col-span-2"><p className="font-medium">Verification documents may be needed</p><p className="mt-1">After the purchase, open Documents &amp; Verification and upload the requested files. The domain becomes active after the review is completed.</p></div>}
    {requiresTrustee && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:col-span-2"><p className="font-medium">Local contact service is required</p><p className="mt-1">Please raise a support ticket before purchasing this domain so the exact total can be confirmed.</p></div>}
  </>;
}

export function SearchAndBuy({ token }: { token: string }) {
  const [query, setQuery] = useState(""); const [suggestions, setSuggestions] = useState<SearchResult[]>([]); const [result, setResult] = useState<SearchResult | null>(null); const [quote, setQuote] = useState<Quote | null>(null);
  const [contact, setContact] = useState(emptyContact); const [registrationAttributes, setRegistrationAttributes] = useState<Record<string, string | number | boolean>>({}); const [searching, setSearching] = useState(false); const [submittedQuery, setSubmittedQuery] = useState(""); const [searchError, setSearchError] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [order, setOrder] = useState<DomainOrder | null>(null);
  const [alternativeDomain, setAlternativeDomain] = useState("");
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(false);
  const [nextSuggestionOffset, setNextSuggestionOffset] = useState(0);
  const [loadingMoreSuggestions, setLoadingMoreSuggestions] = useState(false);
  const [searchMetrics, setSearchMetrics] = useState<{ exactMs?: number; firstAlternativeMs?: number; firstSuggestionMs?: number; firstFiveMs?: number; upstreamCallCount: number; errorCount: number }>({ upstreamCallCount: 0, errorCount: 0 });
  const [purchaseKey, setPurchaseKey] = useState("");
  const [purchaseToast, setPurchaseToast] = useState<{ title: string; message: string } | null>(null);
  const selectedTld = result ? result.tld || result.domainName.split(".").slice(-1)[0] : "";
  const checkoutCatalogue = useDomainResource<TldCheckoutInfo>(token, selectedTld ? `/v1/domain/catalogue/${encodeURIComponent(selectedTld)}` : "", 60_000);
  const latestSearchId = useRef(0);
  const activeSearch = useRef<{ query: string; controller: AbortController; pending: boolean } | null>(null);
  const renewalRequests = useRef(new Set<string>());
  const searchStartedAt = useRef(0);
  const initialCompleted = useRef(new Set<string>());
  const loadMoreAnchor = useRef<HTMLDivElement | null>(null);
  const loadMoreRequest = useRef<() => Promise<void>>(async () => {});
  const autoLoadedSearchId = useRef(0);
  const searchQuery = query.trim();
  useEffect(() => () => activeSearch.current?.controller.abort(), []);

  const fallbackPrimaryName = (value: string) => {
    const cleaned = value.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/\.$/, "");
    return cleaned.includes(".") ? cleaned : `${cleaned}.com`;
  };

  const loadRenewalPrices = (items: SearchResult[], controller: AbortController, searchId: number) => {
    for (const item of items.filter((value) => value.liveVerified === true && value.status === "AVAILABLE" && value.isPremium)) {
      if (renewalRequests.current.has(item.domainName)) continue;
      renewalRequests.current.add(item.domainName);
      setSuggestions((current) => current.map((value) => value.domainName === item.domainName ? { ...value, renewalPricingStatus: "LOADING" } : value));
      void domainApi<RenewalPriceResponse>(token, "/v1/domain/search/premium-renewal", {
        method: "POST",
        signal: boundedSearchSignal(controller.signal, 12_000),
        body: JSON.stringify({ domainName: item.domainName }),
      }).then((renewal) => {
        if (latestSearchId.current !== searchId) return;
        setSuggestions((current) => current.map((value) => value.domainName === renewal.domainName ? { ...value, renewalPricing: renewal.renewalPricing, renewalPricingStatus: renewal.renewalPricingStatus } : value));
      }).catch(() => {
        if (latestSearchId.current === searchId) setSuggestions((current) => current.map((value) => value.domainName === item.domainName ? { ...value, renewalPricingStatus: "UNKNOWN" } : value));
      });
    }
  };

  const previewResult = (domainName: string, exact = false): SearchResult => ({
    domainName,
    status: "PREVIEW",
    liveVerified: false,
    estimated: false,
    checkFailed: false,
    isPremium: false,
    isDocumentRequired: false,
    period: 1,
    pricing: { customerAmount: null, customerCurrency: null },
    badges: exact ? ["EXACT_MATCH"] : [],
    renewalPricingStatus: "UNKNOWN",
  });

  const streamSuggestionPage = async ({ currentQuery, offset, searchId, controller, initial }: { currentQuery: string; offset: number; searchId: number; controller: AbortController; initial: boolean }) => {
    const pageDomains: string[] = [];
    if (!initial) setLoadingMoreSuggestions(true);
    const isCurrent = () => isCurrentDomainSearch(latestSearchId.current, searchId, controller.signal.aborted);
    try {
      await domainNdjsonStream<SmartStreamEvent>(
        token,
        "/v1/domain/search/smart/suggestions/stream",
        { query: currentQuery, offset, limit: 5 },
        boundedSearchSignal(controller.signal, 25_000),
        async (event) => {
          if (!isCurrent()) return;
          if (event.type === "meta") {
            pageDomains.push(...event.candidates);
            setSuggestions((current) => mergeSearchResults(current, event.candidates.map((domainName) => previewResult(domainName))));
            setHasMoreSuggestions(event.hasMore);
            setNextSuggestionOffset(event.offset + event.candidates.length);
          } else if (event.type === "result") {
            setSuggestions((current) => mergeSearchResults(current, [event.result]));
            loadRenewalPrices([event.result], controller, searchId);
            const elapsedMs = Math.round(performance.now() - searchStartedAt.current);
            if (initial) initialCompleted.current.add(event.result.domainName);
            setSearchMetrics((current) => ({
              ...current,
              firstSuggestionMs: current.firstSuggestionMs ?? elapsedMs,
              firstFiveMs: current.firstFiveMs ?? (initialCompleted.current.size >= 5 ? elapsedMs : undefined),
            }));
            if (isVerifiedAvailable(event.result)) {
              setAlternativeDomain((current) => current || event.result.domainName);
              setSearchMetrics((metrics) => ({ ...metrics, firstAlternativeMs: metrics.firstAlternativeMs ?? elapsedMs }));
            }
          } else if (event.type === "done") {
            setHasMoreSuggestions(event.hasMore);
            setNextSuggestionOffset(event.nextOffset);
            setSearchMetrics((current) => ({ ...current, upstreamCallCount: current.upstreamCallCount + event.upstreamCallCount, errorCount: current.errorCount + event.errorCount }));
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        },
      );
    } catch {
      if (!isCurrent()) return;
      setSuggestions((current) => markDomainsUnverified(current, pageDomains));
      setSearchMetrics((current) => ({ ...current, errorCount: current.errorCount + Math.max(pageDomains.length, 1) }));
      setSearchError("Some suggestions could not be checked. Please try again.");
    } finally {
      if (isCurrent() && !initial) setLoadingMoreSuggestions(false);
    }
  };

  const runSearch = async (submittedQuery: string) => {
    const currentQuery = submittedQuery.trim();
    if (currentQuery.length < 2) return;
    if (!shouldStartDomainSearch(activeSearch.current?.query || null, Boolean(activeSearch.current?.pending && !activeSearch.current.controller.signal.aborted), currentQuery)) return;

    activeSearch.current?.controller.abort();
    const controller = new AbortController();
    const searchId = ++latestSearchId.current;
    activeSearch.current = { query: currentQuery, controller, pending: true };
    setSubmittedQuery(currentQuery);
    renewalRequests.current.clear();
    initialCompleted.current.clear();
    autoLoadedSearchId.current = 0;
    searchStartedAt.current = performance.now();
    setAlternativeDomain(""); setHasMoreSuggestions(false); setNextSuggestionOffset(0); setLoadingMoreSuggestions(false); setSearchMetrics({ upstreamCallCount: 0, errorCount: 0 });
    const exactDomain = fallbackPrimaryName(currentQuery);
    setResult(null); setQuote(null); setOrder(null); setError(""); setSearchError(""); setSuggestions([previewResult(exactDomain, true)]); setSearching(true);
    const isCurrent = () => isCurrentDomainSearch(latestSearchId.current, searchId, controller.signal.aborted);
    const request = <T,>(path: string, timeoutMs: number) => domainApi<T>(token, path, {
      method: "POST",
      signal: boundedSearchSignal(controller.signal, timeoutMs),
      body: JSON.stringify({ query: currentQuery }),
    });

    const primaryTask = request<PrimarySearchResponse>("/v1/domain/search/smart/primary", 25_000)
      .then((primary) => {
        if (!isCurrent()) return;
        const exact = { ...primary.result, badges: [...new Set([...(primary.result.badges || []), "EXACT_MATCH" as const])] };
        setSuggestions((current) => mergeSearchResults(current, [exact]));
        setSearchMetrics((current) => ({ ...current, exactMs: Math.round(performance.now() - searchStartedAt.current), upstreamCallCount: current.upstreamCallCount + Number(exact.metrics?.upstreamCallCount || 0) }));
        loadRenewalPrices([exact], controller, searchId);
      })
      .catch((cause) => {
        if (!isCurrent()) return;
        const domainName = exactDomain;
        setSuggestions((current) => mergeSearchResults(current, [{
          domainName, status: "UNKNOWN", liveVerified: false, checkFailed: true, reason: cause instanceof Error ? cause.message : "Availability could not be checked.",
          isPremium: false, isDocumentRequired: false, period: 1, pricing: { customerAmount: null, customerCurrency: null }, badges: ["EXACT_MATCH"], renewalPricingStatus: "UNKNOWN",
        }]));
        setSearchMetrics((current) => ({ ...current, exactMs: Math.round(performance.now() - searchStartedAt.current), errorCount: current.errorCount + 1 }));
      });

    const suggestionsTask = streamSuggestionPage({ currentQuery, offset: 0, searchId, controller, initial: true });

    await Promise.allSettled([primaryTask, suggestionsTask]);
    if (isCurrent()) {
      setSearching(false);
      activeSearch.current = { query: currentQuery, controller, pending: false };
    }
  };

  const searchDomain = (event: FormEvent) => { event.preventDefault(); void runSearch(searchQuery); };

  const loadMore = async () => {
    const active = activeSearch.current;
    if (!active || !hasMoreSuggestions || loadingMoreSuggestions) return;
    await streamSuggestionPage({ currentQuery: active.query, offset: nextSuggestionOffset, searchId: latestSearchId.current, controller: active.controller, initial: false });
  };
  useEffect(() => {
    loadMoreRequest.current = loadMore;
  });

  useEffect(() => {
    const node = loadMoreAnchor.current;
    if (!node || !hasMoreSuggestions || loadingMoreSuggestions || autoLoadedSearchId.current === latestSearchId.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      autoLoadedSearchId.current = latestSearchId.current;
      observer.disconnect();
      void loadMoreRequest.current();
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreSuggestions, loadingMoreSuggestions, nextSuggestionOffset]);

  const retrySuggestion = async (suggestion: SearchResult) => {
    const active = activeSearch.current;
    if (!active) return;
    const searchId = latestSearchId.current;
    setSuggestions((current) => current.map((item) => item.domainName === suggestion.domainName ? { ...item, status: "PREVIEW", liveVerified: false, checkFailed: false } : item));
    try {
      const value = await domainApi<SearchResult>(token, "/v1/domain/search", {
        method: "POST",
        signal: boundedSearchSignal(active.controller.signal, 10_000),
        body: JSON.stringify({ domainName: suggestion.domainName }),
      });
      if (!isCurrentDomainSearch(latestSearchId.current, searchId, active.controller.signal.aborted)) return;
      const verified = !["UNKNOWN", "NONE", "ERROR"].includes(value.status);
      const next = { ...value, liveVerified: verified, checkFailed: !verified, badges: suggestion.badges || [], renewalPricingStatus: value.isPremium ? "NOT_LOADED" as const : "NOT_APPLICABLE" as const };
      setSuggestions((current) => mergeSearchResults(current, [next]));
      loadRenewalPrices([next], active.controller, searchId);
    } catch {
      if (latestSearchId.current === searchId) setSuggestions((current) => markDomainsUnverified(current, [suggestion.domainName]));
    }
  };
  const createQuote = async (selected: SearchResult) => {
    setResult(selected); setQuote(null); setOrder(null); setPurchaseKey(""); setRegistrationAttributes({}); setPending(true); setError("");
    try {
      const quoteRequest = (usePromotion: boolean) => domainApi<Quote>(token, "/v1/domain/quotes/registration", {
        method: "POST",
        body: JSON.stringify({
          domainName: selected.domainName,
          period: usePromotion ? selected.promotion?.requiredYears || selected.period : selected.period,
          campaignId: usePromotion ? selected.promotion?.campaignId : undefined,
        }),
      });
      let nextQuote: Quote;
      try {
        nextQuote = await quoteRequest(Boolean(selected.promotion));
      } catch (cause) {
        const promotionUnavailable = cause instanceof DomainApiError
          && ["DOMAIN_CAMPAIGN_MARGIN_GUARD", "DOMAIN_CAMPAIGN_UNAVAILABLE"].includes(cause.code);
        if (!selected.promotion || !promotionUnavailable) throw cause;
        nextQuote = await quoteRequest(false);
        const withoutPromotion: SearchResult = {
          ...selected,
          promotion: null,
          originalPrice: null,
          discountedPrice: selected.pricing.customerAmount,
        };
        setResult(withoutPromotion);
        setSuggestions((current) => current.map((item) => item.domainName === selected.domainName ? withoutPromotion : item));
      }
      setQuote(nextQuote);
      setPurchaseKey(createIdempotencyKey("domain-register"));
      window.requestAnimationFrame(() => document.getElementById("domain-checkout-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create quote.");
    } finally {
      setPending(false);
    }
  };
  const changeRegistrationPeriod = async (period: number) => {
    if (!result || period === quote?.period) return;
    setPending(true); setError("");
    try {
      const nextQuote = await domainApi<Quote>(token, "/v1/domain/quotes/registration", {
        method: "POST",
        body: JSON.stringify({ domainName: result.domainName, period }),
      });
      setQuote(nextQuote);
      setPurchaseKey(createIdempotencyKey("domain-register"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The price for this period could not be loaded.");
    } finally {
      setPending(false);
    }
  };
  const purchase = async (event: FormEvent) => { event.preventDefault(); if (!quote || !purchaseKey) return; if (checkoutCatalogue.data?.capabilities?.requiresTrustee) { setPurchaseToast({ title: "Support confirmation required", message: "Please raise a support ticket so the exact local contact service total can be confirmed before purchase." }); return; } setError(""); setPurchaseToast(null); setPending(true); try { const currentWallet = await domainApi<Wallet>(token, "/v1/domain/wallet"); if (currentWallet.availableCredits < quote.pricing.customerAmount) { const shortfall = quote.pricing.customerAmount - currentWallet.availableCredits; setPurchaseToast({ title: "Insufficient credits", message: `Please add ${formatDomainAmount(shortfall, quote.pricing.customerCurrency)} more credits to purchase this domain.` }); return; } const contacts = ["Registrant", "Admin", "Tech", "Billing"].map((contactType) => ({ ...contact, contactType })); const value = await domainApi<DomainOrder>(token, "/v1/domain/purchases/registration", { method: "POST", headers: { "Idempotency-Key": purchaseKey }, body: JSON.stringify({ quoteId: quote.quoteId, contacts, tldAttributes: registrationAttributes, useTrusteeContact: false }) }); setOrder(value); } catch (cause) { const message = cause instanceof Error ? cause.message : "The domain purchase could not be completed."; const code = cause instanceof DomainApiError ? cause.code : ""; setPurchaseToast({ title: code === "INSUFFICIENT_DOMAIN_CREDITS" ? "Insufficient credits" : code === "DOMAIN_NAMESERVERS_NOT_CONFIGURED" ? "Domain purchase unavailable" : "Purchase could not be completed", message }); } finally { setPending(false); } };
  const exactSuggestion = suggestions.find((item) => (item.badges || []).includes("EXACT_MATCH"));
  const alternativeSuggestion = suggestions.find((item) => item.domainName === alternativeDomain && isVerifiedAvailable(item));
  const compactSuggestions = suggestions.filter((item) => !(item.badges || []).includes("EXACT_MATCH") && item.domainName !== alternativeDomain);
  const alternativeLoading = !alternativeSuggestion && (searching || loadingMoreSuggestions || suggestions.some((item) => !(item.badges || []).includes("EXACT_MATCH") && item.status === "PREVIEW"));
  return <div className="space-y-6"><PageHeading title="Search & Buy Domain" description="Type a name to see live availability and prices." />
    {purchaseToast && <div role="alert" aria-live="assertive" className="fixed top-5 right-5 z-50 flex w-[calc(100%-2.5rem)] max-w-md items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-lg"><TriangleAlert className="mt-0.5 size-5 shrink-0" /><div className="min-w-0 flex-1"><p className="font-medium">{purchaseToast.title}</p><p className="mt-1 text-sm">{purchaseToast.message}</p></div><button type="button" onClick={() => setPurchaseToast(null)} className="rounded-md px-2 py-1 text-sm font-medium hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600">Dismiss</button></div>}
    <Card className="border-primary/40 bg-primary/10"><CardContent><form className="flex flex-col gap-2 sm:flex-row" onSubmit={searchDomain}><div className="relative flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} required autoComplete="off" placeholder="Type your domain name" className="h-11 pl-9" aria-label="Domain name" /></div><Button className="h-11 bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-700 disabled:text-white disabled:opacity-70 sm:px-6" disabled={searchQuery.length < 2}>{searching ? <LoaderCircle className="animate-spin" /> : <Search />}{searching ? "Searching" : "Search Domains"}</Button></form></CardContent></Card>
    {!submittedQuery && <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-950 text-white shadow-lg"><CardContent className="p-0"><div className="grid min-h-80 lg:grid-cols-[1.3fr_0.7fr]"><div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12"><Badge className="mb-5 w-fit border-white/20 bg-white/10 text-white hover:bg-white/10">SellersLogin Domains</Badge><h3 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Your next big idea deserves the right domain.</h3><p className="mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base">Search your business name and compare available domain options. Any eligible first-year or multi-year discount is applied automatically.</p><div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/85"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-300" />Clear total before purchase</span><span className="flex items-center gap-2"><WalletCards className="size-4 text-emerald-300" />Pay with wallet credits</span><span className="flex items-center gap-2"><Globe2 className="size-4 text-emerald-300" />DNS tools included</span></div></div><div className="m-5 flex flex-col justify-center rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm lg:m-7"><p className="text-sm font-medium text-emerald-200">Popular domain endings</p><p className="mt-2 text-lg font-semibold">Search a name with any popular ending.</p><div className="mt-5 grid grid-cols-2 gap-3">{["com", "in", "co.in", "net"].map((extension) => <div key={extension} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-semibold"><span className="text-emerald-200">.</span>{extension}</div>)}</div><p className="mt-5 text-xs leading-5 text-white/65">Offer duration, later-year price and the full amount payable are shown before checkout.</p></div></div></CardContent></Card>}
    {searchError && <ErrorState message={searchError} retry={() => { setSearchError(""); void runSearch(submittedQuery); }} />}
    {error && <ErrorState message={error} />}
    {submittedQuery && <section className="space-y-6" aria-live="polite">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeaturedDomainCard title="Your searched domain" suggestion={exactSuggestion} loading={!exactSuggestion} selectedDomain={result?.domainName} checkoutReady={Boolean(quote)} pending={pending} onSelect={createQuote} onRetry={retrySuggestion} />
        <FeaturedDomainCard title="Recommended alternative" suggestion={alternativeSuggestion} loading={alternativeLoading} selectedDomain={result?.domainName} checkoutReady={Boolean(quote)} pending={pending} onSelect={createQuote} onRetry={retrySuggestion} />
      </div>
      <Card className="overflow-hidden">
        {/* <CardHeader className="border-b bg-muted/20"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><CardTitle>More domain suggestions</CardTitle><CardDescription>Live availability and your SellersLogin price appear as each check completes.</CardDescription></div><p className="text-xs text-muted-foreground">{searchMetrics.firstFiveMs ? `First 5 completed in ${(searchMetrics.firstFiveMs / 1000).toFixed(1)}s` : searching ? "Checking priority suggestions…" : `${compactSuggestions.length} suggestions checked`}</p></div></CardHeader> */}
        <CardContent className="p-0">{compactSuggestions.length ? <CompactSuggestionRows suggestions={compactSuggestions} selectedDomain={result?.domainName} checkoutReady={Boolean(quote)} pending={pending} onSelect={createQuote} onRetry={retrySuggestion} /> : <div className="p-8 text-center text-sm text-muted-foreground">Suggestions will appear here as live checks start.</div>}</CardContent>
        <div ref={loadMoreAnchor} className="border-t p-4 text-center">
          {hasMoreSuggestions ? <Button type="button" variant="outline" onClick={() => void loadMore()} disabled={loadingMoreSuggestions}>{loadingMoreSuggestions ? <LoaderCircle className="animate-spin" /> : <RefreshCcw />}{loadingMoreSuggestions ? "Checking more…" : "Show more suggestions"}</Button> : <p className="text-xs text-muted-foreground">All requested suggestions have been checked.</p>}
        </div>
      </Card>
    </section>}
    {quote && result && !order && <Card id="domain-checkout-form"><CardHeader><CardTitle>Registration details</CardTitle><CardDescription>Complete the owner details for {quote.domainName}. You can change nameservers after purchase.</CardDescription></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={purchase}><RegistrationCheckoutFields catalogue={checkoutCatalogue.data} result={result} quote={quote} contact={contact} pending={pending} attributes={registrationAttributes} onContact={setContact} onAttributes={setRegistrationAttributes} onPeriod={(value) => void changeRegistrationPeriod(value)} />{checkoutCatalogue.error && <div className="sm:col-span-2"><ErrorState message="Some registration requirements could not be loaded. Please try again before purchasing." retry={checkoutCatalogue.reload} /></div>}<div className="rounded-md border bg-muted/30 p-4 sm:col-span-2">{quote.pricing.campaign && <div className="mb-3 space-y-1 text-sm"><div className="flex justify-between"><span>First year promotional price</span><span>{formatDomainAmount(quote.pricing.campaign.firstYearPrice, quote.pricing.customerCurrency)}</span></div><div className="flex justify-between"><span>Additional {quote.pricing.campaign.requiredYears - 1} years</span><span>{formatDomainAmount(quote.pricing.campaign.additionalYearPrice * (quote.pricing.campaign.requiredYears - 1), quote.pricing.customerCurrency)}</span></div></div>}<div className="flex flex-col justify-between gap-3 border-t pt-3 sm:flex-row sm:items-center"><div><p className="font-medium">Total: {formatDomainAmount(quote.pricing.customerAmount, quote.pricing.customerCurrency)}</p><p className="text-xs text-muted-foreground">{quote.period}-year term · Paid from SellersLogin credits · Price available until {formatDomainDate(quote.expiresAt)}</p></div><Button disabled={pending || checkoutCatalogue.loading || Boolean(checkoutCatalogue.error) || Boolean(checkoutCatalogue.data?.capabilities?.requiresTrustee)}>{pending || checkoutCatalogue.loading ? <LoaderCircle className="animate-spin" /> : <CreditCard />}Confirm Purchase</Button></div></div></form></CardContent></Card>}
    {order && <Card className="border-primary"><CardContent className="flex flex-col justify-between gap-4 py-6 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><CheckCircle2 className="size-5 text-primary" /><div><p className="font-medium">{order.status === "COMPLETED" ? "Your domain purchase is complete" : "Your domain order is being processed"}</p><p className="mt-1 text-sm text-muted-foreground">Order reference: {order.orderId}</p>{result?.isDocumentRequired && <p className="mt-1 text-sm text-amber-700">Upload the requested verification files to complete the registration.</p>}</div></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/orders/${encodeURIComponent(order.orderId)}`}>View Order</Link></Button>{result?.isDocumentRequired && <Button asChild><Link href="/documents">Upload Documents</Link></Button>}</div></CardContent></Card>}
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
  const renewals = useResource<RenewalResponse>(token, "/v1/domain/renewals?page=1&limit=100");
  const [selected, setSelected] = useState<RenewalItem | null>(null);
  const [period, setPeriod] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [action, setAction] = useState<"RENEW" | "RESTORE">("RENEW");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const checkoutKeys = useRef(new Map<string, string>());

  const selectDomain = (item: RenewalItem) => {
    const periods = [...(item.renewalPeriods.length ? item.renewalPeriods : [1])].sort((a, b) => a - b);
    setSelected({ ...item, renewalPeriods: periods }); setQuote(null); setError(""); setMessage("");
    setPeriod(periods.includes(1) ? 1 : periods[0]);
    setAction(item.lifecycle.canRestore ? "RESTORE" : "RENEW");
  };

  const getQuote = async () => {
    if (!selected) return;
    setPending(true); setError(""); setMessage("");
    try {
      const restoring = selected.lifecycle.canRestore;
      const path = restoring ? "/v1/domain/quotes/restore" : "/v1/domain/quotes/renewal";
      const body = restoring ? { domainName: selected.domainName } : { domainName: selected.domainName, period };
      const value = await domainApi<Quote>(token, path, { method: "POST", body: JSON.stringify(body) });
      setAction(restoring ? "RESTORE" : "RENEW"); setQuote(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The latest renewal price could not be loaded."); }
    finally { setPending(false); }
  };

  const confirm = async () => {
    if (!quote) return;
    setPending(true); setError("");
    try {
      if (!checkoutKeys.current.has(quote.quoteId)) checkoutKeys.current.set(quote.quoteId, createIdempotencyKey(`domain-${action.toLowerCase()}`));
      const order = await domainApi<DomainOrder>(token, action === "RESTORE" ? "/v1/domain/purchases/restore" : "/v1/domain/purchases/renewal", {
        method: "POST",
        headers: { "Idempotency-Key": checkoutKeys.current.get(quote.quoteId)! },
        body: JSON.stringify({ quoteId: quote.quoteId }),
      });
      setMessage(`${action === "RESTORE" ? "Recovery" : "Renewal"} order ${order.status.replaceAll("_", " ").toLowerCase()}.`);
      setQuote(null); setSelected(null); renewals.reload();
    } catch (cause) { if (cause instanceof DomainApiError && cause.code === "INSUFFICIENT_DOMAIN_CREDITS") { setQuote(null); renewals.reload(); } setError(cause instanceof Error ? cause.message : `${action === "RESTORE" ? "Recovery" : "Renewal"} could not be completed.`); }
    finally { setPending(false); }
  };

  const stageLabel = (item: RenewalItem) => ({ ACTIVE: "Active", DUE_SOON: `${Math.max(item.lifecycle.daysRemaining || 0, 0)} days left`, EXPIRED: "Expired", REDEMPTION: "Redemption", PENDING_DELETE: "Pending deletion" }[item.lifecycle.stage]);
  const renewalModeLabel = (mode?: string) => ({ autorenew: "Automatic renewal", autoexpire: "Manual renewal", autodelete: "Delete at expiry" }[String(mode || "").toLowerCase()] || "Sync pending");

  return <div className="space-y-6">
    <PageHeading title="Renewals" description="Check validity, get the latest price and renew using SellersLogin credits." action={<Button variant="outline" onClick={renewals.reload}><RefreshCcw />Refresh</Button>} />
    {(error || renewals.error) && <ErrorState message={error || renewals.error} retry={renewals.reload} />}
    {message && <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">{message}</div>}
    <section className="grid gap-4 sm:grid-cols-3">
      <Card><CardHeader><CardDescription>Available credits</CardDescription><CardTitle>{renewals.data ? formatDomainAmount(renewals.data.wallet.availableCredits, renewals.data.wallet.currency) : "—"}</CardTitle></CardHeader></Card>
      <Card><CardHeader><CardDescription>Reserved credits</CardDescription><CardTitle>{renewals.data ? formatDomainAmount(renewals.data.wallet.reservedCredits, renewals.data.wallet.currency) : "—"}</CardTitle></CardHeader></Card>
      <Card><CardHeader><CardDescription>Domains tracked</CardDescription><CardTitle>{renewals.data?.total ?? "—"}</CardTitle></CardHeader></Card>
    </section>
    {renewals.loading ? <Card><CardContent><LoadingState /></CardContent></Card> : renewals.data?.items.length ? <div className="grid gap-4">
      {renewals.data.items.map((item) => <Card key={item.domainName} className={selected?.domainName === item.domainName ? "border-primary/50" : ""}><CardContent className="grid gap-4 py-5 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.unicodeDomainName || item.domainName}</p><Badge variant={item.lifecycle.stage === "ACTIVE" ? "secondary" : "outline"}>{stageLabel(item)}</Badge>{item.pendingOrder && <Badge variant="outline">{item.pendingOrder.status.replaceAll("_", " ")}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{item.expirationDate ? `Valid until ${formatDomainDate(item.expirationDate)}` : "Expiry date unavailable"}</p>{item.statusReason && item.statusReason !== "None" && <p className="mt-1 text-xs text-muted-foreground">{item.statusReason}</p>}</div>
        <div className="text-sm"><p>Renewal mode: <span className="font-medium">{renewalModeLabel(item.renewalMode)}</span></p>{item.providerAutoRenewRisk && <p className="mt-1 text-xs text-destructive">Automatic renewal is currently enabled for this domain. Please raise a live support ticket if you want manual renewal only.</p>}{item.lifecycle.stage === "REDEMPTION" && <p className="mt-1 text-xs text-destructive">Normal renewal is unavailable. A higher registry recovery fee applies.</p>}{item.lifecycle.stage === "PENDING_DELETE" && <p className="mt-1 text-xs text-destructive">The registry recovery window has closed.</p>}</div>
        <Button variant={item.lifecycle.canRestore ? "destructive" : "default"} disabled={Boolean(item.pendingOrder) || (!item.lifecycle.canRenew && !item.lifecycle.canRestore)} onClick={() => selectDomain(item)}>{item.pendingOrder ? "Order in progress" : item.lifecycle.canRestore ? "Recover Domain" : item.lifecycle.canRenew ? "Renew Domain" : "Unavailable"}</Button>
      </CardContent></Card>)}
    </div> : <EmptyState title="No domains to renew" description="Purchased or transferred domains will appear here." action={<Button asChild><Link href="/search">Buy a domain</Link></Button>} />}
    {selected && <Card><CardHeader><CardTitle>{action === "RESTORE" ? "Domain recovery quote" : "Renewal quote"}</CardTitle><CardDescription>{selected.domainName} · Latest provider-based price with the current SellersLogin pricing rule.</CardDescription></CardHeader><CardContent className="space-y-4">
      {action === "RENEW" && <div className="max-w-xs space-y-2"><Label htmlFor="renewal-period">Renewal period</Label><select id="renewal-period" className="h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={period} onChange={(event) => { setPeriod(Number(event.target.value)); setQuote(null); }}>{(selected.renewalPeriods.length ? selected.renewalPeriods : [1]).map((year) => <option key={year} value={year}>{year} {year === 1 ? "year" : "years"}</option>)}</select></div>}
      {!quote ? <Button disabled={pending} onClick={getQuote}>{pending ? <LoaderCircle className="animate-spin" /> : <RefreshCcw />}Get Latest Price</Button> : <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-muted-foreground">Total payable</p><p className="text-2xl font-semibold">{formatDomainAmount(quote.pricing.customerAmount, quote.pricing.customerCurrency)}</p><p className="text-xs text-muted-foreground">{action === "RESTORE" ? "Registry recovery charge" : `${quote.period}-year renewal`} · Quote expires {formatDomainDate(quote.expiresAt)}</p>{renewals.data && renewals.data.wallet.availableCredits < quote.pricing.customerAmount && <p className="mt-2 text-xs text-destructive">Insufficient credits. Add credits from the main dashboard before confirming.</p>}</div><Button disabled={pending} onClick={confirm}>{pending ? <LoaderCircle className="animate-spin" /> : <CreditCard />}Confirm {action === "RESTORE" ? "Recovery" : "Renewal"}</Button></div>}
    </CardContent></Card>}
  </div>;
}

export function DnsRecords({ token, domainName }: { token: string; domainName?: string }) {
  const domains = useResource<PageResult<DomainAsset>>(token, "/v1/domain/domains?page=1&limit=100");
  if (!domainName) return <div className="space-y-6"><PageHeading title="DNS Records" description="Connect websites, email and services to your domains." />{domains.error && <ErrorState message={domains.error} retry={domains.reload} />}{domains.loading ? <Card><CardContent className="pt-6"><LoadingState /></CardContent></Card> : domains.data?.items.length ? <Card><CardHeader><CardTitle>Choose a domain</CardTitle><CardDescription>Select the domain whose DNS records you want to manage.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2">{domains.data.items.map((domain) => <Button key={domain.domainName} asChild variant="outline" className="h-auto justify-between py-4"><Link href={`/dns/${encodeURIComponent(domain.domainName)}`}><span>{domain.domainName}</span><ArrowRight /></Link></Button>)}</div></CardContent></Card> : <DnsWorkspacePreview />}</div>;
  return <DnsZone token={token} domainName={domainName} />;
}

function DnsZone({ token, domainName }: { token: string; domainName: string }) {
  const requestConfirmation = useConfirmationDialog();
  type EditableRecord = { recordName: string; contents: string[]; contentIndex: number };
  const records = useResource<{ records: Array<Record<string, unknown>> }>(token, `/v1/domain/domains/${encodeURIComponent(domainName)}/dns`);
  const [name, setName] = useState("");
  const [type, setType] = useState("A");
  const [ttl, setTtl] = useState(300);
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState<EditableRecord | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const resetForm = () => {
    setName("");
    setType("A");
    setTtl(300);
    setValue("");
    setEditing(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const contents = editing
      ? editing.contents.map((item, index) => index === editing.contentIndex ? value : item)
      : [value];
    try {
      await domainApi(token, `/v1/domain/domains/${encodeURIComponent(domainName)}/dns`, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(editing
          ? { recordName: editing.recordName || "@", zoneStruct: { name: name.trim(), type, ttl, contents } }
          : { zoneStruct: { name: name.trim(), type, ttl, contents } }),
      });
      setMessage(editing
        ? "DNS record updated successfully. Publish the records to apply your changes."
        : "DNS record added successfully. Publish the records to apply your changes.");
      resetForm();
      records.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : editing
        ? "Unable to update this DNS record."
        : "Unable to add this DNS record.");
    } finally {
      setPending(false);
    }
  };

  const apply = async () => {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await domainApi(token, `/v1/domain/domains/${encodeURIComponent(domainName)}/dns/apply`, { method: "POST" });
      setMessage("DNS records were published successfully. Changes may take some time to appear everywhere.");
      records.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to publish DNS records.");
    } finally {
      setPending(false);
    }
  };

  const remove = async (recordName: string, recordType: string, record: string) => {
    if (!await requestConfirmation({ title: `Delete this ${recordType} record?`, description: "This change takes effect after the DNS records are published.", confirmLabel: "Delete Record", destructive: true })) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await domainApi(token, `/v1/domain/domains/${encodeURIComponent(domainName)}/dns`, {
        method: "DELETE",
        body: JSON.stringify({ name: recordName || "@", recordType, record }),
      });
      if (editing?.recordName === (recordName || "@")) resetForm();
      setMessage("DNS record deleted successfully. Publish the records to apply your changes.");
      records.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete this DNS record.");
    } finally {
      setPending(false);
    }
  };

  const zoneRows = (records.data?.records || []).flatMap((record) => {
    const values = (Array.isArray(record.contents)
      ? record.contents
      : [record.content ?? record.value].filter(Boolean)).map(String);
    return values.map((content, contentIndex) => ({
      name: String(record.name ?? ""),
      type: String(record.type ?? record.recordType ?? ""),
      ttl: Number(record.ttl || 0),
      content,
      contents: values,
      contentIndex,
    }));
  });

  const startEdit = (record: typeof zoneRows[number]) => {
    setEditing({ recordName: record.name || "@", contents: record.contents, contentIndex: record.contentIndex });
    setName(record.name || "@");
    setType(record.type);
    setTtl(record.ttl || 300);
    setValue(record.content);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const recordTypes = [...new Set(["A", "AAAA", "CNAME", "MX", "TXT", "CAA", "NS", "SRV", type])];

  return <div className="space-y-6">
    <PageHeading title={`DNS Records · ${domainName}`} description="Connect your domain to websites, email and other services." action={<Button variant="outline" asChild><Link href="/dns">Change domain</Link></Button>} />
    {(error || records.error) && <ErrorState message={error || records.error} retry={records.reload} />}
    {message && <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">{message}</div>}
    <Card>
      <CardHeader>
        <CardTitle>{editing ? "Edit DNS record" : "Add DNS record"}</CardTitle>
        <CardDescription>{editing ? "Update the selected record, then publish your changes." : "Add A, CNAME, MX, TXT or other supported records."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-5" onSubmit={save}>
          <Input aria-label="Record name" value={name} onChange={(event) => setName(event.target.value)} required placeholder="Name or @" />
          <select aria-label="Record type" className="h-9 rounded-md border bg-transparent px-3 text-sm" value={type} onChange={(event) => setType(event.target.value)}>{recordTypes.map((item) => <option key={item}>{item}</option>)}</select>
          <Input aria-label="TTL" type="number" min={1} max={86400} value={ttl} onChange={(event) => setTtl(Number(event.target.value))} />
          <Input aria-label="Record value" value={value} onChange={(event) => setValue(event.target.value)} required placeholder="Value" />
          <div className="flex gap-2">
            <Button disabled={pending}>{editing ? "Save Changes" : "Add Record"}</Button>
            {editing && <Button type="button" variant="outline" disabled={pending} onClick={resetForm}>Cancel</Button>}
          </div>
        </form>
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>DNS records</CardTitle><CardDescription>Publish after completing your changes.</CardDescription></div>
        <Button onClick={apply} disabled={pending}>Publish Records</Button>
      </CardHeader>
      <CardContent>
        {records.loading ? <LoadingState /> : zoneRows.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-2xl text-sm">
            <thead><tr className="border-b text-left"><th className="pb-3">Name</th><th className="pb-3">Type</th><th className="pb-3">TTL</th><th className="pb-3">Value</th><th className="pb-3 text-right">Actions</th></tr></thead>
            <tbody>{zoneRows.map((record, index) => <tr key={`${record.name}-${record.type}-${record.content}-${index}`} className="border-b last:border-0">
              <td className="py-3 font-medium">{record.name || "@"}</td>
              <td className="py-3"><Badge variant="outline">{record.type}</Badge></td>
              <td className="py-3">{record.ttl || "—"}</td>
              <td className="max-w-sm break-all py-3 font-mono text-xs">{record.content}</td>
              <td className="py-3"><div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => startEdit(record)}>Edit</Button>
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => remove(record.name, record.type, record.content)}>Delete</Button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div> : <EmptyState title="No DNS records" description="Add the first record to create this domain's DNS zone." />}
      </CardContent>
    </Card>
  </div>;
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
  return <div className="space-y-6"><PageHeading title="Orders & Billing" description="Domain transactions and SellersLogin credit usage." action={<Button asChild variant="outline"><Link href="/search">New purchase</Link></Button>} /><section className="grid gap-4 sm:grid-cols-2">{[{ label: "Available", value: wallet.data?.availableCredits }, { label: "Used", value: wallet.data?.usedCredits }].map((item) => <Card key={item.label}><CardHeader><CardDescription>{item.label} credits</CardDescription><CardTitle className="text-2xl">{wallet.loading || item.value == null ? "—" : `${item.value.toLocaleString("en-IN")} ${wallet.data?.currency}`}</CardTitle></CardHeader></Card>)}</section>{(orders.error || wallet.error) && <ErrorState message={orders.error || wallet.error} retry={() => { orders.reload(); wallet.reload(); }} />}<Card><CardContent className="pt-6">{orders.loading ? <LoadingState /> : orders.data?.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-3xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Domain</th><th className="pb-3">Operation</th><th className="pb-3">Amount</th><th className="pb-3">Date</th><th className="pb-3 text-right">Status</th></tr></thead><tbody>{orders.data.items.map((order) => <tr key={order.orderId} className="border-b last:border-0"><td className="py-4 font-medium">{order.domainName}</td><td className="py-4">{order.operation}</td><td className="py-4">{formatDomainAmount(order.amount, order.currency)}</td><td className="py-4 text-muted-foreground">{formatDomainDate(order.createdAt)}</td><td className="py-4 text-right"><Badge variant={order.status === "COMPLETED" ? "secondary" : "outline"}>{order.status.replaceAll("_", " ")}</Badge></td></tr>)}</tbody></table></div> : <EmptyState title="No billing activity" description="Completed and pending domain orders will appear here." />}</CardContent></Card></div>;
}
