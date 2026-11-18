"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, RefreshCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { domainApi, formatDomainAmount, formatDomainDate } from "@/lib/domain-api";
import { AdminPricingPage } from "./admin-pricing-page";

type Section = "Vendors" | "Domains" | "Orders" | "Pricing" | "Reports" | "Settings";
type PageResult<T> = { items: T[]; total: number; page: number; pages: number };
type VendorRow = { vendorId: string; name: string; email: string; accountActive: boolean; verified: boolean; domains: number; activeDomains: number; expiringSoon: number; orders: number; pendingOrders: number; totalSpent: number; currency: string; lastActivityAt?: string };
type DomainRow = { _id: string; domainName: string; vendorId: string; status: unknown; expirationDate?: string; renewalMode?: string; lockStatus?: boolean; lastProviderSyncAt?: string };
type OrderRow = { orderId: string; domainName: string; vendorId: string; operation: string; amount: number; currency: string; status: string; createdAt: string; completedAt?: string; pricingSnapshot?: { providerCostCustomerCurrency?: number; markupAmount?: number; marginAmount?: number; campaign?: { name?: string } | null } };
type Report = { range: { from: string; to: string }; summary: { orders: number; completedOrders: number; failedOrders: number; revenue: number; providerCost: number; margin: number; currency: string; activeVendors: number; totalDomains: number; expiringSoon: number }; operations: Array<{ operation: string; count: number; revenue: number }>; statuses: Array<{ status: string; count: number }>; daily: Array<{ date: string; orders: number; completed: number; revenue: number }> };
type ServiceStatus = { configured: boolean; environment: string; currency: string; walletCurrency: string; liveCurrencyConversionConfigured?: boolean; resellerAutoRenewSafetyAcknowledged: boolean; priceGroup: string; pricingMode: string; catalogue: { count: number; lastSyncedAt?: string }; cache: { redis: string; memoryItems: number } };

