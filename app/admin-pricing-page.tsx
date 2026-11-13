"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { domainApi, formatDomainAmount, formatDomainDate } from "@/lib/domain-api";

type PageResult<T> = { items: T[]; total: number; page: number; pages: number };
type MarkupType = "FIXED_SOURCE" | "PERCENT" | "FIXED_CUSTOMER";
type PricingSettings = { defaultMarkupType: MarkupType; defaultMarkupValue: number; taxCollectionMode: "WALLET_TOPUP"; taxRatePercent: number; lowBalanceThresholdUsd: number; updatedAt?: string };
type PricingRule = { ruleId: string; name: string; tld: string; operation: "REGISTER" | "RENEW" | "TRANSFER"; markupType: MarkupType; markupValue: number; active: boolean; startsAt?: string | null; endsAt?: string | null };
type DomainCampaign = { campaignId: string; name: string; tlds: string[]; firstYearPrice: number; requiredYears: number; additionalYearPrice: number; eligibility: "ALL" | "NEW_VENDOR"; perVendorLimit: number; maxRedemptions?: number | null; premiumEligible: boolean; allowLoss: boolean; maxLossPerOrder: number; active: boolean; startsAt: string; endsAt: string };
type PricingPolicy = { sourceCurrency: string; customerCurrency: string; exchangeRate: number | null; exchangeRateUpdatedAt: string | null; settings: PricingSettings; rules: PricingRule[]; campaigns: DomainCampaign[] };
type PriceEntry = { period: number; providerAmount: number; providerCurrency: string; providerCostCustomerCurrency: number; markupAmount: number; customerAmount: number; customerCurrency: string; marginAmount: number; rule?: { name?: string } };
type PriceType = "register" | "renew" | "transfer";
type CatalogueRow = { tld: string; pricing: { register: PriceEntry[]; renew: PriceEntry[]; transfer: PriceEntry[] }; lastSyncedAt?: string };
type ProviderStatus = { balance?: { usdBalance?: number } | null; balanceError?: string; lowBalanceThresholdUsd?: number };

function useResource<T>(token: string, path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    domainApi<T>(token, path)
      .then((value) => { if (active) { setData(value); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Pricing information could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, token, version]);
  const reload = useCallback(() => { setLoading(true); setVersion((value) => value + 1); }, []);
  return { data, error, loading, reload };
}

function useMutation(token: string, reload: () => void) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const mutate = async (path: string, method: "POST" | "PUT", body: unknown, message: string) => {
    setPending(true); setError(""); setNotice("");
    try {
      await domainApi(token, path, { method, body: JSON.stringify(body) });
      setNotice(message); reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Changes could not be saved.");
    } finally { setPending(false); }
  };
  return { pending, notice, error, mutate };
}

const selectClass = "h-9 w-full rounded-md border bg-background px-3 text-sm";

function Field({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return <label className="space-y-1.5 text-sm"><span className="font-medium">{label}</span>{children}<span className="block text-xs leading-5 text-muted-foreground">{help}</span></label>;
}

function PageHeading({ title, description, onRefresh }: { title: string; description: string; onRefresh: () => void }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div><Button type="button" variant="outline" onClick={onRefresh}><RefreshCcw />Refresh</Button></div>;
}

function PageGuide({ title, items }: { title: string; items: Array<{ label: string; detail: string }> }) {
  return <Card className="border-primary/25 bg-primary/5"><CardHeader><CardTitle className="text-base">{title}</CardTitle><CardDescription>Read this once before changing prices.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{items.map((item, index) => <div key={item.label} className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span><div><p className="text-sm font-medium">{item.label}</p><p className="text-xs leading-5 text-muted-foreground">{item.detail}</p></div></div>)}</CardContent></Card>;
}

function Feedback({ notice, error }: { notice: string; error: string }) {
  if (!notice && !error) return null;
  return <div role="status" className={`rounded-md border p-3 text-sm ${error ? "border-destructive/40 text-destructive" : "border-primary/40 bg-primary/10"}`}>{error || notice}</div>;
}

function LoadState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (error) return <Card><CardContent className="flex items-center justify-between gap-4 py-6"><div className="flex items-center gap-3"><AlertTriangle className="size-5 text-destructive" /><div><p className="font-medium">Pricing information could not be loaded</p><p className="text-sm text-muted-foreground">{error}</p></div></div><Button variant="outline" onClick={retry}><RefreshCcw />Try again</Button></CardContent></Card>;
  if (loading) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading pricing information...</CardContent></Card>;
  return null;
}

