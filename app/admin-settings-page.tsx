"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clearDomainResource, useDomainResource } from "@/lib/domain-resource";
import { domainApi, formatDomainAmount, formatDomainDate } from "@/lib/domain-api";

type ServiceStatus = { configured: boolean; environment: string; currency: string; walletCurrency: string; liveCurrencyConversionConfigured?: boolean; resellerAutoRenewSafetyAcknowledged: boolean; catalogue: { count: number; lastSyncedAt?: string }; cache: { redis: string; memoryItems: number }; balance?: { tryBalance?: number; usdBalance?: number }; latestStoredBalance?: { tryBalance?: number; usdBalance?: number; checkedAt?: string }; pendingFinancialConfirmations?: number; financialReviewCount?: number };
type OperationalSettings = { financialEmailAlertsEnabled: boolean; financialAlertEmails: string[]; lowBalanceReminderHours: number; chargeReviewAfterAttempts: number };
type PricingSettingsResponse = { settings: { defaultMarkupType: string; defaultMarkupValue: number; taxRatePercent: number; taxCollectionMode: "WALLET_TOPUP"; lowBalanceThresholdUsd: number } };

const Loading = () => <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading domain settings...</CardContent></Card>;

export function AdminSettingsPage({ token }: { token: string }) {
  const status = useDomainResource<ServiceStatus>(token, "/v1/admin/domain/provider/status", 20_000);
  const settings = useDomainResource<OperationalSettings>(token, "/v1/admin/domain/settings", 20_000);
  const pricing = useDomainResource<PricingSettingsResponse>(token, "/v1/admin/domain/pricing", 20_000);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const reloadAll = () => { status.reload(); settings.reload(); pricing.reload(); };
  const refreshBalance = async () => {
    setRefreshing(true); setSaveError("");
    try {
      await domainApi(token, "/v1/admin/domain/provider/balance/refresh", { method: "POST" });
      clearDomainResource("/v1/admin/domain/provider/status"); status.reload();
    } catch (error) { setSaveError(error instanceof Error ? error.message : "The provider balance could not be checked."); }
    finally { setRefreshing(false); }
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings.data || !pricing.data) return;
    const form = new FormData(event.currentTarget);
    const emails = String(form.get("financialAlertEmails") || "").split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
    setSaving(true); setNotice(""); setSaveError("");
    try {
      await Promise.all([
        domainApi(token, "/v1/admin/domain/settings", { method: "PUT", body: JSON.stringify({ financialEmailAlertsEnabled: form.get("financialEmailAlertsEnabled") === "on", financialAlertEmails: emails, lowBalanceReminderHours: Number(form.get("lowBalanceReminderHours")), chargeReviewAfterAttempts: Number(form.get("chargeReviewAfterAttempts")) }) }),
        domainApi(token, "/v1/admin/domain/pricing/settings", { method: "PUT", body: JSON.stringify({ ...pricing.data.settings, lowBalanceThresholdUsd: Number(form.get("lowBalanceThresholdUsd")) }) }),
      ]);
      clearDomainResource("/v1/admin/domain/"); reloadAll(); setNotice("Domain administration settings were saved successfully.");
    } catch (error) { setSaveError(error instanceof Error ? error.message : "The settings could not be saved."); }
    finally { setSaving(false); }
  };
  const error = status.error || settings.error || pricing.error;
  if (error) return <Card><CardContent className="flex items-center justify-between gap-4 py-6"><div className="flex items-center gap-3"><AlertTriangle className="size-5 text-destructive" /><div><p className="font-medium">Unable to load settings</p><p className="text-sm text-muted-foreground">{error}</p></div></div><Button variant="outline" onClick={reloadAll}><RefreshCcw />Retry</Button></CardContent></Card>;
  if (status.loading || settings.loading || pricing.loading || !settings.data || !pricing.data) return <Loading />;
  const data = status.data;
  const balance = data?.balance || data?.latestStoredBalance;
  const statusRows = [["Domain service", data?.configured], ["Currency conversion", data?.liveCurrencyConversionConfigured], ["Renewal safety", data?.resellerAutoRenewSafetyAcknowledged]] as const;
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-semibold">Settings</h2><p className="text-sm text-muted-foreground">Control safe financial alerts and review timing. API keys and secrets are never displayed or edited here.</p></div>
    {notice && <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {saveError && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{saveError}</p>}
    <div className="grid gap-6 md:grid-cols-2">
      <Card><CardHeader><CardTitle>Service configuration</CardTitle><CardDescription>Live safety checks used by domain operations.</CardDescription></CardHeader><CardContent>{statusRows.map(([label, ready]) => <div key={label} className="flex justify-between border-b py-3 text-sm"><span>{label}</span><span className="font-medium">{ready ? "Ready" : "Action required"}</span></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Provider balance</CardTitle><CardDescription>Current funds and financial reconciliation workload.</CardDescription></CardHeader><CardContent className="space-y-3">{[["USD balance", balance?.usdBalance == null ? "Not available" : formatDomainAmount(balance.usdBalance, "USD")], ["TRY balance", balance?.tryBalance == null ? "Not available" : formatDomainAmount(balance.tryBalance, "TRY")], ["Last stored check", formatDomainDate(data?.latestStoredBalance?.checkedAt)], ["Waiting charge confirmations", data?.pendingFinancialConfirmations ?? 0], ["Charges needing review", data?.financialReviewCount ?? 0]].map(([label, value]) => <div key={String(label)} className="flex justify-between border-b pb-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>)}<Button variant="outline" disabled={refreshing} onClick={() => void refreshBalance()}><RefreshCcw />{refreshing ? "Checking..." : "Check Balance Now"}</Button></CardContent></Card>
      <Card className="md:col-span-2"><CardHeader><CardTitle>Financial alerts and review safety</CardTitle><CardDescription>These settings affect Super Admin alerts only. They do not change vendor domain operations.</CardDescription></CardHeader><CardContent><form onSubmit={save} className="grid gap-5 md:grid-cols-2"><label className="flex items-start gap-3 rounded-md border p-4"><input name="financialEmailAlertsEnabled" type="checkbox" defaultChecked={settings.data.financialEmailAlertsEnabled} className="mt-1" /><span><span className="block font-medium">Send financial alert emails</span><span className="text-xs text-muted-foreground">Email Super Admins for low balance, refunds and provider-charge review issues.</span></span></label><label className="space-y-2"><span className="text-sm font-medium">Alert email addresses</span><Input name="financialAlertEmails" type="text" defaultValue={settings.data.financialAlertEmails.join(", ")} placeholder="admin@sellerslogin.com" /><span className="block text-xs text-muted-foreground">Separate multiple addresses with commas.</span></label><label className="space-y-2"><span className="text-sm font-medium">Low provider balance limit (USD)</span><Input name="lowBalanceThresholdUsd" type="number" min="0" step="0.01" defaultValue={pricing.data.settings.lowBalanceThresholdUsd} required /><span className="block text-xs text-muted-foreground">An alert is created when the saved USD balance falls below this amount.</span></label><label className="space-y-2"><span className="text-sm font-medium">Repeat low-balance email after</span><Input name="lowBalanceReminderHours" type="number" min="1" max="720" defaultValue={settings.data.lowBalanceReminderHours} required /><span className="block text-xs text-muted-foreground">Hours before a resolved low-balance issue may send another email.</span></label><label className="space-y-2"><span className="text-sm font-medium">Automatic charge checks before review</span><Input name="chargeReviewAfterAttempts" type="number" min="1" max="100" defaultValue={settings.data.chargeReviewAfterAttempts} required /><span className="block text-xs text-muted-foreground">After these failed checks, the charge is marked for manual review.</span></label><div className="flex items-end"><Button disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button></div></form></CardContent></Card>
      <Card className="md:col-span-2"><CardHeader><CardTitle>Catalogue and cache</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{[["Environment", data?.environment], ["Pricing currency", `${data?.currency} to ${data?.walletCurrency}`], ["Available extensions", data?.catalogue.count], ["Last catalogue sync", formatDomainDate(data?.catalogue.lastSyncedAt)], ["Shared cache", data?.cache.redis === "ready" ? "Ready" : "Memory fallback"], ["Cached items", data?.cache.memoryItems]].map(([label, value]) => <div key={String(label)} className="flex justify-between border-b pb-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>)}</CardContent></Card>
    </div>
  </div>;
}