function useAdminResource<T>(token: string, path: string) {
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    domainApi<T>(token, path)
      .then((value) => { if (active) { setData(value); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load SellersLogin domain data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, path, version]);
  const reload = useCallback(() => { setLoading(true); setVersion((value) => value + 1); }, []);
  return { data, error, loading, reload };
}

function PageError({ message, retry }: { message: string; retry: () => void }) {
  return <Card><CardContent className="flex items-center justify-between gap-4 py-6"><div className="flex items-center gap-3"><AlertTriangle className="size-5 text-destructive" /><div><p className="font-medium">Unable to load this section</p><p className="text-sm text-muted-foreground">{message}</p></div></div><Button variant="outline" onClick={retry}><RefreshCcw />Retry</Button></CardContent></Card>;
}

function LoadingTable() {
  return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading SellersLogin domain data...</CardContent></Card>;
}

function SearchHeader({ title, description, value, setValue, submit, refresh }: { title: string; description: string; value: string; setValue: (value: string) => void; submit: (event: FormEvent) => void; refresh: () => void }) {
  return <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div><form onSubmit={submit} className="flex w-full gap-2 md:max-w-md"><Input value={value} onChange={(event) => setValue(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} /><Button><Search />Search</Button><Button type="button" variant="outline" size="icon" onClick={refresh}><RefreshCcw /></Button></form></div>;
}

function VendorsPage({ token }: { token: string }) {
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("");
  const path = `/v1/admin/domain/vendors?page=1&limit=50&filter=${encodeURIComponent(filter)}`;
  const resource = useAdminResource<PageResult<VendorRow>>(token, path);
  return <div className="space-y-6"><SearchHeader title="Vendors" description="Real domain usage, orders and activity across vendor accounts." value={input} setValue={setInput} submit={(event) => { event.preventDefault(); setFilter(input.trim()); }} refresh={resource.reload} />{resource.error ? <PageError message={resource.error} retry={resource.reload} /> : resource.loading ? <LoadingTable /> : <Card><CardHeader><CardTitle>Domain vendors</CardTitle><CardDescription>{resource.data?.total || 0} vendors have used SellersLogin Domains.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-5xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Vendor</th><th className="pb-3">Domains</th><th className="pb-3">Orders</th><th className="pb-3">Pending</th><th className="pb-3">Spend</th><th className="pb-3">Last activity</th><th className="pb-3 text-right">Account</th></tr></thead><tbody>{resource.data?.items.map((item) => <tr key={item.vendorId} className="border-b last:border-0"><td className="py-4"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.email || item.vendorId}</p></td><td className="py-4">{item.activeDomains} / {item.domains}</td><td className="py-4">{item.orders}</td><td className="py-4">{item.pendingOrders}</td><td className="py-4">{formatDomainAmount(item.totalSpent, item.currency)}</td><td className="py-4 text-muted-foreground">{formatDomainDate(item.lastActivityAt)}</td><td className="py-4 text-right"><Badge variant={item.accountActive ? "secondary" : "outline"}>{item.accountActive ? "Active" : "Inactive"}</Badge></td></tr>)}{!resource.data?.items.length && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No domain vendors found.</td></tr>}</tbody></table></CardContent></Card>}</div>;
}

function DomainsPage({ token }: { token: string }) {
  const [input, setInput] = useState(""); const [filter, setFilter] = useState("");
  const resource = useAdminResource<PageResult<DomainRow>>(token, `/v1/admin/domain/domains?page=1&limit=50&filter=${encodeURIComponent(filter)}`);
  return <div className="space-y-6"><SearchHeader title="Domains" description="Monitor ownership, lifecycle and renewal state across all vendors." value={input} setValue={setInput} submit={(event) => { event.preventDefault(); setFilter(input.trim()); }} refresh={resource.reload} />{resource.error ? <PageError message={resource.error} retry={resource.reload} /> : resource.loading ? <LoadingTable /> : <Card><CardHeader><CardTitle>Registered domains</CardTitle><CardDescription>{resource.data?.total || 0} domains in SellersLogin.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-4xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Domain</th><th className="pb-3">Vendor ID</th><th className="pb-3">Status</th><th className="pb-3">Renewal</th><th className="pb-3">Expires</th><th className="pb-3 text-right">Lock</th></tr></thead><tbody>{resource.data?.items.map((item) => <tr key={item._id || item.domainName} className="border-b last:border-0"><td className="py-4 font-medium">{item.domainName}</td><td className="py-4 text-muted-foreground">{item.vendorId}</td><td className="py-4"><Badge variant="outline">{String(item.status || "Unknown")}</Badge></td><td className="py-4">{item.renewalMode || "—"}</td><td className="py-4">{formatDomainDate(item.expirationDate)}</td><td className="py-4 text-right">{item.lockStatus == null ? "—" : item.lockStatus ? "Locked" : "Unlocked"}</td></tr>)}{!resource.data?.items.length && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No registered domains found.</td></tr>}</tbody></table></CardContent></Card>}</div>;
}

function RenewalOrdersPage({ token }: { token: string }) {
  const [status, setStatus] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const resource = useAdminResource<PageResult<OrderRow>>(token, `/v1/admin/domain/orders?page=1&limit=50${status ? `&status=${status}` : ""}`);
  const act = async (order: OrderRow, action: "reconcile" | "release-reservation") => {
    if (action === "release-reservation" && !window.confirm(`Release the reserved credits for ${order.domainName}? Use this only after confirming that the provider did not complete the operation.`)) return;
    setPendingAction(`${order.orderId}:${action}`); setFeedback(""); setActionError("");
    try {
      const updated = await domainApi<OrderRow>(token, `/v1/admin/domain/orders/${order.orderId}/${action}`, { method: "POST" });
      setFeedback(`${order.domainName}: ${updated.status.replaceAll("_", " ").toLowerCase()}.`);
      resource.reload();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Order action failed."); }
    finally { setPendingAction(""); }
  };
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">Orders</h2><p className="text-sm text-muted-foreground">Registrations, renewals, recoveries, transfers, provider cost and margin.</p></div><div className="flex gap-2"><select className="h-9 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["COMPLETED", "FAILED", "PROVIDER_PENDING", "RECONCILIATION_REQUIRED", "RESERVED", "CREATED"].map((value) => <option key={value}>{value}</option>)}</select><Button variant="outline" size="icon" onClick={resource.reload}><RefreshCcw /></Button></div></div>
    {(feedback || actionError) && <div className={`rounded-md border p-3 text-sm ${actionError ? "border-destructive/40 text-destructive" : "border-primary/40 bg-primary/10"}`}>{actionError || feedback}</div>}
    {resource.error ? <PageError message={resource.error} retry={resource.reload} /> : resource.loading ? <LoadingTable /> : <Card><CardHeader><CardTitle>Domain orders</CardTitle><CardDescription>{resource.data?.total || 0} matching orders. Reserved credits must be released only after provider verification.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-7xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Domain</th><th className="pb-3">Vendor ID</th><th className="pb-3">Operation</th><th className="pb-3">Provider cost</th><th className="pb-3">Vendor price</th><th className="pb-3">Margin</th><th className="pb-3">Created</th><th className="pb-3">Status</th><th className="pb-3 text-right">Actions</th></tr></thead><tbody>{resource.data?.items.map((item) => <tr key={item.orderId} className="border-b last:border-0"><td className="py-4"><p className="font-medium">{item.domainName}</p>{item.pricingSnapshot?.campaign?.name && <p className="text-xs text-muted-foreground">{item.pricingSnapshot.campaign.name}</p>}</td><td className="py-4 text-muted-foreground">{item.vendorId}</td><td className="py-4">{item.operation}</td><td className="py-4">{formatDomainAmount(item.pricingSnapshot?.providerCostCustomerCurrency, item.currency)}</td><td className="py-4">{formatDomainAmount(item.amount, item.currency)}</td><td className="py-4">{formatDomainAmount(item.pricingSnapshot?.marginAmount, item.currency)}</td><td className="py-4">{formatDomainDate(item.createdAt)}</td><td className="py-4"><Badge variant={item.status === "COMPLETED" ? "secondary" : "outline"}>{item.status.replaceAll("_", " ")}</Badge></td><td className="py-4 text-right"><div className="flex justify-end gap-2">{["PROVIDER_PENDING", "RECONCILIATION_REQUIRED"].includes(item.status) && <Button size="sm" variant="outline" disabled={Boolean(pendingAction)} onClick={() => void act(item, "reconcile")}>Check Provider</Button>}{item.status === "RECONCILIATION_REQUIRED" && <Button size="sm" variant="destructive" disabled={Boolean(pendingAction)} onClick={() => void act(item, "release-reservation")}>Release Credits</Button>}</div></td></tr>)}{!resource.data?.items.length && <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">No domain orders found.</td></tr>}</tbody></table></CardContent></Card>}
  </div>;
}

function PricingPage({ token }: { token: string }) {
  return <AdminPricingPage token={token} />;
}

function ReportsPage({ token }: { token: string }) {
  const initial = useMemo(() => { const end = new Date(); const start = new Date(end.getTime() - 29 * 86400000); return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }; }, []);
  const [fromInput, setFromInput] = useState(initial.from); const [toInput, setToInput] = useState(initial.to); const [range, setRange] = useState(initial);
  const resource = useAdminResource<Report>(token, `/v1/admin/domain/reports?from=${range.from}&to=${range.to}`);
  const download = () => { if (!resource.data) return; const rows = [["Date", "Orders", "Completed", "Revenue INR"], ...resource.data.daily.map((item) => [item.date, item.orders, item.completed, item.revenue])]; const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `sellerslogin-domain-report-${range.from}-${range.to}.csv`; link.click(); URL.revokeObjectURL(url); };
  return <div className="space-y-6"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">Reports</h2><p className="text-sm text-muted-foreground">Sales, provider cost, margin and operational results from live records.</p></div><form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setRange({ from: fromInput, to: toInput }); }}><Input type="date" value={fromInput} onChange={(event) => setFromInput(event.target.value)} className="w-auto" /><Input type="date" value={toInput} onChange={(event) => setToInput(event.target.value)} className="w-auto" /><Button>Apply</Button><Button type="button" variant="outline" onClick={download} disabled={!resource.data}><Download />CSV</Button></form></div>{resource.error ? <PageError message={resource.error} retry={resource.reload} /> : resource.loading ? <LoadingTable /> : <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Revenue", value: formatDomainAmount(resource.data?.summary.revenue, resource.data?.summary.currency) }, { label: "Provider cost", value: formatDomainAmount(resource.data?.summary.providerCost, resource.data?.summary.currency) }, { label: "Gross margin", value: formatDomainAmount(resource.data?.summary.margin, resource.data?.summary.currency) }, { label: "Completed orders", value: resource.data?.summary.completedOrders }].map((item) => <Card key={item.label}><CardHeader><CardDescription>{item.label}</CardDescription><CardTitle className="text-2xl">{item.value ?? "—"}</CardTitle></CardHeader></Card>)}</section><Card><CardHeader><CardTitle>Daily activity</CardTitle><CardDescription>Completed orders and INR revenue for the selected range.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-2xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Date</th><th className="pb-3">Orders</th><th className="pb-3">Completed</th><th className="pb-3">Revenue</th></tr></thead><tbody>{resource.data?.daily.map((item) => <tr key={item.date} className="border-b last:border-0"><td className="py-4">{item.date}</td><td className="py-4">{item.orders}</td><td className="py-4">{item.completed}</td><td className="py-4">{formatDomainAmount(item.revenue, "INR")}</td></tr>)}{!resource.data?.daily.length && <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">No activity in this date range.</td></tr>}</tbody></table></CardContent></Card></>}</div>;
}