function PricingOverview({ token }: { token: string }) {
  const policy = useResource<PricingPolicy>(token, "/v1/admin/domain/pricing");
  const provider = useResource<ProviderStatus>(token, "/v1/admin/domain/provider/status");
  const reload = () => { policy.reload(); provider.reload(); };
  const mutation = useMutation(token, reload);
  const settings = policy.data?.settings;
  const providerBalance = provider.data?.balance?.usdBalance;
  const lowBalance = provider.data?.lowBalanceThresholdUsd ?? settings?.lowBalanceThresholdUsd;
  const isBalanceLow = providerBalance != null && lowBalance != null && providerBalance <= lowBalance;
  if (policy.loading || provider.loading || policy.error || provider.error) return <LoadState loading={policy.loading || provider.loading} error={policy.error || provider.error} retry={reload} />;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void mutation.mutate("/v1/admin/domain/pricing/settings", "PUT", {
      defaultMarkupType: form.get("defaultMarkupType"), defaultMarkupValue: Number(form.get("defaultMarkupValue")),
      taxCollectionMode: "WALLET_TOPUP", taxRatePercent: settings?.taxRatePercent ?? 18, lowBalanceThresholdUsd: Number(form.get("lowBalanceThresholdUsd")),
    }, "Default pricing settings saved successfully.");
  };
  return <div className="space-y-6">
    <PageHeading title="Pricing overview" description="Check the provider balance and set the default profit added to domain prices." onRefresh={reload} />
    <PageGuide title="What you control on this page" items={[
      { label: "Provider balance", detail: "Shows the prepaid money available with DomainNameAPI. Domain purchases can fail if this balance becomes too low." },
      { label: "Default profit", detail: "Sets the profit added to every domain when no separate price has been created for that domain type." },
      { label: "Currency conversion", detail: "Shows the rate used to convert the provider's USD price into the INR cost shown in SellersLogin." },
      { label: "Provider balance warning", detail: "The warning amount tells the dashboard when to alert you that DomainNameAPI funds are running low." },
    ]} />
    <Feedback notice={mutation.notice} error={mutation.error} />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      { label: "Domain provider balance", value: providerBalance == null ? "Unavailable" : formatDomainAmount(providerBalance, "USD"), help: "Money available with DomainNameAPI" },
      { label: "Default profit amount", value: settings?.defaultMarkupType === "PERCENT" ? `${settings.defaultMarkupValue}%` : formatDomainAmount(settings?.defaultMarkupValue, settings?.defaultMarkupType === "FIXED_CUSTOMER" ? "INR" : policy.data?.sourceCurrency), help: "Added when no special rule exists" },
      { label: "Dollar-to-rupee rate", value: policy.data?.exchangeRate ? `1 ${policy.data.sourceCurrency} = ${policy.data.exchangeRate.toFixed(4)} ${policy.data.customerCurrency}` : "Unavailable", help: `Last updated ${formatDomainDate(policy.data?.exchangeRateUpdatedAt)}` },
      { label: "GST collection", value: "During wallet recharge", help: "GST is not charged again at domain checkout" },
    ].map((item) => <Card key={item.label}><CardHeader><CardDescription>{item.label}</CardDescription><CardTitle className="text-xl">{item.value}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{item.help}</p></CardContent></Card>)}</section>
    {provider.data?.balanceError && <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Provider balance is temporarily unavailable: {provider.data.balanceError}</div>}
    {isBalanceLow && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">Provider balance is below {formatDomainAmount(lowBalance, "USD")}. Recharge the DomainNameAPI account to avoid purchase failures.</div>}
    <Card><CardHeader><CardTitle>Default domain pricing</CardTitle><CardDescription>These settings apply to every domain type, such as .com or .in, unless a special price is created.</CardDescription></CardHeader><CardContent><form key={settings?.updatedAt || "defaults"} onSubmit={submit} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Field label="How profit is added" help="Choose a fixed USD amount, percentage, or fixed INR amount."><select name="defaultMarkupType" defaultValue={settings?.defaultMarkupType} className={selectClass}><option value="FIXED_SOURCE">Add a fixed USD amount</option><option value="PERCENT">Add a percentage</option><option value="FIXED_CUSTOMER">Add a fixed INR amount</option></select></Field>
      <Field label="Default profit amount" help="Example: enter 2 to add $2 when fixed USD is selected."><Input name="defaultMarkupValue" type="number" min="0" step="0.01" defaultValue={settings?.defaultMarkupValue} required /></Field>
      <Field label="Low provider balance alert" help="Show a warning below this provider balance in USD."><Input name="lowBalanceThresholdUsd" type="number" min="0" step="1" defaultValue={settings?.lowBalanceThresholdUsd} required /></Field>
      <div className="md:col-span-2 xl:col-span-3"><Button disabled={mutation.pending}>{mutation.pending ? "Saving..." : "Save default pricing"}</Button></div>
    </form></CardContent></Card>
  </div>;
}

