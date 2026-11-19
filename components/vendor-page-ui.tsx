"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, LoaderCircle, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function VendorPageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">{title}</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}

export function VendorError({ message, retry }: { message: string; retry?: () => void }) {
  return <Card><CardContent className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" /><div><p className="font-medium">We could not complete this request</p><p className="mt-1 text-sm text-muted-foreground">{message}</p></div></div>{retry && <Button type="button" variant="outline" onClick={retry}>Try Again</Button>}</CardContent></Card>;
}

export function VendorLoading({ label = "Loading your information..." }: { label?: string }) {
  return <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 size-4 animate-spin" />{label}</div>;
}

export function VendorSuccess({ message }: { message: string }) {
  return <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">{message}</div>;
}

type PreviewPage = "domains" | "dns" | "nameservers" | "forwarding" | "contacts" | "documents" | "renewals" | "orders" | "credits" | "notifications";

const previewRows: Record<PreviewPage, Array<[string, string]>> = {
  domains: [["Current status", "Active"], ["Valid until", "18 Nov 2027"], ["Renewal", "Renew manually"]],
  dns: [["@ · A", "203.0.113.25"], ["www · CNAME", "preview-store.example"], ["@ · MX", "10 mail.example"]],
  nameservers: [["Primary nameserver", "ns1.example-dns.com"], ["Secondary nameserver", "ns2.example-dns.com"], ["Domain security", "Active"]],
  forwarding: [["Destination website", "https://www.preview-store.example"], ["Forwarding style", "Show destination address"], ["Current status", "Active"]],
  contacts: [["Domain owner", "Preview Vendor"], ["Email address", "owner@example.com"], ["Verification", "Completed"]],
  documents: [["Identity document", "Accepted"], ["Business document", "Under review"], ["Last updated", "Today"]],
  renewals: [["Valid until", "18 Nov 2027"], ["Renewal period", "1 year"], ["Estimated total", "Shown after live price check"]],
  orders: [["Order type", "Domain purchase"], ["Amount", "Shown from your confirmed order"], ["Result", "Completed"]],
  credits: [["Purpose", "Domain purchase"], ["Credit change", "Payment completed"], ["Balance", "Updated after the order"]],
  notifications: [["Domain purchase completed", "Your domain is ready to manage."], ["Renewal reminder", "30 days remaining before renewal."], ["Verification completed", "Contact details were verified."]],
};

const previewTitles: Record<PreviewPage, string> = {
  domains: "preview-store.com",
  dns: "DNS records for preview-store.com",
  nameservers: "Connection settings for preview-store.com",
  forwarding: "Forward preview-store.com",
  contacts: "Contact details for preview-store.com",
  documents: "Verification for preview-store.com",
  renewals: "Renew preview-store.com",
  orders: "Sample order details",
  credits: "Sample credit activity",
  notifications: "Sample domain notifications",
};

export function VendorWorkspacePreview({ page }: { page: PreviewPage }) {
  return <Card className="overflow-hidden border-dashed"><CardHeader className="border-b bg-muted/20"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CardTitle>{previewTitles[page]}</CardTitle><Badge variant="outline">Preview</Badge></div><CardDescription className="mt-1">This is how this page will look after you buy or transfer a domain.</CardDescription></div><Eye className="size-5 text-muted-foreground" /></div></CardHeader><CardContent className="space-y-4 pt-6"><div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:bg-blue-950/30 dark:text-blue-100"><span className="font-medium">Preview only:</span> This sample information is not connected to a real domain and no credits can be used here.</div><div className="grid gap-3 sm:grid-cols-3">{previewRows[page].map(([label, value]) => <div key={label} className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-medium">{value}</p></div>)}</div><div className="flex flex-wrap gap-2"><Button type="button" disabled>{page === "renewals" ? "Get Latest Price" : page === "documents" ? "Upload Document" : page === "notifications" ? "Mark as Read" : "Manage Domain"}</Button><Button asChild variant="outline"><Link href="/search">Buy a Domain</Link></Button></div></CardContent></Card>;
}

export function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  if (pages <= 1) return total ? <p className="text-xs text-muted-foreground">{total} item{total === 1 ? "" : "s"}</p> : null;
  return <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Page {page} of {pages} · {total} items</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft />Previous</Button><Button type="button" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next<ChevronRight /></Button></div></div>;
}