function SettingsPage({ token }: { token: string }) {
  const resource = useAdminResource<ServiceStatus>(token, "/v1/admin/domain/provider/status");
  if (resource.error) return <PageError message={resource.error} retry={resource.reload} />;
  if (resource.loading) return <LoadingTable />;
  const data = resource.data;
  return <div className="space-y-6"><div><h2 className="text-2xl font-semibold tracking-tight">Settings</h2><p className="text-sm text-muted-foreground">Read-only production safety and SellersLogin Domains configuration.</p></div><div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Service configuration</CardTitle><CardDescription>Secrets remain backend-only and are never displayed here.</CardDescription></CardHeader><CardContent className="space-y-4">{[{ label: "Domain service", value: data?.configured ? "Configured" : "Not configured" }, { label: "Environment", value: data?.environment || "—" }, { label: "Pricing currency", value: `${data?.currency || "—"} → ${data?.walletCurrency || "—"}` }, { label: "INR conversion", value: data?.liveCurrencyConversionConfigured ? "Configured" : "Not configured" }, { label: "Renewal safety", value: data?.resellerAutoRenewSafetyAcknowledged ? "Confirmed" : "Action required" }].map((item) => <div key={item.label} className="flex items-center justify-between border-b pb-3 last:border-0"><span className="text-sm text-muted-foreground">{item.label}</span><span className="text-sm font-medium">{item.value}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Catalogue and cache</CardTitle><CardDescription>Operational health without exposing integration credentials.</CardDescription></CardHeader><CardContent className="space-y-4">{[{ label: "Active TLDs", value: data?.catalogue.count ?? 0 }, { label: "Last catalogue sync", value: formatDomainDate(data?.catalogue.lastSyncedAt) }, { label: "Shared cache", value: data?.cache.redis === "ready" ? "Ready" : "Memory fallback" }, { label: "Cached items", value: data?.cache.memoryItems ?? 0 }, { label: "Price group", value: data?.priceGroup || "—" }].map((item) => <div key={item.label} className="flex items-center justify-between border-b pb-3 last:border-0"><span className="text-sm text-muted-foreground">{item.label}</span><span className="text-sm font-medium">{item.value}</span></div>)}<Button variant="outline" onClick={resource.reload}><RefreshCcw />Refresh status</Button></CardContent></Card></div></div>;
}

export function AdminSectionPage({ section, token }: { section: Section; token: string }) {
  if (section === "Vendors") return <VendorsPage token={token} />;
  if (section === "Domains") return <DomainsPage token={token} />;
  if (section === "Orders") return <RenewalOrdersPage token={token} />;
  if (section === "Pricing") return <PricingPage token={token} />;
  if (section === "Reports") return <ReportsPage token={token} />;
  return <SettingsPage token={token} />;
}