function DomainPrices({ token }: { token: string }) {
  const [filter, setFilter] = useState("");
  const [appliedFilter, setAppliedFilter] = useState("");
  const [page, setPage] = useState(1);
  const [priceType, setPriceType] = useState<PriceType>("register");
  const catalogue = useResource<PageResult<CatalogueRow>>(token, `/v1/admin/domain/pricing/catalogue?page=${page}&limit=25&filter=${encodeURIComponent(appliedFilter)}`);
  if (catalogue.loading || catalogue.error) return <LoadState loading={catalogue.loading} error={catalogue.error} retry={catalogue.reload} />;
  return <div className="space-y-6">
    <PageHeading title="Domain prices" description="Compare our provider cost, added profit and the final price shown to vendors." onRefresh={catalogue.reload} />
    <PageGuide title="How to read this page" items={[
      { label: "Domain type", detail: "The ending of a domain, such as .com, .in or .net. Different domain types have different provider prices." },
      { label: "Purchase type", detail: "New purchase is the first registration, renewal extends an owned domain, and transfer moves a domain to SellersLogin." },
      { label: "Cost and profit", detail: "Provider price is converted to our INR cost. Added profit is then included to calculate the final vendor price." },
      { label: "Why this list is needed", detail: "It lets the Super Admin verify every price before vendors see it and confirms that SellersLogin is not selling below cost by mistake." },
    ]} />
    <Card><CardHeader><CardTitle>Find a domain price</CardTitle><CardDescription>Search by domain type and choose which purchase price you want to check.</CardDescription></CardHeader><CardContent><form className="grid max-w-3xl gap-4 md:grid-cols-[1fr_240px_auto] md:items-end" onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedFilter(filter.trim()); }}><Field label="Domain type" help="Enter without a dot. Example: com, in or net."><Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Example: com" /></Field><Field label="Purchase type" help="Choose new purchase, renewal or transfer."><select value={priceType} onChange={(event) => setPriceType(event.target.value as PriceType)} className={selectClass}><option value="register">New domain purchase</option><option value="renew">Domain renewal</option><option value="transfer">Domain transfer</option></select></Field><div className="flex gap-2"><Button><Search />Search</Button>{appliedFilter && <Button type="button" variant="outline" onClick={() => { setFilter(""); setAppliedFilter(""); setPage(1); }}>Clear</Button>}</div></form></CardContent></Card>
    <Card><CardHeader><CardTitle>{priceType === "register" ? "New domain purchase prices" : priceType === "renew" ? "Domain renewal prices" : "Domain transfer prices"}</CardTitle><CardDescription>{catalogue.data?.total || 0} domain types found. Provider cost is visible only to the Super Admin.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-5xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Domain type</th><th className="pb-3">Provider price</th><th className="pb-3">Our cost in INR</th><th className="pb-3">Pricing method</th><th className="pb-3">Added profit</th><th className="pb-3">Final vendor price</th><th className="pb-3">Estimated profit</th><th className="pb-3">Price updated</th></tr></thead><tbody>{catalogue.data?.items.map((item) => { const entry = item.pricing[priceType][0]; return <tr key={item.tld} className="border-b last:border-0"><td className="py-4 font-medium">.{item.tld}</td><td className="py-4">{entry ? formatDomainAmount(entry.providerAmount, entry.providerCurrency) : "Not available"}</td><td className="py-4">{entry ? formatDomainAmount(entry.providerCostCustomerCurrency, entry.customerCurrency) : "—"}</td><td className="py-4">{entry?.rule?.name === "Global default" ? "Default pricing" : entry?.rule?.name || "—"}</td><td className="py-4">{entry ? formatDomainAmount(entry.markupAmount, entry.customerCurrency) : "—"}</td><td className="py-4 font-medium">{entry ? formatDomainAmount(entry.customerAmount, entry.customerCurrency) : "—"}</td><td className="py-4">{entry ? formatDomainAmount(entry.marginAmount, entry.customerCurrency) : "—"}</td><td className="py-4 text-muted-foreground">{formatDomainDate(item.lastSyncedAt)}</td></tr>; })}{!catalogue.data?.items.length && <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No matching domain types found.</td></tr>}</tbody></table>
      <div className="mt-4 flex items-center justify-between border-t pt-4"><p className="text-sm text-muted-foreground">Page {catalogue.data?.page || 1} of {Math.max(catalogue.data?.pages || 1, 1)}</p><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft />Previous</Button><Button type="button" variant="outline" size="sm" disabled={page >= (catalogue.data?.pages || 1)} onClick={() => setPage((value) => value + 1)}>Next<ArrowRight /></Button></div></div>
    </CardContent></Card>
  </div>;
}

function SpecialPricingRules({ token }: { token: string }) {
  const policy = useResource<PricingPolicy>(token, "/v1/admin/domain/pricing");
  const mutation = useMutation(token, policy.reload);
  if (policy.loading || policy.error) return <LoadState loading={policy.loading} error={policy.error} retry={policy.reload} />;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void mutation.mutate("/v1/admin/domain/pricing/rules", "POST", { name: form.get("name"), tld: form.get("tld"), operation: form.get("operation"), markupType: form.get("markupType"), markupValue: Number(form.get("markupValue")), active: true, startsAt: null, endsAt: null }, "Special pricing rule saved successfully.");
  };
  const toggle = (item: PricingRule) => void mutation.mutate(`/v1/admin/domain/pricing/rules/${item.ruleId}`, "PUT", { name: item.name, tld: item.tld, operation: item.operation, markupType: item.markupType, markupValue: item.markupValue, active: !item.active, startsAt: item.startsAt || null, endsAt: item.endsAt || null }, `Rule ${item.active ? "disabled" : "enabled"} successfully.`);
  return <div className="space-y-6">
    <PageHeading title="Special pricing rules" description="Set a different profit amount for a specific domain type and purchase action." onRefresh={policy.reload} />
    <PageGuide title="When to use a special price" items={[
      { label: "Start with default pricing", detail: "The default profit from Pricing Overview normally applies to every domain type." },
      { label: "Choose one domain type", detail: "Create a special price only when a domain type such as .com needs a different profit amount." },
      { label: "Choose one purchase action", detail: "A rule can apply separately to a new purchase, renewal or transfer, so changing one does not affect the others." },
      { label: "Enable or disable safely", detail: "Disabling a rule does not delete it. The system simply returns to default pricing for that domain type and action." },
    ]} />
    <Feedback notice={mutation.notice} error={mutation.error} />
    <Card><CardHeader><CardTitle>Create a special price</CardTitle><CardDescription>Example: add a different profit only when a vendor registers a .com domain.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Rule name" help="An internal name that helps you identify this rule."><Input name="name" placeholder="Example: .com registration profit" required /></Field>
      <Field label="Domain type" help="This is the ending of a domain. Enter without a dot: com means .com."><Input name="tld" placeholder="com" required /></Field>
      <Field label="Price applies to" help="Choose when this special profit should be used."><select name="operation" className={selectClass}><option value="REGISTER">New domain registration</option><option value="RENEW">Domain renewal</option><option value="TRANSFER">Domain transfer</option></select></Field>
      <Field label="How profit is added" help="Choose fixed USD, percentage, or fixed INR."><select name="markupType" className={selectClass}><option value="FIXED_SOURCE">Add a fixed USD amount</option><option value="PERCENT">Add a percentage</option><option value="FIXED_CUSTOMER">Add a fixed INR amount</option></select></Field>
      <Field label="Profit amount" help="Example: enter 3 for $3, or 10 for 10%."><Input name="markupValue" type="number" min="0" step="0.01" placeholder="Enter amount" required /></Field>
      <div className="flex items-end"><Button className="w-full" disabled={mutation.pending}>{mutation.pending ? "Saving..." : "Save special price"}</Button></div>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>Saved special pricing rules</CardTitle><CardDescription>When a rule is disabled, the default pricing setting is used instead.</CardDescription></CardHeader><CardContent><div className="divide-y">{policy.data?.rules.map((item) => <div key={item.ruleId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">.{item.tld} · {item.operation === "REGISTER" ? "New registration" : item.operation === "RENEW" ? "Renewal" : "Transfer"}</p><p className="text-sm text-muted-foreground">{item.name} · {item.markupType === "PERCENT" ? `${item.markupValue}% profit` : `${item.markupValue} ${item.markupType === "FIXED_CUSTOMER" ? "INR" : "USD"} profit`}</p></div><Button type="button" size="sm" variant="outline" onClick={() => toggle(item)} disabled={mutation.pending}>{item.active ? "Disable rule" : "Enable rule"}</Button></div>)}{!policy.data?.rules.length && <p className="py-10 text-center text-sm text-muted-foreground">No special pricing rules have been created. Default pricing applies to every domain type.</p>}</div></CardContent></Card>
  </div>;
}

function OffersAndDiscounts({ token }: { token: string }) {
  const policy = useResource<PricingPolicy>(token, "/v1/admin/domain/pricing");
  const mutation = useMutation(token, policy.reload);
  if (policy.loading || policy.error) return <LoadState loading={policy.loading} error={policy.error} retry={policy.reload} />;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const maximum = String(form.get("maxRedemptions") || "").trim();
    void mutation.mutate("/v1/admin/domain/pricing/campaigns", "POST", { name: form.get("name"), tlds: String(form.get("tlds") || "").split(",").map((value) => value.trim()).filter(Boolean), firstYearPrice: Number(form.get("firstYearPrice")), requiredYears: Number(form.get("requiredYears")), additionalYearPrice: Number(form.get("additionalYearPrice")), eligibility: form.get("eligibility"), perVendorLimit: Number(form.get("perVendorLimit")), maxRedemptions: maximum ? Number(maximum) : null, premiumEligible: form.get("premiumEligible") === "on", allowLoss: form.get("allowLoss") === "on", maxLossPerOrder: Number(form.get("maxLossPerOrder") || 0), active: true, startsAt: new Date(String(form.get("startsAt"))).toISOString(), endsAt: new Date(String(form.get("endsAt"))).toISOString() }, "Multi-year offer created successfully.");
  };
  const toggle = (item: DomainCampaign) => void mutation.mutate(`/v1/admin/domain/pricing/campaigns/${item.campaignId}`, "PUT", { name: item.name, tlds: item.tlds, firstYearPrice: item.firstYearPrice, requiredYears: item.requiredYears, additionalYearPrice: item.additionalYearPrice, eligibility: item.eligibility, perVendorLimit: item.perVendorLimit, maxRedemptions: item.maxRedemptions || null, premiumEligible: item.premiumEligible, allowLoss: item.allowLoss, maxLossPerOrder: item.maxLossPerOrder, active: !item.active, startsAt: item.startsAt, endsAt: item.endsAt }, `Offer ${item.active ? "disabled" : "enabled"} successfully.`);
  return <div className="space-y-6">
    <PageHeading title="Offers & discounts" description="Create first-year discounts that require vendors to purchase multiple years together." onRefresh={policy.reload} />
    <PageGuide title="How multi-year offers work" items={[
      { label: "Set the first-year discount", detail: "Choose the attractive first-year amount shown to the vendor, for example ₹1." },
      { label: "Require multiple years", detail: "The vendor receives the discount only when all required years are purchased and paid for together." },
      { label: "Control who can use it", detail: "Limit the offer to new vendors, restrict uses per vendor, set a total use limit, and choose start and end dates." },
      { label: "Protect SellersLogin from loss", detail: "By default an offer below provider cost is blocked. Controlled loss should be enabled only when you intentionally approve a maximum INR loss." },
    ]} />
    <Feedback notice={mutation.notice} error={mutation.error} />
    <Card><CardHeader><CardTitle>Create a multi-year offer</CardTitle><CardDescription>Example: charge ₹1 for year one and ₹1,599 for each of the next two years in one 3-year purchase.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Offer name" help="An internal name for identifying the offer."><Input name="name" placeholder="Example: ₹1 .com offer" required /></Field>
      <Field label="Eligible domain types" help="Enter domain endings without dots and separate them with commas. Example: com, in."><Input name="tlds" placeholder="com, in" required /></Field>
      <Field label="First-year offer price" help="The INR price shown for the first year."><Input name="firstYearPrice" type="number" min="0" step="0.01" placeholder="Example: 1" required /></Field>
      <Field label="Required purchase period" help="How many years the vendor must buy together."><Input name="requiredYears" type="number" min="2" max="10" defaultValue="3" required /></Field>
      <Field label="Price for each later year" help="INR price for year two and every following year."><Input name="additionalYearPrice" type="number" min="0" step="0.01" placeholder="Example: 1599" required /></Field>
      <Field label="Uses allowed per vendor" help="How many times one vendor can claim this offer."><Input name="perVendorLimit" type="number" min="1" defaultValue="1" required /></Field>
      <Field label="Maximum total uses" help="Optional limit across all vendors. Leave blank for no total limit."><Input name="maxRedemptions" type="number" min="1" placeholder="Optional" /></Field>
      <Field label="Who can use this offer" help="Make it available to everyone or only new vendors."><select name="eligibility" className={selectClass}><option value="ALL">All vendors</option><option value="NEW_VENDOR">New vendors only</option></select></Field>
      <Field label="Offer starts" help="Date and time when vendors can start using it."><Input name="startsAt" type="datetime-local" required /></Field>
      <Field label="Offer ends" help="Date and time after which the offer stops."><Input name="endsAt" type="datetime-local" required /></Field>
      <Field label="Maximum allowed loss per order" help="Used only when loss is allowed. Enter the maximum INR loss."><Input name="maxLossPerOrder" type="number" min="0" step="0.01" defaultValue="0" required /></Field>
      <div className="space-y-3 rounded-md border p-4 text-sm"><label className="flex items-start gap-2"><input name="premiumEligible" type="checkbox" className="mt-1" /><span><span className="block font-medium">Include premium domains</span><span className="text-xs text-muted-foreground">Allow this offer on expensive premium domains.</span></span></label><label className="flex items-start gap-2"><input name="allowLoss" type="checkbox" className="mt-1" /><span><span className="block font-medium">Allow a controlled loss</span><span className="text-xs text-muted-foreground">Permit the final price to be below provider cost, within the limit above.</span></span></label></div>
      <div className="flex items-end"><Button className="w-full" disabled={mutation.pending}>{mutation.pending ? "Creating..." : "Create multi-year offer"}</Button></div>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>Saved offers</CardTitle><CardDescription>Offer eligibility is checked when the price is prepared and again before purchase.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-4xl text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Offer</th><th className="pb-3">Domain types</th><th className="pb-3">Prices</th><th className="pb-3">Required period</th><th className="pb-3">Available dates</th><th className="pb-3 text-right">Action</th></tr></thead><tbody>{policy.data?.campaigns.map((item) => <tr key={item.campaignId} className="border-b last:border-0"><td className="py-4 font-medium">{item.name}</td><td className="py-4">{item.tlds.map((tld) => `.${tld}`).join(", ")}</td><td className="py-4">{formatDomainAmount(item.firstYearPrice, "INR")} first year · {formatDomainAmount(item.additionalYearPrice, "INR")} later</td><td className="py-4">{item.requiredYears} years</td><td className="py-4 text-muted-foreground">{formatDomainDate(item.startsAt)} – {formatDomainDate(item.endsAt)}</td><td className="py-4 text-right"><Button type="button" size="sm" variant="outline" onClick={() => toggle(item)} disabled={mutation.pending}>{item.active ? "Disable offer" : "Enable offer"}</Button></td></tr>)}{!policy.data?.campaigns.length && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No multi-year offers have been created.</td></tr>}</tbody></table></CardContent></Card>
  </div>;
}

export function AdminPricingPage({ token }: { token: string }) {
  const pathname = usePathname();
  if (pathname === "/admin/pricing/domains") return <DomainPrices token={token} />;
  if (pathname === "/admin/pricing/rules") return <SpecialPricingRules token={token} />;
  if (pathname === "/admin/pricing/offers") return <OffersAndDiscounts token={token} />;
  return <PricingOverview token={token} />;
}
